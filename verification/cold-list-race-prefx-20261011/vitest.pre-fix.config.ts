import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const targetFile = resolve(repoRoot, 'server/src/app/get-stories.ts');

const freshEntryRecheck = [
  '        const concurrentlyCachedList = dependencies.cache.get<number[]>(key);',
  '        if (concurrentlyCachedList) {',
  '          ids = concurrentlyCachedList.value;',
  '          listCachedAt = concurrentlyCachedList.cachedAt;',
  '        } else {',
  '          const stored = dependencies.cache.set(',
  '            key,',
  '            fetchedIds,',
  '            dependencies.listCacheTtlMs,',
  '          );',
  '          ids = stored.value;',
  '          listCachedAt = stored.cachedAt;',
  '        }',
].join('\n');

const preFixPublication = [
  '        const stored = dependencies.cache.set(',
  '          key,',
  '          fetchedIds,',
  '          dependencies.listCacheTtlMs,',
  '        );',
  '        ids = stored.value;',
  '        listCachedAt = stored.cachedAt;',
].join('\n');

const preFixTransform = {
  name: 'isolated-pre-fix-get-stories-race-probe',
  enforce: 'pre' as const,
  transform(source: string, id: string) {
    const filePath = resolve(id.replace(/\?.*$/, ''));
    if (filePath !== targetFile) return null;

    const matches = source.split(freshEntryRecheck).length - 1;
    if (matches !== 1) {
      throw new Error(
        `Expected exactly one fresh-entry recheck in ${targetFile}, found ${matches}; refusing isolated probe transformation.`,
      );
    }

    const transformed = source.replace(freshEntryRecheck, preFixPublication);
    if (transformed === source) {
      throw new Error(`The isolated pre-fix transformation did not change ${targetFile}.`);
    }

    console.log(
      `[isolated-pre-fix-probe] Transformed only ${targetFile}; exact fresh-entry recheck match count: ${matches}.`,
    );
    return { code: transformed, map: null };
  },
};

export default mergeConfig(
  rootConfig,
  defineConfig({ plugins: [preFixTransform] }),
);
