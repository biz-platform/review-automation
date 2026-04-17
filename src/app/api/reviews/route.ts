import { NextRequest, NextResponse } from "next/server";
import { ReviewService } from "@/lib/services/review-service";
import { reviewListQuerySchema } from "@/lib/types/dto/review-dto";
import type { ApiResponseWithCount, AppRouteHandlerResponse } from "@/lib/types/api/response";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const reviewService = new ReviewService();

async function getHandler(request: NextRequest) {
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const searchParams = request.nextUrl.searchParams;
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");
  const platformRaw = searchParams.get("platform");
  const linkedOnlyRaw = searchParams.get("linked_only");
  const filterRaw = searchParams.get("filter");
  const includeDraftsRaw = searchParams.get("include_drafts");
  const ratingLteRaw = searchParams.get("rating_lte");
  const query = reviewListQuerySchema.parse({
    limit: limitRaw === null || limitRaw === "" ? undefined : limitRaw,
    offset: offsetRaw === null || offsetRaw === "" ? undefined : offsetRaw,
    store_id: searchParams.get("store_id") ?? searchParams.get("storeId") ?? undefined,
    platform_shop_external_id:
      searchParams.get("platform_shop_external_id") ??
      searchParams.get("platformShopExternalId") ??
      undefined,
    platform: platformRaw === null || platformRaw === "" ? undefined : platformRaw,
    linked_only: linkedOnlyRaw === null || linkedOnlyRaw === "" ? undefined : linkedOnlyRaw,
    filter: filterRaw === null || filterRaw === "" ? undefined : filterRaw,
    include_drafts: includeDraftsRaw === null || includeDraftsRaw === "" ? undefined : includeDraftsRaw,
    rating_lte: ratingLteRaw === null || ratingLteRaw === "" ? undefined : ratingLteRaw,
  });
  const { list, count } = await reviewService.findAll(user.id, query);
  const next_offset = query.offset + list.length;
  const has_more = next_offset < count;
  return NextResponse.json<ApiResponseWithCount<typeof list> & { has_more: boolean; next_offset: number }>(
    { result: list, count, has_more, next_offset },
  );
}

export const GET = withRouteHandler(getHandler);
