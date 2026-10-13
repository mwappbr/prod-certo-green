#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const QA_ROOT = '/tmp/hn-final-platform-qa-20261012-f62d9b';
const FREEZE_CONFIRMATION = 'MAIN-AND-4.4-FROZEN';
const MAX_COMMAND_LOG_BYTES = 8 * 1024 * 1024;
const PROCESS_TERM_GRACE_MS = 2_000;
const PROCESS_KILL_GRACE_MS = 2_000;

process.umask(0o077);

function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 1) {
    const option = argv[index];
    if (!['--root', '--confirm-freeze'].includes(option)) {
      throw new Error(`Unknown or incomplete argument: ${option ?? '(missing)'}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Expected a value after ${option}.`);
    result[option.slice(2)] = value;
    index += 1;
  }
  if (!result.root) throw new Error('Required argument missing: --root');
  if (result['confirm-freeze'] !== FREEZE_CONFIRMATION) {
    throw new Error(`Refusing to run before the explicit freeze gate. After MAIN and 4.4 are frozen, pass --confirm-freeze ${FREEZE_CONFIRMATION}.`);
  }
  return result;
}

function assertRuntime() {
  if (process.versions.node.split('.')[0] !== '24') {
    throw new Error(`Run this QA runner with Node 24.x; current runtime is ${process.version}.`);
  }
  if (process.platform !== 'darwin') {
    throw new Error(`This bounded runner is prepared for the observed macOS host; current platform is ${process.platform}.`);
  }
}

function assertQaWorkspace() {
  const stat = fs.lstatSync(QA_ROOT);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('QA workspace must be a real directory, not a symlink.');
  if ((stat.mode & 0o077) !== 0) throw new Error('QA workspace permissions must remain private (0700).');
  const scriptsDir = path.join(QA_ROOT, 'scripts');
  const scriptsStat = fs.lstatSync(scriptsDir);
  if (!scriptsStat.isDirectory() || scriptsStat.isSymbolicLink()) throw new Error('QA scripts directory must be a real directory.');
}

