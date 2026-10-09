import type { FastifyInstance } from 'fastify';
import type { Health } from '@hn/shared/contract/health';

export async function registerHealthRoute(
  app: FastifyInstance,
  getHealth: () => Health,
): Promise<void> {
  app.get('/api/health', async () => getHealth());
}
