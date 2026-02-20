import { NextRequest, NextResponse } from "next/server";
import { fetchAllDdangyoReviews } from "@/lib/services/ddangyo/ddangyo-review-service";
import { ReviewService } from "@/lib/services/review-service";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  getStoreIdFromContext,
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";

export const maxDuration = 300;

/** POST: 땡겨요 리뷰 Cnt → List 페이지네이션 수집 후 DB upsert */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);

  const LOG = "[ddangyo-reviews/sync]";
  try {
    const { list, total } = await fetchAllDdangyoReviews(storeId, user.id);
    console.log(LOG, "fetch result", { listLength: list.length, total });

    if (list.length === 0) {
      return NextResponse.json({
        result: { upserted: 0, message: "수집된 리뷰가 없습니다." },
      });
    }

    const reviewService = new ReviewService();
    const { upserted } = await reviewService.upsertDdangyoReviews(
      storeId,
      user.id,
      list,
    );
    console.log(LOG, "upsert done", { upserted });

    return NextResponse.json({ result: { upserted } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(LOG, e);
    return NextResponse.json(
      { error: message, status: 502, detail: message },
      { status: 502 },
    );
  }
}

export const POST = withRouteHandler(postHandler);
