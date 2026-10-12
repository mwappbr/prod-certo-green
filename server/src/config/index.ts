import { z } from 'zod';

function integer(name: string, minimum: number, maximum?: number) {
  const numberSchema = z
    .coerce
    .number({ error: `${name} deve ser numérico.` })
    .int({ error: `${name} deve ser um número inteiro.` })
    .min(minimum, { error: `${name} deve ser no mínimo ${minimum}.` });
  const boundedSchema = maximum === undefined
    ? numberSchema
    : numberSchema.max(maximum, { error: `${name} deve ser no máximo ${maximum}.` });

  return z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? Number.NaN : value,
    boundedSchema,
  );
}

const environmentSchema = z
  .object({
    PORT: integer('PORT', 1, 65535).default(3000),
    DEFAULT_PAGE_SIZE: integer('DEFAULT_PAGE_SIZE', 1, 50).default(30),
    MAX_PAGE_SIZE: integer('MAX_PAGE_SIZE', 1, 50).default(50),
    LIST_CACHE_TTL_MS: integer('LIST_CACHE_TTL_MS', 1).default(60_000),
    ITEM_CACHE_TTL_MS: integer('ITEM_CACHE_TTL_MS', 1).default(120_000),
    STALE_RETENTION_MS: integer('STALE_RETENTION_MS', 1).default(900_000),
    HN_CONCURRENCY: integer('HN_CONCURRENCY', 1, 32).default(8),
    HN_TIMEOUT_MS: integer('HN_TIMEOUT_MS', 1, 30_000).default(5_000),
    HN_RETRIES: integer('HN_RETRIES', 0, 3).default(1),
    COMMENTS_DEFAULT_DEPTH: integer('COMMENTS_DEFAULT_DEPTH', 1).default(8),
    COMMENTS_MAX_DEPTH: integer('COMMENTS_MAX_DEPTH', 1).default(20),
    COMMENTS_MAX_NODES: integer('COMMENTS_MAX_NODES', 1).default(500),
  })
  .superRefine((settings, context) => {
    if (settings.DEFAULT_PAGE_SIZE > settings.MAX_PAGE_SIZE) {
      context.addIssue({
        code: 'custom',
        path: ['DEFAULT_PAGE_SIZE'],
        message: 'deve ser menor ou igual a MAX_PAGE_SIZE.',
      });
    }

    if (settings.COMMENTS_DEFAULT_DEPTH > settings.COMMENTS_MAX_DEPTH) {
      context.addIssue({
        code: 'custom',
        path: ['COMMENTS_DEFAULT_DEPTH'],
        message: 'deve ser menor ou igual a COMMENTS_MAX_DEPTH.',
      });
    }
  });

export type ServerConfig = {
  port: number;
  defaultPageSize: number;
  maxPageSize: number;
  listCacheTtlMs: number;
  itemCacheTtlMs: number;
  staleRetentionMs: number;
  hnConcurrency: number;
  hnTimeoutMs: number;
  hnRetries: number;
  commentsDefaultDepth: number;
  commentsMaxDepth: number;
  commentsMaxNodes: number;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuração do servidor inválida: ${details}. Revise as variáveis de ambiente.`);
  }

  return {
    port: result.data.PORT,
    defaultPageSize: result.data.DEFAULT_PAGE_SIZE,
    maxPageSize: result.data.MAX_PAGE_SIZE,
    listCacheTtlMs: result.data.LIST_CACHE_TTL_MS,
    itemCacheTtlMs: result.data.ITEM_CACHE_TTL_MS,
    staleRetentionMs: result.data.STALE_RETENTION_MS,
    hnConcurrency: result.data.HN_CONCURRENCY,
    hnTimeoutMs: result.data.HN_TIMEOUT_MS,
    hnRetries: result.data.HN_RETRIES,
    commentsDefaultDepth: result.data.COMMENTS_DEFAULT_DEPTH,
    commentsMaxDepth: result.data.COMMENTS_MAX_DEPTH,
    commentsMaxNodes: result.data.COMMENTS_MAX_NODES,
  };
}

export const config = loadConfig();

// Compatível com o tracer; a config completa é a fonte para os próximos casos de uso.
export const PORT = config.port;
