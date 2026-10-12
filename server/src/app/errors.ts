import type { ApiErrorCode } from '@hn/shared/contract/health';

export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function fromHnFailure(failure: 'timeout' | 'unavailable'): AppError {
  return failure === 'timeout'
    ? new AppError('UPSTREAM_TIMEOUT', 'A API do Hacker News demorou para responder.', 504)
    : new AppError('UPSTREAM_UNAVAILABLE', 'A API do Hacker News está indisponível.', 502);
}
