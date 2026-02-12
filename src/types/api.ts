export type AsyncApiRequestFn<R, P = void> = (params: P) => Promise<R>;

export type AxiosResultData<T> = { result: T };

export type ApiResultWithCount<T> = { result: T; count: number };
