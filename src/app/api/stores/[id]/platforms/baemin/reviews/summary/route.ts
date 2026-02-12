import { NextRequest, NextResponse } from "next/server";
import { fetchBaeminReviewViaBrowser } from "@/lib/services/baemin-browser-review-service";
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

function buildCountFromList(n: number) {
  return {
    reviewCount: n,
    noCommentReviewCount: 0,
    blockedReviewCount: 0,
    recentReviewCount: n,
  };
}

/** GET: 브라우저 캡처로만 조회 (직접 API 미사용) */
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
  const fetchAll = searchParams.get("fetchAll") === "1";

  try {
    const { list: listBody, count: capturedCount } = await fetchBaeminReviewViaBrowser(
      storeId,
      user.id,
      { from: fromParam, to: toParam, offset, limit, fetchAll }
    );

    const n = listBody.reviews?.length ?? 0;
    const countBody = capturedCount
      ? {
          reviewCount: capturedCount.reviewCount ?? n,
          noCommentReviewCount: capturedCount.noCommentReviewCount ?? 0,
          blockedReviewCount: capturedCount.blockedReviewCount ?? 0,
          recentReviewCount: capturedCount.recentReviewCount ?? n,
        }
      : buildCountFromList(n);

    return NextResponse.json<
      AppRouteHandlerResponse<{ count: unknown; list: unknown }>
    >({ result: { count: countBody, list: listBody } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message, status: 502, detail: message },
      { status: 502 }
    );
  }
}

export const GET = withRouteHandler(getHandler);
