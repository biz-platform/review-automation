import { NextRequest, NextResponse } from "next/server";
import { fetchBaeminReviewViaBrowser } from "@/lib/services/baemin-browser-review-service";
import { ReviewService } from "@/lib/services/review-service";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

export const maxDuration = 300;

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** POST: 브라우저로 전체 리뷰 수집 후 DB에 저장. 연동 후 한 번 호출해 두면 관리 화면은 DB에서만 조회 */
async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const storeId = params.id ?? "";
  const { user } = await getUser(request);
  const { from, to } = defaultDateRange();

  const LOG = "[baemin-reviews/sync]";
  try {
    console.log(LOG, "start", { storeId, userId: user.id, from, to });

    const { list, count } = await fetchBaeminReviewViaBrowser(storeId, user.id, {
      from,
      to,
      offset: "0",
      limit: "10",
      fetchAll: true,
    });

    const reviews = list.reviews ?? [];
    console.log(LOG, "fetch result", {
      reviewsLength: reviews.length,
      countBody: count ?? null,
      firstReviewKeys: reviews[0] != null ? Object.keys(reviews[0] as object) : null,
    });

    if (reviews.length === 0) {
      return NextResponse.json({ result: { upserted: 0, message: "수집된 리뷰가 없습니다." } });
    }

    const reviewService = new ReviewService();
    const { upserted } = await reviewService.upsertBaeminReviews(
      storeId,
      user.id,
      reviews as Array<{
        id: number;
        contents?: string | null;
        rating?: number | null;
        memberNickname?: string | null;
        createdAt?: string | null;
      }>
    );
    console.log(LOG, "upsert done", { upserted });

    return NextResponse.json({ result: { upserted } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[baemin-reviews/sync]", e);
    return NextResponse.json(
      { error: message, status: 502, detail: message },
      { status: 502 }
    );
  }
}

export const POST = withRouteHandler(postHandler);
