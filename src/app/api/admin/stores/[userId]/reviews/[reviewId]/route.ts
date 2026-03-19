import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError, AppNotFoundError } from "@/lib/errors/app-error";

type AdminReviewDetailData = {
  id: string;
  content: string | null;
  platform_reply_content: string | null;
  author_name: string | null;
  written_at: string | null;
  platform: string;
};

/** GET: 어드민 - 대상 고객(userId) 소유 리뷰 1건 (리뷰 내용 + 답글 여부). 작업 로그에서 reviewId 클릭 시 사용 */
async function getHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<AdminReviewDetailData>>> {
  const { user } = await getUser(request);
  const supabase = createServiceRoleClient();

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_admin) {
    throw new AppForbiddenError({
      code: "ADMIN_REQUIRED",
      message: "관리자 권한이 필요합니다.",
    });
  }

  const resolved = await (context?.params ?? Promise.resolve({}));
  const userId = (resolved as { userId?: string }).userId;
  const reviewId = (resolved as { reviewId?: string }).reviewId;
  if (!userId || !reviewId) {
    throw new AppNotFoundError({
      code: "NOT_FOUND",
      message: "리뷰를 찾을 수 없습니다.",
    });
  }

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, store_id, content, platform_reply_content, author_name, written_at, platform")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError || !review) {
    throw new AppNotFoundError({
      code: "REVIEW_NOT_FOUND",
      message: "리뷰를 찾을 수 없습니다.",
    });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("id", review.store_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!store) {
    throw new AppNotFoundError({
      code: "REVIEW_NOT_FOUND",
      message: "리뷰를 찾을 수 없습니다.",
    });
  }

  const result: AdminReviewDetailData = {
    id: review.id as string,
    content: (review.content as string) ?? null,
    platform_reply_content: (review.platform_reply_content as string) ?? null,
    author_name: (review.author_name as string) ?? null,
    written_at: review.written_at != null ? (review.written_at as string) : null,
    platform: (review.platform as string) ?? "",
  };

  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);
