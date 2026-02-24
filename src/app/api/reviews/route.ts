import { NextRequest, NextResponse } from "next/server";
import { ReviewService } from "@/lib/services/review-service";
import { reviewListQuerySchema } from "@/lib/types/dto/review-dto";
import type { ApiResponseWithCount, AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const reviewService = new ReviewService();

async function getHandler(request: NextRequest) {
  const { user } = await getUser(request);
  const searchParams = request.nextUrl.searchParams;
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");
  const platformRaw = searchParams.get("platform");
  const linkedOnlyRaw = searchParams.get("linked_only");
  const filterRaw = searchParams.get("filter");
  const includeDraftsRaw = searchParams.get("include_drafts");
  const query = reviewListQuerySchema.parse({
    limit: limitRaw === null || limitRaw === "" ? undefined : limitRaw,
    offset: offsetRaw === null || offsetRaw === "" ? undefined : offsetRaw,
    store_id: searchParams.get("store_id") ?? searchParams.get("storeId") ?? undefined,
    platform: platformRaw === null || platformRaw === "" ? undefined : platformRaw,
    linked_only: linkedOnlyRaw === null || linkedOnlyRaw === "" ? undefined : linkedOnlyRaw,
    filter: filterRaw === null || filterRaw === "" ? undefined : filterRaw,
    include_drafts: includeDraftsRaw === null || includeDraftsRaw === "" ? undefined : includeDraftsRaw,
  });
  const { list, count } = await reviewService.findAll(user.id, query);
  return NextResponse.json<ApiResponseWithCount<typeof list>>({ result: list, count });
}

export const GET = withRouteHandler(getHandler);
