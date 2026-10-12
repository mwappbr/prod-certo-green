import babelParser from '@babel/eslint-parser';
import importPlugin from 'eslint-plugin-import';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverRoot, '..');
const source = 'server/src';
const serverLayerFiles = [
  'src/app/**/*.ts',
  'src/adapters/**/*.ts',
  'src/domain/**/*.ts',
  'src/ports/**/*.ts',
];
const fastifyRestriction = {
  name: 'fastify',
  message: 'AD-1: only the HTTP layer and the composition root may depend on Fastify.',
};
const fastifyPackagePattern = {
  group: ['@fastify/*'],
  message: 'AD-1: only the HTTP layer and the composition root may depend on Fastify plugins.',
};
const domainIoPattern = {
  group: [
    'fs', 'fs/*', 'node:fs', 'node:fs/*',
    'http', 'http/*', 'node:http', 'node:http/*',
    'https', 'https/*', 'node:https', 'node:https/*',
    'net', 'net/*', 'node:net', 'node:net/*',
    'tls', 'tls/*', 'node:tls', 'node:tls/*',
    'dgram', 'dgram/*', 'node:dgram', 'node:dgram/*',
    'dns', 'dns/*', 'node:dns', 'node:dns/*',
    'child_process', 'child_process/*', 'node:child_process', 'node:child_process/*',
    'worker_threads', 'worker_threads/*', 'node:worker_threads', 'node:worker_threads/*',
    'stream', 'stream/*', 'node:stream', 'node:stream/*',
    'readline', 'readline/*', 'node:readline', 'node:readline/*',
    'undici', 'undici/*', 'axios', 'got', 'node-fetch', 'cross-fetch', 'request', 'superagent',
  ],
  message: 'AD-1: domain must not depend on I/O APIs or clients.',
};

// server/src/main.ts is deliberately outside every layer target: it is the composition root and wires adapters.
export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          plugins: ['@babel/plugin-syntax-typescript'],
        },
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { project: resolve(serverRoot, 'tsconfig.json') },
      },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          basePath: projectRoot,
          zones: [
            {
              target: `${source}/http`,
              from: [`${source}/adapters`, `${source}/domain`, `${source}/ports`, `${source}/config`, 'client'],
              message: 'AD-1: http may depend on app and shared only.',
            },
            {
              target: `${source}/app`,
              from: [`${source}/adapters`, `${source}/http`, `${source}/config`, 'client'],
              message: 'AD-1: app may depend on domain, ports, and shared only.',
            },
            {
              target: `${source}/adapters`,
              from: [`${source}/app`, `${source}/http`, `${source}/config`, 'client'],
              message: 'AD-1: adapters may depend on ports, domain, and shared only.',
            },
            {
              target: `${source}/domain`,
              from: [`${source}/app`, `${source}/ports`, `${source}/adapters`, `${source}/http`, `${source}/config`, 'client'],
              message: 'AD-1: domain may depend on shared only.',
            },
            {
              target: `${source}/ports`,
              from: [`${source}/app`, `${source}/domain`, `${source}/adapters`, `${source}/http`, `${source}/config`, 'client', 'shared'],
              message: 'AD-1: ports declare interfaces and do not depend on application layers.',
            },
            {
              target: [
                `${source}/http`,
                `${source}/app`,
                `${source}/adapters`,
                `${source}/domain`,
                `${source}/ports`,
              ],
              from: `${source}/main.ts`,
              message: 'AD-1: layers must not import main.ts, the composition root.',
            },
          ],
        },
      ],
    },
  },
  {
    files: serverLayerFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [fastifyRestriction],
          patterns: [fastifyPackagePattern],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [fastifyRestriction],
          patterns: [fastifyPackagePattern, domainIoPattern],
        },
      ],
    },
  },
];
