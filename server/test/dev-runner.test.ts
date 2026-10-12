import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const runnerUrl = new URL('../../scripts/dev.mjs', import.meta.url);

class FakeChild extends EventEmitter {
  exited = false;

  constructor(readonly pid: number) {
    super();
    this.once('exit', () => {
      this.exited = true;
    });
  }
}

async function loadRunner(): Promise<any> {
  return import(runnerUrl.href);
}

function containsErrorCode(error: any, code: string): boolean {
  if (error?.code === code) return true;
  return error instanceof AggregateError && error.errors.some((nested) => containsErrorCode(nested, code));
}

function createHarness(platform = 'darwin', timeoutMs = 10) {
  const children: FakeChild[] = [];
  const groupSignals: Array<{ pid: number; signal: string }> = [];
  const taskkillCalls: Array<{ pid: number; force: boolean }> = [];
  const groupAlive = new Map<number, boolean>();
  let nextPid = 4100;
  const spawnChild = vi.fn(() => {
    const child = new FakeChild(nextPid++);
    children.push(child);
    groupAlive.set(child.pid, true);
    return child;
  });
  const probeGroup = vi.fn((pgid: number) => groupAlive.get(pgid) ?? false);
  const signalGroup = vi.fn((pid: number, signal: string) => {
    groupSignals.push({ pid, signal });
    groupAlive.set(-pid, false);
    const child = children.find((candidate) => candidate.pid === -pid);
    child?.emit('exit', null, signal);
  });
  const spawnTaskkill = vi.fn((pid: number, force: boolean) => {
    taskkillCalls.push({ pid, force });
    if (!force) {
      children.find((candidate) => candidate.pid === pid)?.emit('exit', null, 'SIGTERM');
    } else {
      children.find((candidate) => candidate.pid === pid)?.emit('exit', null, 'SIGKILL');
    }
  });
  return {
    children,
    groupSignals,
    taskkillCalls,
    groupAlive,
    spawnChild,
    signalGroup,
    probeGroup,
    spawnTaskkill,
    platform,
    timeoutMs,
  };
}

const baseOptions = {
  env: { PORT: '33877', npm_execpath: '/npm/npm-cli.js', PATH: '/sentinel/path' },
  processExecPath: '/node/node',
  cwd: '/repo',
  processLike: { exitCode: 0, stderr: { write: vi.fn() } },
};

