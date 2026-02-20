import { NextRequest, NextResponse } from "next/server";
import * as BaeminSession from "@/lib/services/baemin/baemin-session-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** GET: 배민 셀프서비스 리뷰 목록 (연동된 가게, 저장된 세션 사용) */
async function getHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const storeId = params.id ?? "";
  const { user } = await getUser(request);
  const { from, to } = defaultDateRange();
  const searchParams = request.nextUrl.searchParams;
  const fromParam = searchParams.get("from") ?? from;
  const toParam = searchParams.get("to") ?? to;
  const offset = searchParams.get("offset") ?? "0";
  const limit = searchParams.get("limit") ?? "10";

  const res = await BaeminSession.fetchBaeminReviewApi(
    storeId,
    user.id,
    "reviews",
    { from: fromParam, to: toParam, offset, limit }
  );
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "배민 리뷰 API 요청 실패", status: res.status, detail: text },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }
  const body = await res.json();
  return NextResponse.json<AppRouteHandlerResponse<typeof body>>({ result: body });
}

export const GET = withRouteHandler(getHandler);
