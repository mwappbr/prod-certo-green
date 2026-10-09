import type { Health } from '@hn/shared/contract/health';
import type { Cache } from '../ports/cache.js';

export function getHealth(cache: Cache): Health {
  return { status: 'ok', cache: { entries: cache.size() } };
}
