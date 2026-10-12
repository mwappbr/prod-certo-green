import { defineConfig } from 'vitest/config';

const extensions = '{js,mjs,cjs,ts,mts,cts,jsx,tsx}';
const workspaces = ['shared', 'server', 'client'];
const include = workspaces.flatMap((workspace) => [
  `${workspace}/**/*.test.${extensions}`,
  `${workspace}/**/*.spec.${extensions}`,
]);

export default defineConfig({
  test: {
    include,
    environment: 'node',
    fileParallelism: false,
  },
});
