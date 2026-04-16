import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import type { DashboardReviewKeywordReviewListData } from "@/entities/dashboard/reviews-types";
import { buildDashboardReviewKeywordListData } from "@/lib/dashboard/build-dashboard-review-keyword-list";

const querySchema = z.object({
  storeId: z.string().min(1),
  range: z.enum(["7d", "30d"]),
  platform: z.string().optional(),
  keyword: z.string().min(1).max(200),
  sentiment: z.enum(["positive", "negative"]),
});

async function getHandler(
  request: NextRequest,
): Promise<
  NextResponse<AppRouteHandlerResponse<DashboardReviewKeywordReviewListData>>
> {
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);

  const sp = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    storeId: (sp.get("storeId") ?? "").trim(),
    range: sp.get("range") ?? "30d",
    platform: (sp.get("platform") ?? "").trim() || undefined,
    keyword: (sp.get("keyword") ?? "").trim(),
    sentiment: sp.get("sentiment") ?? "",
  });

  if (!parsed.success) {
    throw new AppBadRequestError({
      code: "INVALID_QUERY",
      message:
        "storeId, range(7d|30d), keyword, sentiment(positive|negative)가 필요합니다.",
    });
  }

  const result = await buildDashboardReviewKeywordListData(supabase, {
    ownerUserId: user.id,
    storeIdRaw: parsed.data.storeId,
    platformParam: parsed.data.platform ?? "",
    range: parsed.data.range,
    keyword: parsed.data.keyword,
    sentiment: parsed.data.sentiment,
  });

  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);
