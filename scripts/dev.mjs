import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const GRACEFUL_TIMEOUT_MS = 1_500;
const FORCE_TIMEOUT_MS = 1_500;
const PROCESS_GROUP_POLL_MS = 25;
const TASKKILL_HELPER_KILL_TIMEOUT_MS = 250;
const TASKKILL_HELPER_FORCE_TIMEOUT_MS = 250;

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function probeOwnedProcessGroup(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw new Error(`Não foi possível verificar o grupo de processo próprio ${pgid}: ${error.code ?? error.message}.`, { cause: error });
  }
}

function waitForChildExit(record, timeoutMs) {
  if (record.exited || record.child.exitCode != null || record.child.signalCode != null) {
    return Promise.resolve(true);
  }

  return new Promise((resolveWait) => {
    let timer;
    const finish = (exited) => {
      clearTimeout(timer);
      record.child.off('exit', onExit);
      resolveWait(exited);
    };
    const onExit = () => {
      record.exited = true;
      finish(true);
    };
    timer = setTimeout(() => finish(record.exited || record.child.exitCode != null || record.child.signalCode != null), timeoutMs);
    record.child.once('exit', onExit);
  });
}

async function waitForProcessGroupExit(record, probeGroup, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      if (!probeGroup(record.child.pid)) {
        record.closed = true;
        return true;
      }
    } catch (error) {
      if (error?.code === 'ESRCH') {
        record.closed = true;
        return true;
      }
      throw error;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) return false;
    await delay(Math.min(PROCESS_GROUP_POLL_MS, remaining));
  }
}

function aggregateCleanupErrors(errors, message) {
  if (errors.length === 1) return errors[0];
  return new AggregateError(errors, message);
}