describe('development process runner', () => {
  it('starts both workspace scripts through the current Node and npm CLI', async () => {
    const runner = await loadRunner();
    const harness = createHarness();
    await runner.launchDevProcesses({
      ...baseOptions,
      ...harness,
    });

    expect(harness.spawnChild).toHaveBeenCalledTimes(2);
    expect(harness.spawnChild).toHaveBeenNthCalledWith(
      1,
      '/node/node',
      ['/npm/npm-cli.js', 'run', 'dev', '-w', '@hn/server'],
      expect.objectContaining({
        cwd: '/repo',
        shell: false,
        detached: true,
        env: expect.objectContaining({ PORT: '33877', PATH: '/sentinel/path' }),
      }),
    );
    expect(harness.spawnChild).toHaveBeenNthCalledWith(
      2,
      '/node/node',
      ['/npm/npm-cli.js', 'run', 'dev', '-w', '@hn/client'],
      expect.objectContaining({ cwd: '/repo', shell: false, detached: true }),
    );
  });

  it('fails invalid PORT and missing npm_execpath before spawning children', async () => {
    const runner = await loadRunner();
    const spawnChild = vi.fn();
    await expect(runner.launchDevProcesses({
      ...baseOptions,
      env: { PORT: 'not-a-port', npm_execpath: '/npm/npm-cli.js' },
      spawnChild,
    })).rejects.toThrow(/PORT/);
    await expect(runner.launchDevProcesses({
      ...baseOptions,
      env: { PORT: '3000' },
      spawnChild,
    })).rejects.toThrow(/npm_execpath/);
    expect(spawnChild).not.toHaveBeenCalled();
  });

  it('terminates only its own POSIX process groups on stop', async () => {
    const runner = await loadRunner();
    const harness = createHarness('darwin');
    const session = await runner.launchDevProcesses({ ...baseOptions, ...harness });
    await session.stop('test-stop');

    expect(harness.groupSignals).toEqual([
      { pid: -4100, signal: 'SIGTERM' },
      { pid: -4101, signal: 'SIGTERM' },
    ]);
    expect(harness.children.every((child) => child.exited)).toBe(true);
  });

  it('drains a POSIX group after its wrapper exits and kills a TERM-resistant descendant', async () => {
    const runner = await loadRunner();
    const child = new FakeChild(4200);
    const signals: string[] = [];
    let groupAlive = true;
    const supervisor = runner.createProcessSupervisor({
      platform: 'darwin',
      timeoutMs: 10,
      forceTimeoutMs: 40,
      probeGroup: vi.fn(() => groupAlive),
      signalGroup: vi.fn((_pid: number, signal: string) => {
        signals.push(signal);
        if (signal === 'SIGKILL') groupAlive = false;
      }),
    });

    supervisor.start('fixture', '/node', [], {
      spawnChild: () => child,
      spawnOptions: { detached: true },
    });
    child.emit('exit', 0, null);
    await supervisor.stop('join-wrapper-cleanup');

    expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(groupAlive).toBe(false);
  });

  it('stops the sibling after a child error or exit', async () => {
    const runner = await loadRunner();
    const errorHarness = createHarness('darwin');
    const errorSession = await runner.launchDevProcesses({ ...baseOptions, ...errorHarness });
    errorHarness.children[0]?.emit('error', new Error('spawn failed'));
    await errorSession.stop('observed-error');
    expect(errorHarness.groupSignals).toContainEqual({ pid: -4100, signal: 'SIGTERM' });
    expect(errorHarness.groupSignals).toContainEqual({ pid: -4101, signal: 'SIGTERM' });

    const exitHarness = createHarness('darwin');
    const exitSession = await runner.launchDevProcesses({ ...baseOptions, ...exitHarness });
    exitHarness.children[0]?.emit('exit', 0, null);
    await exitSession.stop('observed-exit');
    expect(exitHarness.groupSignals).toContainEqual({ pid: -4101, signal: 'SIGTERM' });
  });

  it('uses a bounded Windows taskkill tree strategy anchored to owned PIDs', async () => {
    const runner = await loadRunner();
    const gracefulHarness = createHarness('win32');
    const gracefulSession = await runner.launchDevProcesses({ ...baseOptions, ...gracefulHarness });
    await gracefulSession.stop('test-stop');
    expect(gracefulHarness.taskkillCalls).toEqual([
      { pid: 4100, force: false },
      { pid: 4101, force: false },
    ]);

    const timeoutHarness = createHarness('win32', 1);
    timeoutHarness.spawnTaskkill.mockImplementation((pid: number, force: boolean) => {
      timeoutHarness.taskkillCalls.push({ pid, force });
      if (force) timeoutHarness.children.find((candidate) => candidate.pid === pid)?.emit('exit', null, 'SIGKILL');
    });
    const timeoutSession = await runner.launchDevProcesses({ ...baseOptions, ...timeoutHarness });
    await timeoutSession.stop('timeout');
    expect(timeoutHarness.taskkillCalls).toContainEqual({ pid: 4100, force: true });
    expect(timeoutHarness.taskkillCalls).toContainEqual({ pid: 4101, force: true });

    const hungHarness = createHarness('win32', 5);
    hungHarness.spawnTaskkill.mockImplementation((pid: number, force: boolean) => {
      hungHarness.taskkillCalls.push({ pid, force });
      if (force) hungHarness.children.find((candidate) => candidate.pid === pid)?.emit('exit', null, 'SIGKILL');
      return force ? Promise.resolve() : new Promise(() => {});
    });
    const hungSession = await runner.launchDevProcesses({ ...baseOptions, ...hungHarness });
    await hungSession.stop('hung-taskkill');
    expect(hungHarness.taskkillCalls).toContainEqual({ pid: 4100, force: true });
    expect(hungHarness.taskkillCalls).toContainEqual({ pid: 4101, force: true });
  });

  it('bounds and terminates its own hung taskkill helper', async () => {
    const runner = await loadRunner();
    const helper = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
    helper.kill = vi.fn((signal?: string) => {
      if (signal === undefined) {
        setImmediate(() => helper.emit('error', Object.assign(new Error('graceful helper termination denied'), { code: 'EPERM' })));
      }
      if (signal === 'SIGKILL') setImmediate(() => helper.emit('close', null, 'SIGKILL'));
      return true;
    });
    const spawnTerminator = vi.fn(() => helper);
    const operation = runner.createWindowsTreeTerminator(4200, false, 5, {
      spawnTerminator,
      killTimeoutMs: 15,
    });

    const cleanupError = await operation.catch((error: unknown) => error);
    expect(cleanupError).toBeInstanceOf(Error);
    expect((cleanupError as Error).message).toMatch(/timeout/i);
    expect((cleanupError as Error).cause).toBeInstanceOf(AggregateError);
    expect(containsErrorCode((cleanupError as Error).cause, 'EPERM')).toBe(true);
    expect(spawnTerminator).toHaveBeenCalledWith(
      'taskkill.exe',
      ['/PID', '4200', '/T'],
      expect.objectContaining({ shell: false, windowsHide: true }),
    );
    expect(helper.kill).toHaveBeenNthCalledWith(1, undefined);
    expect(helper.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
  });

  it('sets nonzero when a zero-exit wrapper leaves an unverifiable group', async () => {
    const runner = await loadRunner();
    const harness = createHarness('darwin', 5);
    const permissionError = Object.assign(new Error('permission denied'), { code: 'EPERM' });
    harness.signalGroup.mockImplementation(() => {});
    harness.probeGroup.mockImplementation(() => { throw permissionError; });
    const processLike = { exitCode: 0, stderr: { write: vi.fn() } };
    const session = await runner.launchDevProcesses({ ...baseOptions, ...harness, processLike });

    harness.children[0]?.emit('exit', 0, null);
    const cleanupError = await session.stop('await-zero-exit-cleanup').catch((error: unknown) => error);
    await new Promise((resolveWait) => setImmediate(resolveWait));

    expect(containsErrorCode(cleanupError, 'EPERM')).toBe(true);
    expect(processLike.exitCode).toBe(1);
    expect(processLike.stderr.write).toHaveBeenCalledWith(expect.stringMatching(/cleanup/i));
  });

  it('propagates cleanup failure as nonzero and makes parent stop idempotent', async () => {
    const runner = await loadRunner();
    const harness = createHarness('darwin', 5);
    const permissionError = Object.assign(new Error('permission denied'), { code: 'EPERM' });
    harness.signalGroup.mockImplementation(() => {});
    harness.probeGroup.mockImplementation(() => { throw permissionError; });
    const processLike = { exitCode: 0, stderr: { write: vi.fn() } };
    const session = await runner.launchDevProcesses({ ...baseOptions, ...harness, processLike });
    const fakeParent = new EventEmitter() as EventEmitter & { exitCode?: number; stderr?: { write: ReturnType<typeof vi.fn> } };
    fakeParent.exitCode = 0;
    fakeParent.stderr = { write: vi.fn() };
    session.attachSignalHandlers(fakeParent);

    fakeParent.emit('SIGINT');
    const firstStop = session.stop('await-parent-stop');
    const secondStop = session.stop('repeat-parent-stop');
    expect(firstStop).toBe(secondStop);
    const cleanupError = await firstStop.catch((error: unknown) => error);
    expect(cleanupError).toBeInstanceOf(AggregateError);
    expect(containsErrorCode(cleanupError, 'EPERM')).toBe(true);
    await new Promise((resolveWait) => setImmediate(resolveWait));

    expect(fakeParent.exitCode).toBe(1);
    expect(fakeParent.stderr?.write).toHaveBeenCalledWith(expect.stringMatching(/cleanup.*SIGINT/i));
  });

  it('routes parent signals into bounded child cleanup', async () => {
    const runner = await loadRunner();
    const harness = createHarness('darwin');
    const session = await runner.launchDevProcesses({ ...baseOptions, ...harness });
    const fakeProcess = new EventEmitter() as EventEmitter & { exitCode?: number };
    session.attachSignalHandlers(fakeProcess);
    fakeProcess.emit('SIGINT');
    await session.stop('await-signal-cleanup');
    expect(fakeProcess.exitCode).toBe(130);
    expect(harness.groupSignals).toHaveLength(2);
  });
});
