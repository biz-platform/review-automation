import { NextRequest, NextResponse } from "next/server";
import { fetchBaeminReviewViaBrowser } from "@/lib/services/baemin/baemin-browser-review-service";
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

/** GET: count만 필요할 때도 브라우저 캡처로 조회 (한 번에 count+list 캡처 후 count만 반환) */
async function getHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const storeId = params.id ?? "";
  const { user } = await getUser(request);
  const { from, to } = defaultDateRange();
  const fromParam = request.nextUrl.searchParams.get("from") ?? from;
  const toParam = request.nextUrl.searchParams.get("to") ?? to;

  try {
    const { list, count: capturedCount } = await fetchBaeminReviewViaBrowser(
      storeId,
      user.id,
      { from: fromParam, to: toParam, offset: "0", limit: "10" }
    );

    const n = list.reviews?.length ?? 0;
    const countBody = capturedCount
      ? {
          reviewCount: capturedCount.reviewCount ?? n,
          noCommentReviewCount: capturedCount.noCommentReviewCount ?? 0,
          blockedReviewCount: capturedCount.blockedReviewCount ?? 0,
          recentReviewCount: capturedCount.recentReviewCount ?? n,
        }
      : {
          reviewCount: n,
          noCommentReviewCount: 0,
          blockedReviewCount: 0,
          recentReviewCount: n,
        };

    return NextResponse.json<AppRouteHandlerResponse<typeof countBody>>({
      result: countBody,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message, status: 502, detail: message },
      { status: 502 }
    );
  }
}

export const GET = withRouteHandler(getHandler);