export function createWindowsTreeTerminator(
  pid,
  force,
  timeoutMs = force ? FORCE_TIMEOUT_MS : GRACEFUL_TIMEOUT_MS,
  {
    spawnTerminator = spawn,
    killTimeoutMs = TASKKILL_HELPER_KILL_TIMEOUT_MS,
    forceKillTimeoutMs = TASKKILL_HELPER_FORCE_TIMEOUT_MS,
  } = {},
) {
  const args = ['/PID', String(pid), '/T'];
  if (force) args.push('/F');

  return new Promise((resolveTerminator, rejectTerminator) => {
    let terminator;
    let timeoutTimer;
    let killTimer;
    let forceKillTimer;
    let timedOut = false;
    let settled = false;
    const helperErrors = [];
    const timeoutError = (message = `taskkill.exe timeout ao encerrar a árvore do PID próprio ${pid}.`) => {
      const error = new Error(message);
      if (helperErrors.length > 0) {
        error.cause = new AggregateError(helperErrors, 'Erros ao encerrar o helper taskkill próprio.');
      }
      return error;
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      clearTimeout(killTimer);
      clearTimeout(forceKillTimer);
      if (error) rejectTerminator(error);
      else resolveTerminator();
    };
    const terminateHelper = (signal) => {
      try {
        if (terminator) terminator.kill(signal);
      } catch {
        // The bounded close wait below reports failure if our helper will not exit.
      }
    };

    try {
      terminator = spawnTerminator('taskkill.exe', args, {
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch (error) {
      rejectTerminator(error);
      return;
    }

    terminator.once('error', (error) => {
      if (timedOut) {
        helperErrors.push(error);
        return;
      }
      finish(error);
    });
    terminator.once('close', (code, signal) => {
      if (timedOut) {
        finish(timeoutError());
      } else if (code === 0) {
        finish();
      } else {
        finish(new Error(`taskkill terminou com code=${code}, signal=${signal ?? 'none'}.`));
      }
    });

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      terminateHelper();
      killTimer = setTimeout(() => {
        terminateHelper('SIGKILL');
        forceKillTimer = setTimeout(() => {
          finish(timeoutError(`taskkill.exe não encerrou após timeout e sinalização do PID próprio ${terminator.pid ?? 'desconhecido'}.`));
        }, forceKillTimeoutMs);
      }, killTimeoutMs);
    }, timeoutMs);
  });
}

export function createProcessSupervisor({
  platform = process.platform,
  signalGroup = (pid, signal) => process.kill(pid, signal),
  probeGroup = probeOwnedProcessGroup,
  spawnTaskkill = createWindowsTreeTerminator,
  timeoutMs = GRACEFUL_TIMEOUT_MS,
  forceTimeoutMs = FORCE_TIMEOUT_MS,
  onChildError = () => {},
  onChildExit = () => {},
  onCleanupError = () => {},
} = {}) {
  const records = [];
  let stopping = false;
  let stopPromise;

  async function boundedTaskkill(pid, force, budgetMs) {
    let timer;
    const hardDeadlineMs = budgetMs + (2 * TASKKILL_HELPER_KILL_TIMEOUT_MS) + 50;
    const operation = Promise.resolve().then(() => spawnTaskkill(pid, force, budgetMs));
    const deadline = new Promise((resolveDeadline, rejectDeadline) => {
      timer = setTimeout(() => rejectDeadline(
        new Error(`taskkill.exe não respondeu dentro do prazo para PID próprio ${pid} (${force ? '/F' : 'graceful'}).`),
      ), hardDeadlineMs);
    });
    try {
      await Promise.race([operation, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function terminatePosixGroup(record, pid) {
    const failures = [];
    try {
      signalGroup(-pid, 'SIGTERM');
    } catch (error) {
      if (error?.code === 'ESRCH') {
        record.closed = true;
        return;
      }
      failures.push(error);
    }

    let drained = false;
    try {
      drained = await waitForProcessGroupExit(record, probeGroup, timeoutMs);
    } catch (error) {
      failures.push(error);
    }
    if (drained) {
      if (failures.length > 0) throw aggregateCleanupErrors(failures, `Falha no SIGTERM do grupo próprio ${pid}.`);
      return;
    }

    try {
      signalGroup(-pid, 'SIGKILL');
    } catch (error) {
      if (error?.code === 'ESRCH') {
        record.closed = true;
      } else {
        failures.push(error);
      }
    }

    try {
      drained = record.closed || await waitForProcessGroupExit(record, probeGroup, forceTimeoutMs);
    } catch (error) {
      failures.push(error);
      drained = false;
    }
    if (!drained) {
      failures.push(new Error(`Grupo de processo próprio ${pid} permaneceu ativo ou não verificável após SIGKILL e prazo limitado.`));
    }
    if (failures.length > 0) {
      throw aggregateCleanupErrors(failures, `Falha ao encerrar o grupo próprio ${pid}.`);
    }
  }

  async function terminateWindowsTree(record, pid) {
    const gracefulErrors = [];
    let gracefulCommandSucceeded = false;
    try {
      await boundedTaskkill(pid, false, timeoutMs);
      gracefulCommandSucceeded = true;
    } catch (error) {
      gracefulErrors.push(error);
    }
    if (gracefulCommandSucceeded && await waitForChildExit(record, timeoutMs)) {
      record.closed = true;
      return;
    }

    const forceErrors = [];
    let forceCommandSucceeded = false;
    try {
      await boundedTaskkill(pid, true, forceTimeoutMs);
      forceCommandSucceeded = true;
    } catch (error) {
      forceErrors.push(error);
    }
    const childExited = await waitForChildExit(record, forceTimeoutMs);
    if (forceCommandSucceeded && childExited) {
      record.closed = true;
      return;
    }
    if (!childExited) {
      forceErrors.push(new Error(`Árvore própria ancorada no PID ${pid} não encerrou após taskkill /T /F e prazo limitado.`));
    }
    throw aggregateCleanupErrors([...gracefulErrors, ...forceErrors], `Falha no cleanup Windows do PID próprio ${pid}.`);
  }

  async function terminateRecord(record) {
    if (record.closed) return;
    const pid = record.child.pid;
    if (!Number.isInteger(pid) || pid <= 0) {
      if (record.exited) {
        record.closed = true;
        return;
      }
      throw new Error(`Não foi possível encerrar filho próprio sem PID válido (${record.label}).`);
    }

    if (platform === 'win32') {
      await terminateWindowsTree(record, pid);
    } else {
      await terminatePosixGroup(record, pid);
    }
  }

  function stop(reason = 'stop-request') {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopPromise = Promise.allSettled(records.map(terminateRecord)).then((results) => {
      const failures = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);
      if (failures.length > 0) {
        throw new AggregateError(failures, `Falha ao limpar processos próprios (${reason}).`);
      }
    });
    return stopPromise;
  }

  function start(label, executable, args, options) {
    if (stopping) throw new Error('O supervisor já está encerrando; nenhum filho novo será iniciado.');
    const child = options.spawnChild(executable, args, options.spawnOptions);
    const record = { label, child, exited: false, closed: false };
    records.push(record);
    child.once('error', (error) => {
      if (!Number.isInteger(child.pid) || child.pid <= 0) {
        record.exited = true;
        record.closed = true;
      }
      onChildError(error, label);
      void stop(`${label}-spawn-error`).catch((cleanupError) => onCleanupError(cleanupError, label, 'cleanup'));
    });
    child.once('exit', (code, signal) => {
      record.exited = true;
      if (!stopping) {
        onChildExit({ label, code, signal });
        void stop(`${label}-exit`).catch((cleanupError) => onCleanupError(cleanupError, label, 'cleanup'));
      }
    });
    return child;
  }

  return {
    start,
    stop,
    get children() {
      return records.map(({ label, child }) => ({ label, child }));
    },
  };
}

export async function launchDevProcesses({
  env = process.env,
  processExecPath = process.execPath,
  npmExecPath = env.npm_execpath,
  cwd = ROOT,
  platform = process.platform,
  spawnChild = spawn,
  signalGroup,
  probeGroup,
  spawnTaskkill,
  timeoutMs = GRACEFUL_TIMEOUT_MS,
  forceTimeoutMs = FORCE_TIMEOUT_MS,
  processLike = process,
} = {}) {
  const centralConfig = await import('./dev-platform-config.mjs');
  const validated = env === process.env
    ? { port: centralConfig.PORT }
    : centralConfig.loadConfig(env);
  if (typeof npmExecPath !== 'string' || npmExecPath.trim() === '') {
    throw new Error('npm_execpath ausente; execute este launcher por um script npm.');
  }

  const npmCli = resolve(npmExecPath);
  const childEnv = { ...env, PORT: String(validated.port) };
  const supervisor = createProcessSupervisor({
    platform,
    signalGroup: signalGroup ?? ((pid, signal) => process.kill(pid, signal)),
    probeGroup: probeGroup ?? probeOwnedProcessGroup,
    spawnTaskkill: spawnTaskkill ?? createWindowsTreeTerminator,
    timeoutMs,
    forceTimeoutMs,
    onChildError: (error, label) => {
      processLike.exitCode = 1;
      processLike.stderr?.write(`Falha ao iniciar o filho ${label}: ${error.message}\n`);
    },
    onChildExit: ({ label, code, signal }) => {
      processLike.exitCode = 1;
      processLike.stderr?.write(`Filho ${label} encerrou inesperadamente (code=${code}, signal=${signal ?? 'none'}); encerrando o outro filho próprio.\n`);
    },
    onCleanupError: (error, label, signal) => {
      processLike.exitCode = 1;
      processLike.stderr?.write(`Falha no encerramento ${signal ?? 'cleanup'} de ${label ?? 'processo próprio'}: ${error.message}\n`);
    },
  });

  const spawnOptions = {
    cwd,
    env: childEnv,
    shell: false,
    detached: platform !== 'win32',
    stdio: 'inherit',
    windowsHide: false,
  };
  const argsFor = (workspace) => [npmCli, 'run', 'dev', '-w', workspace];

  try {
    supervisor.start('@hn/server', processExecPath, argsFor('@hn/server'), {
      spawnChild,
      spawnOptions,
    });
    supervisor.start('@hn/client', processExecPath, argsFor('@hn/client'), {
      spawnChild,
      spawnOptions,
    });
  } catch (error) {
    await supervisor.stop('spawn-threw').catch((cleanupError) => {
      throw new AggregateError([error, cleanupError], 'Falha ao iniciar e limpar filhos próprios.');
    });
    throw error;
  }

  function attachSignalHandlers(target = processLike) {
    const exitCodes = new Map([['SIGINT', 130], ['SIGTERM', 143]]);
    const handlers = new Map();
    for (const [signal, exitCode] of exitCodes) {
      const handler = () => {
        target.exitCode = exitCode;
        void supervisor.stop(`parent-${signal}`).catch((error) => {
          target.exitCode = 1;
          target.stderr?.write(`Falha no cleanup após ${signal}: ${error.message}\n`);
        });
      };
      handlers.set(signal, handler);
      target.on(signal, handler);
    }
    return () => {
      for (const [signal, handler] of handlers) target.off(signal, handler);
    };
  }

  return {
    children: supervisor.children,
    stop: supervisor.stop,
    attachSignalHandlers,
  };
}

function isMainModule() {
  return process.argv[1] !== undefined
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  launchDevProcesses()
    .then((session) => session.attachSignalHandlers())
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