function canonicalRoot(rootArgument) {
  const suppliedRoot = path.resolve(rootArgument);
  const realRoot = fs.realpathSync(suppliedRoot);
  if (suppliedRoot !== realRoot) throw new Error('Repository root must not resolve through a symlink.');
  for (const relative of ['package.json', 'Dockerfile', 'docker-compose.yml', '.dockerignore', 'client/index.html']) {
    const stat = fs.lstatSync(path.join(realRoot, relative));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Required source path is not a regular file: ${relative}`);
  }
  return realRoot;
}

function createRunEvidenceDirectory() {
  const runsDir = path.join(QA_ROOT, 'runs');
  if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { mode: 0o700 });
  const runsStat = fs.lstatSync(runsDir);
  if (!runsStat.isDirectory() || runsStat.isSymbolicLink() || (runsStat.mode & 0o077) !== 0) {
    throw new Error('Evidence parent must be a private, real directory.');
  }
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const runId = `run-${timestamp}-${process.pid}-${crypto.randomBytes(5).toString('hex')}`;
  const evidence = path.join(runsDir, runId);
  fs.mkdirSync(evidence, { mode: 0o700 });
  return { evidence, runId };
}

function assertNoViteDotenvFiles(root) {
  const clientRoot = path.join(root, 'client');
  const names = [
    '.env', '.env.local', '.env.production', '.env.production.local',
    '.env.development', '.env.development.local', '.env.test', '.env.test.local',
  ];
  const found = [];
  for (const name of names) {
    try {
      const stat = fs.lstatSync(path.join(clientRoot, name));
      found.push({ name, kind: stat.isSymbolicLink() ? 'symlink' : stat.isFile() ? 'file' : 'other' });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  if (found.length > 0) {
    const namesOnly = found.map((entry) => entry.name).join(', ');
    throw new Error(`Vite dotenv filename(s) exist under client/: ${namesOnly}. No file content was opened; failing closed without running Vite or a dotenv parser.`);
  }
}

function assertDockerIgnore(root) {
  const lines = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const required of ['**/.env', '**/.env.*', '!.env.example']) {
    if (!lines.includes(required)) throw new Error(`Required .dockerignore rule is absent: ${required}`);
  }
  return { envRule: '**/.env', envDotRule: '**/.env.*', exampleException: '!.env.example' };
}

function createLogWriter(filePath) {
  const fd = fs.openSync(filePath, 'wx', 0o600);
  let loggedBytes = 0;
  let truncated = false;
  return {
    write(chunk) {
      if (loggedBytes >= MAX_COMMAND_LOG_BYTES) {
        if (!truncated) {
          fs.writeSync(fd, Buffer.from('\n[log capped at 8 MiB; remaining child output drained but not persisted]\n'));
          truncated = true;
        }
        return;
      }
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      const remaining = MAX_COMMAND_LOG_BYTES - loggedBytes;
      const slice = buffer.length > remaining ? buffer.subarray(0, remaining) : buffer;
      fs.writeSync(fd, slice);
      loggedBytes += slice.length;
      if (slice.length < buffer.length && !truncated) {
        fs.writeSync(fd, Buffer.from('\n[log capped at 8 MiB; remaining child output drained but not persisted]\n'));
        truncated = true;
      }
    },
    close() {
      fs.closeSync(fd);
    },
  };
}

let interruptSignal = null;
let stopActiveCommand = null;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    interruptSignal = signal;
    if (stopActiveCommand) void stopActiveCommand(signal);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function signalOwnedProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function terminateOwnedProcessGroup(child, closePromise) {
  if (!child?.pid) return;
  try {
    signalOwnedProcessGroup(child.pid, 'SIGTERM');
  } catch {
    // Continue to the bounded SIGKILL attempt; the final command result records failure.
  }
  const closedAfterTerm = await Promise.race([
    closePromise.then(() => true, () => true),
    delay(PROCESS_TERM_GRACE_MS).then(() => false),
  ]);
  if (closedAfterTerm) return;
  try {
    signalOwnedProcessGroup(child.pid, 'SIGKILL');
  } catch {
    // ESRCH means the owned process group already exited.
  }
  await Promise.race([
    closePromise.then(() => true, () => true),
    delay(PROCESS_KILL_GRACE_MS).then(() => false),
  ]);
}

async function runCommand(command, args, options) {
  const {
    cwd,
    env,
    evidence,
    logName,
    timeoutMs,
    allowFailure = false,
    allowDuringShutdown = false,
  } = options;
  if (interruptSignal && !allowDuringShutdown) throw new Error(`Interrupted by ${interruptSignal} before ${logName}.`);
  const logPath = path.join(evidence, `${logName}.log`);
  const logger = createLogWriter(logPath);
  const header = `command=${JSON.stringify([command, ...args])}\ncwd=${cwd}\ntimeoutMs=${timeoutMs}\n\n`;
  logger.write(header);
  const stdoutChunks = [];
  let capturedBytes = 0;
  const maxCaptured = 2 * 1024 * 1024;
  let child;
  let timer;
  let timeoutHit = false;
  let interrupted = false;
  let closed = false;
  let stopPromise = null;

  const closePromise = new Promise((resolve, reject) => {
    try {
      child = spawn(command, args, {
        cwd,
        env,
        shell: false,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      reject(error);
      return;
    }
    child.once('error', reject);
    child.stdout.on('data', (chunk) => {
      logger.write(chunk);
      if (capturedBytes < maxCaptured) {
        const remaining = maxCaptured - capturedBytes;
        const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
        stdoutChunks.push(slice);
        capturedBytes += slice.length;
      }
    });
    child.stderr.on('data', (chunk) => logger.write(chunk));
    child.once('close', (code, signal) => {
      closed = true;
      resolve({ code, signal });
    });
  });

  const stop = (reason) => {
    interrupted ||= reason === 'SIGINT' || reason === 'SIGTERM';
    timeoutHit ||= reason === 'timeout';
    if (closed || !child?.pid) return Promise.resolve();
    if (!stopPromise) stopPromise = terminateOwnedProcessGroup(child, closePromise);
    return stopPromise;
  };
  stopActiveCommand = (signal) => stop(signal);
  timer = setTimeout(() => { void stop('timeout'); }, timeoutMs);
  let hardTimer;
  const hardDeadline = new Promise((_, reject) => {
    hardTimer = setTimeout(() => reject(new Error(`${logName} did not close after its bounded TERM/KILL cleanup window.`)), timeoutMs + PROCESS_TERM_GRACE_MS + PROCESS_KILL_GRACE_MS + 1_000);
  });

  let result;
  try {
    result = await Promise.race([closePromise, hardDeadline]);
  } catch (error) {
    if (child?.pid && !closed) await stop(timeoutHit ? 'timeout' : interruptSignal ?? 'timeout');
    throw error;
  } finally {
    clearTimeout(timer);
    clearTimeout(hardTimer);
    stopActiveCommand = null;
    logger.close();
  }

  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const commandResult = {
    command: [command, ...args],
    log: path.basename(logPath),
    exitCode: result.code,
    signal: result.signal,
    timedOut: timeoutHit,
    interrupted,
  };
  if (timeoutHit) throw Object.assign(new Error(`${logName} exceeded its ${timeoutMs}ms deadline; only its owned process group was signalled.`), { commandResult });
  if (interrupted) throw Object.assign(new Error(`${logName} interrupted by ${interruptSignal}; only its owned process group was signalled.`), { commandResult });
  if (result.code !== 0 && !allowFailure) {
    throw Object.assign(new Error(`${logName} exited with status ${result.code ?? result.signal}.`), { commandResult });
  }
  return { ...commandResult, stdout };
}

async function assertPortAvailable(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function chooseHostPort() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (!address || typeof address === 'string') continue;
    if (address.port === 3333) continue;
    await assertPortAvailable(address.port);
    return address.port;
  }
  throw new Error('Could not reserve a currently free loopback port other than 3333.');
}

function parseComposeConfig(raw, expectedPort) {
  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error('docker compose config --format json returned invalid JSON.');
  }
  const services = config.services ?? {};
  const serviceNames = Object.keys(services);
  if (serviceNames.length !== 1 || serviceNames[0] !== 'app') {
    throw new Error(`Expected only the app Compose service; got ${serviceNames.join(', ') || '(none)'}.`);
  }
  const app = services.app;
  if (app.environment?.NODE_ENV !== 'production' || String(app.environment?.PORT) !== '3000') {
    throw new Error('Resolved app environment differs from production PORT=3000 expectations.');
  }
  if ((app.volumes ?? []).length > 0) throw new Error('Compose declares a volume; refusing a run with persistent or user-volume cleanup ambiguity.');
  const ports = app.ports ?? [];
  if (ports.length !== 1) throw new Error(`Expected one published app port; got ${ports.length}.`);
  const port = ports[0];
  if (Number(port.target) !== 3000 || String(port.published) !== String(expectedPort) || port.host_ip !== '127.0.0.1') {
    throw new Error('Compose port mapping is not the selected loopback-only host port to container port 3000.');
  }
  return { service: 'app', containerPort: 3000, hostPort: expectedPort, hostIp: '127.0.0.1', volumeCount: 0 };
}

async function ensureProjectEmpty(project, common, options) {
  const containerResult = await runCommand('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`], {
    ...options, logName: 'preflight-project-containers', timeoutMs: 8_000,
  });
  const volumeResult = await runCommand('docker', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`], {
    ...options, logName: 'preflight-project-volumes', timeoutMs: 8_000,
  });
  const networkResult = await runCommand('docker', ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`], {
    ...options, logName: 'preflight-project-networks', timeoutMs: 8_000,
  });
  if ([containerResult.stdout, volumeResult.stdout, networkResult.stdout].some((output) => output.trim().length > 0)) {
    throw new Error('The randomly generated Compose project name already has Docker resources; refusing to inspect or remove them.');
  }
  const imageCheck = await runCommand('docker', ['image', 'inspect', `${project}-app`], {
    ...options, logName: 'preflight-project-image', timeoutMs: 8_000, allowFailure: true,
  });
  if (imageCheck.exitCode === 0) throw new Error('The randomly generated Compose app image tag already exists; refusing to reuse it.');
  void common;
}

