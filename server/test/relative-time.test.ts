import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '@hn/shared/format/relative-time';

describe('formatRelativeTime', () => {
  it('formats PT-BR time and handles missing/invalid dates', () => {
    const now = Date.parse('2026-10-11T12:00:00.000Z');
    expect(formatRelativeTime('2026-10-11T11:59:00.000Z', now)).toBe('há 1 minuto');
    expect(formatRelativeTime('not-a-date', now)).toBe('data desconhecida');
    expect(formatRelativeTime(null, now)).toBe('data desconhecida');
  });
});
