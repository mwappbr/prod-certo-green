import { afterEach, describe, expect, it, vi } from 'vitest';

const viteConfigUrl = new URL('../vite.config.ts', import.meta.url);

async function loadViteConfig(port: string | undefined) {
  vi.resetModules();
  vi.stubEnv('PORT', port);
  const module = await import(viteConfigUrl.href);
  return module.default;
}

function apiTarget(config: any): string {
  const proxy = config.server.proxy['/api'];
  return typeof proxy === 'string' ? proxy : proxy.target;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Vite API proxy', () => {
  it('uses the central PORT default when PORT is absent', async () => {
    const config = await loadViteConfig(undefined);
    expect(apiTarget(config)).toBe('http://localhost:3000');
  });

  it('uses the central validated PORT override', async () => {
    const config = await loadViteConfig('33877');
    expect(apiTarget(config)).toBe('http://localhost:33877');
  });

  it('rejects an invalid PORT through the central server config', async () => {
    await expect(loadViteConfig('not-a-port')).rejects.toThrow(/PORT/);
  });
});
