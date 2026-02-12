import type { ErrorResponse } from "@/lib/types/api/response";

export interface CreateErrorResponseOptions {
  code: string;
  message: string;
  detail?: string;
  status: number;
  path?: string;
  method?: string;
}

export function createErrorResponse(
  options: CreateErrorResponseOptions
): ErrorResponse {
  const {
    code,
    message,
    detail = "",
    status,
    path = "/api/unknown",
    method = "UNKNOWN",
  } = options;

  return {
    type: `https://api/review-automation/errors/${code}`,
    title: message,
    status,
    detail,
    instance: path,
    code,
    requestMethod: method,
    timestamp: new Date().toISOString(),
  };
}
