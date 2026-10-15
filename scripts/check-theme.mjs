import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(projectRoot, 'client/src/theme.css'), 'utf8');

// Approved literal values. The eight existing tokens must keep their names and values;
// the five home roles come from ux-cores-home/DESIGN.md (approved 2026-10-13).
const approvedTokens = {
  light: {
    'surface-base': '#F8FAFC', 'surface-raised': '#FFFFFF', 'ink-primary': '#0F172A', 'ink-secondary': '#475569',
    primary: '#1D4ED8', 'primary-foreground': '#FFFFFF', 'primary-hover': '#1E40AF', 'border-hairline': '#E2E8F0',
    'surface-brand': '#DBEAFE', 'ink-on-brand': '#1E3A8A', 'surface-accent': '#EDE9FE', accent: '#6D28D9',
    'border-control': '#64748B',
  },
  dark: {
    'surface-base': '#0B1120', 'surface-raised': '#131C2E', 'ink-primary': '#E2E8F0', 'ink-secondary': '#94A3B8',
    primary: '#60A5FA', 'primary-foreground': '#0B1120', 'primary-hover': '#93C5FD', 'border-hairline': '#1E2A40',
    'surface-brand': '#172554', 'ink-on-brand': '#DBEAFE', 'surface-accent': '#2E1065', accent: '#C4B5FD',
    'border-control': '#94A3B8',
  },
};

// Three theme routes that must carry identical token values:
// explicit light (:root), explicit dark (data-theme="dark"), and system dark without data-theme.
const themeRoutes = [
  { theme: 'light', via: ':root', pattern: /:root\s*\{([^}]*)\}/ },
  { theme: 'dark', via: ':root[data-theme="dark"]', pattern: /:root\[data-theme=["']dark["']\]\s*\{([^}]*)\}/ },
  {
    theme: 'dark',
    via: '@media (prefers-color-scheme: dark) :root:not([data-theme])',
    pattern: /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^}]*)\}/,
  },
];

const requiredTokens = Object.keys(approvedTokens.light);

// Real text pairs (>= 4.5:1) used by the home, the detail and the shared controls.
const textPairs = [
  ['ink-primary', 'surface-base'], ['ink-primary', 'surface-raised'],
  ['ink-secondary', 'surface-base'], ['ink-secondary', 'surface-raised'],
  ['primary', 'surface-base'], ['primary', 'surface-raised'],
  ['primary-hover', 'surface-base'], ['primary-hover', 'surface-raised'],
  ['primary-foreground', 'primary'], ['primary-foreground', 'primary-hover'],
  ['ink-on-brand', 'surface-brand'], ['ink-secondary', 'surface-brand'],
  ['ink-primary', 'surface-accent'], ['accent', 'surface-accent'],
  ['accent', 'surface-base'], ['accent', 'surface-raised'],
];

// Essential non-text pairs (>= 3:1): active indicator, control outline, focus ring on the brand header.
const nonTextPairs = [
  ['accent', 'surface-base'], ['accent', 'surface-accent'],
  ['border-control', 'surface-base'], ['border-control', 'surface-raised'],
  ['primary', 'surface-base'], ['primary', 'surface-brand'],
  ['primary', 'surface-accent'], ['primary', 'surface-raised'],
];

function parseTheme({ theme, via, pattern }) {
  const match = css.match(pattern);
  assert.ok(match, `Missing ${via} theme rule (${theme}) in client/src/theme.css`);
  const tokens = Object.fromEntries(
    [...match[1].matchAll(/--([a-z-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)]
      .map(([, name, value]) => [name, value.toUpperCase()]),
  );
  for (const name of requiredTokens) {
    assert.ok(tokens[name], `Missing --${name} in ${via} (${theme}) theme`);
  }
  return tokens;
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const routes = themeRoutes.map((route) => ({ ...route, tokens: parseTheme(route) }));

// 1. Token values: the eight existing tokens and the five new roles match the approved table on every route.
for (const { theme, via, tokens } of routes) {
  for (const [name, expected] of Object.entries(approvedTokens[theme])) {
    assert.equal(
      tokens[name],
      expected,
      `${via}: --${name} is ${tokens[name]} but the approved ${theme} value is ${expected}`,
    );
  }
}

// 2. Parity: explicit dark and system dark must not diverge from each other or from the light route's key set.
const explicitDark = routes.find((route) => route.via === ':root[data-theme="dark"]').tokens;
const systemDark = routes.find((route) => route.via.startsWith('@media')).tokens;
for (const name of requiredTokens) {
  assert.equal(systemDark[name], explicitDark[name], `system dark --${name} differs from explicit dark`);
}

// 3. Contrast of the real pairs on every route.
for (const { theme, via, tokens } of routes) {
  for (const [foreground, background] of textPairs) {
    const ratio = contrastRatio(tokens[foreground], tokens[background]);
    assert.ok(
      ratio >= 4.5,
      `${theme} (${via}): text --${foreground} on --${background} is ${ratio.toFixed(2)}:1 (requires 4.5:1)`,
    );
  }
  for (const [foreground, background] of nonTextPairs) {
    const ratio = contrastRatio(tokens[foreground], tokens[background]);
    assert.ok(
      ratio >= 3,
      `${theme} (${via}): non-text --${foreground} on --${background} is ${ratio.toFixed(2)}:1 (requires 3:1)`,
    );
  }
}

console.log('Theme tokens pass approved values, three-route parity and WCAG AA text (4.5:1) and essential non-text (3:1) checks for light and dark themes.');
