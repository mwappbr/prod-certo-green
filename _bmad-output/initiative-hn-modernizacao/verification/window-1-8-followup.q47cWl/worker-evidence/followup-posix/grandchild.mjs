import { writeFileSync } from 'node:fs';

const [readyFile, termFile] = process.argv.slice(2);
if (!readyFile || !termFile) throw new Error('readyFile and termFile are required');

process.on('SIGTERM', () => {
  writeFileSync(termFile, String(process.pid));
});

writeFileSync(readyFile, String(process.pid));
process.stdout.write('GRANDCHILD_READY\n');
setInterval(() => {}, 60_000);
