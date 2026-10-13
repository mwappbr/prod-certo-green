import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createProcessSupervisor } from '/Users/maurowidman/Projects/AI/prod-certo-green/scripts/dev.mjs';

assert.equal(process.platform, 'darwin', 'This fixture is only for the approved POSIX/macOS probe.');
const fixtureDir = fileURLToPath(new URL('./', import.meta.url));
const wrapperFile = fileURLToPath(new URL('./wrapper.mjs', import.meta.url));
const readyFile = fileURLToPath(new URL('./grandchild.ready', import.meta.url));
const termFile = fileURLToPath(new URL('./grandchild.term', import.meta.url));
let wrapperPid;
let wrapperExit;
let supervisor;
let child;
const groupSignals = [];

function groupExists(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitUntilGroupGone(pgid, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!groupExists(pgid)) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 40));
  }
  return !groupExists(pgid);
}

async function waitForReady(output, timeoutMs = 5_000) {
  return new Promise((resolveReady, rejectReady) => {
    let buffer = '';
    const timer = setTimeout(() => rejectReady(new Error('Wrapper did not report grandchild readiness.')), timeoutMs);
    output.setEncoding('utf8');
    output.on('data', (chunk) => {
      buffer += chunk;
      const match = buffer.match(/WRAPPER_READY:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolveReady(Number(match[1]));
      }
    });
  });
}

try {
  supervisor = createProcessSupervisor({
    platform: 'darwin',
    timeoutMs: 300,
    forceTimeoutMs: 2_000,
    signalGroup: (pid, signal) => {
      groupSignals.push({ pid, signal });
      process.kill(pid, signal);
    },
    onChildExit: (exit) => { wrapperExit = exit; },
    onCleanupError: (error) => { process.stderr.write(`cleanup-error: ${error.message}\n`); },
  });
  child = supervisor.start('owned-grandchild-fixture', process.execPath, [wrapperFile, readyFile, termFile], {
    spawnChild: spawn,
    spawnOptions: {
      cwd: fixtureDir,
      detached: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  });
  wrapperPid = child.pid;
  if (!Number.isInteger(wrapperPid) || wrapperPid <= 0) throw new Error('Owned wrapper PID was unavailable.');
  const readyPromise = waitForReady(child.stdout);
  const exitPromise = new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
  const grandchildPid = await readyPromise;
  const exitInfo = await exitPromise;
  await supervisor.stop('join-after-wrapper-exit');
  const termMarker = await readFile(termFile, 'utf8');
  const groupGone = await waitUntilGroupGone(wrapperPid);
  assert.equal(exitInfo.code, 0, 'Wrapper should exit before the stubborn grandchild.');
  assert.ok(Number(termMarker) === grandchildPid, 'Grandchild should receive SIGTERM and record its own PID.');
  assert.equal(wrapperExit?.code, 0, 'Supervisor should observe the wrapper exit.');
  assert.equal(groupGone, true, 'Owned process group should be gone after bounded SIGKILL escalation.');
  console.log(JSON.stringify({
    event: 'posix-grandchild-cleanup',
    node: process.version,
    wrapperPid,
    wrapperExit: exitInfo,
    grandchildPid,
    termHandlerObserved: Number(termMarker) === grandchildPid,
    groupSignals,
    groupGone,
    result: 'PASS',
  }));
} finally {
  if (Number.isInteger(wrapperPid) && groupExists(wrapperPid)) {
    try { process.kill(-wrapperPid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    await waitUntilGroupGone(wrapperPid, 1_000);
  }
}
