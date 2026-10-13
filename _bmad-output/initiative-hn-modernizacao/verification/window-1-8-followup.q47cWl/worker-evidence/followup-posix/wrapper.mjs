import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [readyFile, termFile] = process.argv.slice(2);
const grandchildFile = fileURLToPath(new URL('./grandchild.mjs', import.meta.url));
const grandchild = spawn(process.execPath, [grandchildFile, readyFile, termFile], {
  stdio: ['ignore', 'pipe', 'ignore'],
});
let stdout = '';
grandchild.stdout.setEncoding('utf8');
grandchild.stdout.on('data', (chunk) => {
  stdout += chunk;
  if (stdout.includes('GRANDCHILD_READY\n')) {
    process.stdout.write(`WRAPPER_READY:${grandchild.pid}\n`);
    process.exit(0);
  }
});
grandchild.once('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(3);
});
setTimeout(() => process.exit(4), 5_000).unref();
