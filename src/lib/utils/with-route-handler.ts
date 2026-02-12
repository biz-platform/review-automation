import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/utils/route-error-handler";

type RouteContext = { params?: Promise<Record<string, string>> };

type Handler = (
  request: NextRequest,
  context?: RouteContext
) => Promise<NextResponse>;

export function withRouteHandler(handler: Handler): Handler {
  return async (request: NextRequest, context?: RouteContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleRouteError(error, request);
    }
  };
}
