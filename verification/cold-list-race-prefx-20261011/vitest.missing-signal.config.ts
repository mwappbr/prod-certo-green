import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const targetFile = resolve(repoRoot, 'server/test/stories-route.test.ts');
const signalCall = '        if (listCallerCount === 2) signalBothListCallers();';
const barrierDeadline = '            4_000,';

const missingSignalProbe = {
  name: 'isolated-missing-barrier-signal-cleanup-probe',
  enforce: 'pre' as const,
  transform(source: string, id: string) {
    const filePath = resolve(id.replace(/\?.*$/, ''));
    if (filePath !== targetFile) return null;

    const signalMatches = source.split(signalCall).length - 1;
    const deadlineMatches = source.split(barrierDeadline).length - 1;
    if (signalMatches !== 1 || deadlineMatches !== 1) {
      throw new Error(
        `Expected one barrier signal and deadline in ${targetFile}; found signal=${signalMatches}, deadline=${deadlineMatches}.`,
      );
    }

    const withoutSignal = source.replace(
      signalCall,
      '        if (listCallerCount === 2) { /* intentionally suppressed by cleanup probe */ }',
    );
    const transformed = withoutSignal.replace(barrierDeadline, '            100,');
    if (transformed === source) {
      throw new Error(`The missing-signal probe did not change ${targetFile}.`);
    }

    console.log(
      `[isolated-missing-signal-probe] Transformed only ${targetFile}; exact signal/deadline match counts: ${signalMatches}/${deadlineMatches}.`,
    );
    return { code: transformed, map: null };
  },
};

export default mergeConfig(
  rootConfig,
  defineConfig({ plugins: [missingSignalProbe] }),
);
