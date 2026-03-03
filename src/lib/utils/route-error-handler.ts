import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, AppNextRouteHandlerError } from "@/lib/errors/app-error";
import { createErrorResponse } from "@/lib/utils/error-formatter";

export function handleRouteError(
  error: unknown,
  request?: NextRequest
): NextResponse {
  const path = request?.nextUrl?.pathname ?? "/api/unknown";
  const method = request?.method ?? "UNKNOWN";

  if (error instanceof AppNextRouteHandlerError) {
    return NextResponse.json(error.toObject(), {
      status: error.statusCode,
    });
  }

  if (error instanceof ZodError) {
    const detail = error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    return NextResponse.json(
      createErrorResponse({
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        detail,
        status: 400,
        path,
        method,
      }),
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      createErrorResponse({
        code: error.code,
        message: error.message,
        detail: error.detail,
        status: error.statusCode,
        path,
        method,
      }),
      { status: error.statusCode }
    );
  }

  const detail =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: string })?.message === "string"
        ? (error as { message: string }).message
        : typeof error === "string"
          ? error
          : "Unknown error";
  console.error("[route-error-handler] 500", path, method, error);
  return NextResponse.json(
    createErrorResponse({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      detail,
      status: 500,
      path,
      method,
    }),
    { status: 500 }
  );
}
