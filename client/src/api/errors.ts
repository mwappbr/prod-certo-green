import type { ApiErrorBody, ApiErrorCode } from '@hn/shared/contract/health';

export class ClientApiError extends Error {
  constructor(readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ClientApiError';
  }
}

export function mapApiError(error: unknown): ClientApiError {
  if (error instanceof ClientApiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ClientApiError('TIMEOUT', 'A solicitação demorou para responder. Tente novamente.');
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new ClientApiError('TIMEOUT', 'A solicitação demorou para responder. Tente novamente.');
  }
  return new ClientApiError('NETWORK_ERROR', 'Não foi possível conectar ao servidor. Tente novamente.');
}

const apiErrorCodes: readonly ApiErrorCode[] = [
  'BAD_REQUEST',
  'NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'SNAPSHOT_EXPIRED',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_TIMEOUT',
  'INTERNAL',
  'NETWORK_ERROR',
  'TIMEOUT',
];

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(
    error && typeof error === 'object' &&
    'code' in error && typeof error.code === 'string' && apiErrorCodes.includes(error.code as ApiErrorCode) &&
    'message' in error && typeof error.message === 'string',
  );
}
