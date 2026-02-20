import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/utils/route-error-handler";

/** Next App Router가 동적 세그먼트 [id] 등에 넣어주는 context. params는 라우트별로 다를 수 있음 */
export type RouteContext = { params?: Promise<Record<string, string>> };

/** [id] 라우트용: context?.params 를 await 한 뒤 id 추출 (없으면 "") */
export async function getStoreIdFromContext(context?: RouteContext): Promise<string> {
  const resolved = await (context?.params ?? Promise.resolve({}));
  return (resolved as { id?: string }).id ?? "";
}

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
