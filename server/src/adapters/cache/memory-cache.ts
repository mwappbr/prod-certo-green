import type { Cache } from '../../ports/cache.js';

// Cache em memória mínimo: ainda não grava entradas, então o contador é sempre 0.
export class MemoryCache implements Cache {
  size(): number {
    return 0;
  }
}