async function dockerignoreSentinelProbe(root, project, options, summary) {
  const fakeContext = path.join(options.evidence, 'dockerignore-synthetic-context');
  fs.mkdirSync(fakeContext, { mode: 0o700 });
  fs.copyFileSync(path.join(root, '.dockerignore'), path.join(fakeContext, '.dockerignore'), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(fakeContext, '.env'), 'SYNTHETIC_SENTINEL_ONLY=not-a-secret\n', { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(fakeContext, '.env.qa-sentinel'), 'SYNTHETIC_SENTINEL_ONLY=not-a-secret\n', { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(path.join(fakeContext, '.env.example'), 'SYNTHETIC_SENTINEL_ONLY=example\n', { flag: 'wx', mode: 0o600 });

  const exampleDockerfile = path.join(fakeContext, 'Dockerfile.example');
  fs.writeFileSync(exampleDockerfile, 'FROM scratch\nCOPY .env.example /synthetic-env-example\n', { flag: 'wx', mode: 0o600 });
  const exampleTag = `${project}-env-example-probe:local`;
  summary.ownedProbeImages.push(exampleTag);
  const exampleBuild = await runCommand('docker', [
    'build', '--network=none', '--pull=false', '--no-cache', '--file', exampleDockerfile, '--tag', exampleTag, fakeContext,
  ], { ...options, logName: 'dockerignore-example-sentinel-build', timeoutMs: 45_000 });
  summary.commands.push(exampleBuild);

  const ignoredDockerfiles = [
    { name: 'Dockerfile.env', source: '.env' },
    { name: 'Dockerfile.env-pattern', source: '.env.qa-sentinel' },
  ];
  for (const fixture of ignoredDockerfiles) {
    fs.writeFileSync(path.join(fakeContext, fixture.name), `FROM scratch\nCOPY ${fixture.source} /synthetic-forbidden\n`, { flag: 'wx', mode: 0o600 });
    const probeTag = `${project}-${fixture.source.slice(1).replaceAll('.', '-')}-probe:local`;
    summary.ownedProbeImages.push(probeTag);
    const check = await runCommand('docker', [
      'build', '--network=none', '--pull=false', '--no-cache', '--file', path.join(fakeContext, fixture.name),
      '--tag', probeTag, fakeContext,
    ], { ...options, logName: `dockerignore-${fixture.source.slice(1).replaceAll('.', '-')}-sentinel-build`, timeoutMs: 45_000, allowFailure: true });
    summary.commands.push(check);
    if (check.exitCode === 0) throw new Error(`Synthetic build unexpectedly included excluded sentinel ${fixture.source}.`);
    const logText = fs.readFileSync(path.join(options.evidence, check.log), 'utf8');
    if (!new RegExp(`${fixture.source.replaceAll('.', '\\.')}.{0,180}(not found|checksum|no such file)|(?:not found|checksum|no such file).{0,180}${fixture.source.replaceAll('.', '\\.')}`, 'is').test(logText)) {
      throw new Error(`Synthetic build failed for ${fixture.source}, but the log did not confirm an excluded/missing context file.`);
    }
  }
  summary.dockerignoreSentinels = {
    result: 'passed',
    context: path.basename(fakeContext),
    syntheticFilesOnly: ['.env', '.env.qa-sentinel', '.env.example'],
    exampleExceptionBuildSucceeded: true,
    ignoredEnvBuildsFailedAsExpected: true,
    realEnvFilesOpened: false,
    note: 'Uses the source .dockerignore in a synthetic context; does not inspect or copy any repository .env file.',
  };
}

async function waitForHealth(baseUrl, options, summary) {
  const deadline = Date.now() + 90_000;
  let lastResult = 'not attempted';
  while (Date.now() < deadline) {
    if (interruptSignal) throw new Error(`Interrupted by ${interruptSignal} while waiting for local health.`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_500);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: controller.signal, redirect: 'error' });
      lastResult = `HTTP ${response.status}`;
      if (response.ok) {
        summary.health = { status: response.status, endpoint: `${baseUrl}/api/health` };
        return;
      }
    } catch (error) {
      lastResult = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
    await delay(1_500);
  }
  throw new Error(`Local /api/health did not become ready within 90000ms (last result: ${lastResult.slice(0, 160)}).`);
}

async function cleanupProject(common, options, summary) {
  if (!options.composeMayOwnResources) return;
  const down = await runCommand('docker', [...common, 'down', '--timeout', '10', '--rmi', 'local'], {
    ...options, logName: 'cleanup-compose-owned-project', timeoutMs: 30_000, allowDuringShutdown: true,
  });
  summary.commands.push(down);
  summary.cleanup = { composeDown: 'passed', volumesRemoved: false, scope: summary.project };
  const remaining = await runCommand('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${summary.project}`], {
    ...options, logName: 'cleanup-verify-owned-containers', timeoutMs: 8_000, allowDuringShutdown: true,
  });
  if (remaining.stdout.trim()) {
    summary.cleanup.composeDown = 'incomplete';
    summary.cleanup.remainingOwnedContainerIds = remaining.stdout.trim().split(/\s+/);
    throw new Error('Owned Compose containers remain after scoped down; no broader cleanup was attempted.');
  }
}

