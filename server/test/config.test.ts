import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';

describe('loadConfig', () => {
  it('maps defaults from an empty environment', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      defaultPageSize: 30,
      maxPageSize: 50,
      listCacheTtlMs: 60_000,
      itemCacheTtlMs: 120_000,
      staleRetentionMs: 900_000,
      hnConcurrency: 8,
      hnTimeoutMs: 5_000,
      hnRetries: 1,
      commentsDefaultDepth: 8,
      commentsMaxDepth: 20,
      commentsMaxNodes: 500,
    });
  });

  it('coerces explicit values and preserves an intentional zero retry count', () => {
    expect(loadConfig({
      PORT: '4321',
      DEFAULT_PAGE_SIZE: '20',
      MAX_PAGE_SIZE: '25',
      HN_RETRIES: '0',
      COMMENTS_DEFAULT_DEPTH: '7',
      COMMENTS_MAX_DEPTH: '10',
    })).toMatchObject({
      port: 4321,
      defaultPageSize: 20,
      maxPageSize: 25,
      hnRetries: 0,
      commentsDefaultDepth: 7,
      commentsMaxDepth: 10,
    });
  });

  it('rejects blank retry values instead of coercing whitespace to zero', () => {
    expect(() => loadConfig({ HN_RETRIES: '  ' })).toThrow(/HN_RETRIES/);
  });

  it('rejects blank and non-numeric PORT values from explicit fixtures', () => {
    expect(() => loadConfig({ PORT: '' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('rejects values outside their range and inconsistent page sizes', () => {
    expect(() => loadConfig({ PORT: '65536' })).toThrow(/PORT/);
    expect(() => loadConfig({ DEFAULT_PAGE_SIZE: '51' })).toThrow(/DEFAULT_PAGE_SIZE/);
    expect(() => loadConfig({ HN_RETRIES: '4' })).toThrow(/HN_RETRIES/);
    expect(() => loadConfig({ HN_CONCURRENCY: '33' })).toThrow(/HN_CONCURRENCY/);
    expect(() => loadConfig({ HN_TIMEOUT_MS: '30001' })).toThrow(/HN_TIMEOUT_MS/);
    expect(() => loadConfig({ DEFAULT_PAGE_SIZE: '10', MAX_PAGE_SIZE: '5' }))
      .toThrow(/DEFAULT_PAGE_SIZE/);
  });
});
