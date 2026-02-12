export type ApiResponse<T = unknown> = { result: T };

export type ApiResponseWithCount<T = unknown> = { result: T; count: number };

export type AppRouteHandlerResponse<T> = ApiResponse<T>;

export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  requestMethod: string;
  timestamp: string;
}