async function main() {
  assertRuntime();
  assertQaWorkspace();
  const args = parseArgs(process.argv);
  const root = canonicalRoot(args.root);
  const { evidence, runId } = createRunEvidenceDirectory();
  const summary = {
    runId,
    startedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    root,
    evidence,
    freezeConfirmation: 'explicit CLI gate supplied',
    project: null,
    hostPort: null,
    commands: [],
    ownedProbeImages: [],
    dockerEndpointKind: null,
    dockerignoreSentinels: null,
    health: null,
    browser: null,
    cleanup: { status: 'not-needed', volumesRemoved: false },
    realEnvFilesOpened: false,
    status: 'running',
  };
  const options = { cwd: root, env: { ...process.env }, evidence, composeMayOwnResources: false };
  let common = null;
  let stage = 'preflight';

  try {
    assertNoViteDotenvFiles(root);
    summary.dockerignoreRules = assertDockerIgnore(root);
    const dockerignoreContent = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
    if (dockerignoreContent.includes('\r')) throw new Error('.dockerignore contains CR characters; refusing ambiguous sentinel comparison.');

    const suffix = crypto.randomBytes(6).toString('hex');
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12).toLowerCase();
    const project = `hnqa-${stamp}-${process.pid}-${suffix}`.toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(project)) throw new Error('Generated Compose project name was not valid.');
    summary.project = project;
    const hostPort = await chooseHostPort();
    summary.hostPort = hostPort;
    options.env.HOST_PORT = `127.0.0.1:${hostPort}`;
    options.env.COMPOSE_PROJECT_NAME = project;
    options.env.COMPOSE_DISABLE_ENV_FILE = '1';
    const hostPortString = String(hostPort);
    common = ['compose', '--env-file', '/dev/null', '--project-directory', root, '--file', path.join(root, 'docker-compose.yml'), '--project-name', project];

    const composeVersion = await runCommand('docker', ['compose', 'version', '--short'], {
      ...options, logName: 'preflight-compose-version', timeoutMs: 8_000,
    });
    summary.commands.push(composeVersion);
    const dockerVersion = await runCommand('docker', ['version', '--format', '{{.Client.Version}}'], {
      ...options, logName: 'preflight-docker-client-version', timeoutMs: 8_000,
    });
    summary.commands.push(dockerVersion);
    const contextResult = await runCommand('docker', ['context', 'show'], {
      ...options, logName: 'preflight-docker-context', timeoutMs: 8_000,
    });
    summary.commands.push(contextResult);
    const dockerContext = contextResult.stdout.trim();
    if (!dockerContext || /\s/.test(dockerContext)) throw new Error('Docker returned an invalid active context name.');
    const endpointResult = await runCommand('docker', ['context', 'inspect', dockerContext, '--format', '{{.Endpoints.docker.Host}}'], {
      ...options, logName: 'preflight-docker-context-endpoint', timeoutMs: 8_000,
    });
    summary.commands.push(endpointResult);
    if (!endpointResult.stdout.trim().startsWith('unix://')) {
      throw new Error('The active Docker context is not a local Unix socket; refusing remote builders/contexts.');
    }
    summary.dockerEndpointKind = 'local-unix-socket';
    const dockerInfo = await runCommand('docker', ['info', '--format', '{{.ServerVersion}}'], {
      ...options, logName: 'preflight-docker-daemon', timeoutMs: 12_000,
    });
    summary.commands.push(dockerInfo);
    const builder = await runCommand('docker', ['buildx', 'inspect'], {
      ...options, logName: 'preflight-buildx-builder', timeoutMs: 12_000,
    });
    summary.commands.push(builder);
    if (!/^Driver:\s*docker\s*$/m.test(builder.stdout)) {
      throw new Error('The active Buildx builder is not the local Docker Engine driver; refusing remote or docker-container builders.');
    }

    const fakeTags = [
      `${project}-env-example-probe:local`,
      `${project}-env-probe:local`,
      `${project}-env-qa-sentinel-probe:local`,
    ];
    for (const tag of fakeTags) {
      const check = await runCommand('docker', ['image', 'inspect', tag], {
        ...options, logName: `preflight-tag-${fakeTags.indexOf(tag)}`, timeoutMs: 8_000, allowFailure: true,
      });
      if (check.exitCode === 0) throw new Error('A random synthetic-sentinel image tag already exists; refusing to reuse it.');
    }
    await ensureProjectEmpty(project, common, options);
    await assertPortAvailable(hostPort);
    const configResult = await runCommand('docker', [...common, 'config', '--format', 'json'], {
      ...options, logName: 'preflight-compose-config', timeoutMs: 12_000,
    });
    summary.commands.push(configResult);
    summary.composeConfig = parseComposeConfig(configResult.stdout, hostPortString);
    stage = 'dockerignore-synthetic-sentinel-proof';
    await dockerignoreSentinelProbe(root, project, options, summary);

    stage = 'local-compose-build';
    options.composeMayOwnResources = true;
    const build = await runCommand('docker', [...common, 'build', '--no-cache', '--pull=false', '--progress', 'plain', 'app'], {
      ...options, logName: 'compose-fresh-local-build', timeoutMs: 360_000,
    });
    summary.commands.push(build);

    stage = 'compose-start-and-health';
    const up = await runCommand('docker', [...common, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '90', 'app'], {
      ...options, logName: 'compose-up-healthcheck', timeoutMs: 110_000,
    });
    summary.commands.push(up);
    const baseUrl = `http://127.0.0.1:${hostPort}`;
    await waitForHealth(baseUrl, options, summary);

    stage = 'public-browser-smoke';
    const browserEvidence = path.join(evidence, 'browser');
    fs.mkdirSync(browserEvidence, { mode: 0o700 });
    const driver = path.join(QA_ROOT, 'scripts', 'browser-public-smoke.cjs');
    const browserRun = await runCommand(process.execPath, [
      driver,
      '--root', root,
      '--base-url', baseUrl,
      '--evidence-dir', browserEvidence,
    ], { ...options, logName: 'browser-driver-process', timeoutMs: 330_000 });
    summary.commands.push(browserRun);
    summary.browser = { status: 'passed', summary: path.join(browserEvidence, 'browser-summary.json'), screenshotsDirectory: browserEvidence };
    summary.status = 'passed';
  } catch (error) {
    summary.status = stage === 'preflight' || stage === 'dockerignore-synthetic-sentinel-proof' ? 'blocked' : 'failed';
    summary.failedAt = stage;
    summary.failure = error instanceof Error ? error.message : String(error);
    if (error?.commandResult) summary.failedCommand = error.commandResult;
    if (interruptSignal) summary.interruptedBy = interruptSignal;
    if (options.composeMayOwnResources && common && summary.project) {
      try {
        const logs = await runCommand('docker', [...common, 'logs', '--no-color', '--tail', '200', 'app'], {
          ...options, logName: 'failure-compose-app-logs', timeoutMs: 15_000, allowFailure: true,
        });
        summary.commands.push(logs);
      } catch (logError) {
        summary.failureComposeLogs = logError instanceof Error ? logError.message : String(logError);
      }
    }
  } finally {
    if (common && options.composeMayOwnResources && summary.project) {
      try {
        await cleanupProject(common, options, summary);
      } catch (error) {
        summary.status = 'failed';
        summary.cleanup = { ...(summary.cleanup ?? {}), status: 'failed', error: error instanceof Error ? error.message : String(error), broaderCleanupAttempted: false };
      }
    }
    for (const tag of summary.ownedProbeImages) {
      try {
        const removed = await runCommand('docker', ['image', 'rm', tag], {
          ...options, logName: `cleanup-${tag.split(':')[0]}`, timeoutMs: 12_000, allowFailure: true, allowDuringShutdown: true,
        });
        summary.commands.push(removed);
        if (removed.exitCode !== 0) {
          const inspection = await runCommand('docker', ['image', 'inspect', tag], {
            ...options, logName: `cleanup-verify-${tag.split(':')[0]}`, timeoutMs: 8_000, allowFailure: true, allowDuringShutdown: true,
          });
          summary.commands.push(inspection);
          const inspectLog = fs.readFileSync(path.join(evidence, inspection.log), 'utf8');
          if (inspection.exitCode === 0 || !/no such image/i.test(inspectLog)) {
            throw new Error(`Could not prove removal or absence of synthetic image ${tag}; no broader image cleanup was attempted.`);
          }
        }
        summary.cleanup.probeImagesRemoved ??= [];
        summary.cleanup.probeImagesRemoved.push(tag);
      } catch (error) {
        summary.status = 'failed';
        summary.cleanup = { ...(summary.cleanup ?? {}), status: 'failed', probeImage: tag, error: error instanceof Error ? error.message : String(error), broaderCleanupAttempted: false };
      }
    }
    summary.finishedAt = new Date().toISOString();
    const summaryPath = path.join(evidence, 'run-summary.json');
    try {
      fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      summary.status = 'failed';
      summary.failure = `Could not persist run summary: ${error instanceof Error ? error.message : String(error)}`;
    }
    process.stdout.write(`${JSON.stringify({ status: summary.status, failedAt: summary.failedAt ?? null, project: summary.project, hostPort: summary.hostPort, evidence: summaryPath })}\n`);
  }

  if (interruptSignal) process.exitCode = interruptSignal === 'SIGINT' ? 130 : 143;
  else if (summary.status !== 'passed') process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}\n`);
  process.exitCode = 2;
});
