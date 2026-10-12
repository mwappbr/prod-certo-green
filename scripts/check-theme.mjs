import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(projectRoot, 'client/src/theme.css'), 'utf8');
const requiredTokens = [
  'surface-base', 'surface-raised', 'ink-primary', 'ink-secondary',
  'primary', 'primary-foreground', 'primary-hover', 'border-hairline',
];
const textPairs = [
  ['ink-primary', 'surface-base'], ['ink-primary', 'surface-raised'],
  ['ink-secondary', 'surface-base'], ['ink-secondary', 'surface-raised'],
  ['primary', 'surface-base'], ['primary', 'surface-raised'],
  ['primary-hover', 'surface-base'], ['primary-hover', 'surface-raised'],
  ['primary-foreground', 'primary'], ['primary-foreground', 'primary-hover'],
];

function parseTheme(selector, label) {
  const match = css.match(selector);
  assert.ok(match, `Missing ${label} theme rule in client/src/theme.css`);
  const tokens = Object.fromEntries(
    [...match[1].matchAll(/--([a-z-]+)\s*:\s*(#[\da-f]{6})\s*;/gi)]
      .map(([, name, value]) => [name, value.toUpperCase()]),
  );
  for (const name of requiredTokens) {
    assert.ok(tokens[name], `Missing --${name} in ${label} theme`);
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

const themes = {
  light: parseTheme(/:root\s*\{([^}]*)\}/, 'light'),
  dark: parseTheme(/:root\[data-theme=["']dark["']\]\s*\{([^}]*)\}/, 'dark'),
};

for (const [theme, tokens] of Object.entries(themes)) {
  for (const [foreground, background] of textPairs) {
    const ratio = contrastRatio(tokens[foreground], tokens[background]);
    assert.ok(
      ratio >= 4.5,
      `${theme}: --${foreground} on --${background} is ${ratio.toFixed(2)}:1 (requires 4.5:1)`,
    );
  }
}

console.log('Theme tokens pass WCAG AA 4.5:1 text contrast checks for light and dark themes.');
