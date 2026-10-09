// Contrato único de tipos compartilhados entre servidor e cliente (AD-3).

export interface Health {
  status: 'ok';
  cache: { entries: number };
}

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'ROUTE_NOT_FOUND'
  | 'SNAPSHOT_EXPIRED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}
