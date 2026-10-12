export type HnRequestFailure = 'timeout' | 'unavailable';

export class HnRequestError extends Error {
  readonly retryable: boolean | undefined;

  constructor(
    readonly failure: HnRequestFailure,
    message: string,
    options: { cause?: unknown; retryable?: boolean } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.retryable = options.retryable;
    this.name = 'HnRequestError';
  }
}

/** Generic port so applications can bind its value type without making ports depend on domain/shared. */
export interface HnClient<TCategory extends string, TItem> {
  fetchList(category: TCategory): Promise<number[]>;
  fetchItem(id: number): Promise<TItem | null>;
}
