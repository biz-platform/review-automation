import { NextRequest, NextResponse } from "next/server";
import { StoreService } from "@/lib/services/store-service";
import { createStoreSchema } from "@/lib/types/dto/store-dto";
import type { ApiResponse, AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const storeService = new StoreService();

async function getHandler(request: NextRequest) {
  const { user } = await getUser(request);
  const linkedPlatform = request.nextUrl.searchParams.get("linked_platform") ?? undefined;
  const list = linkedPlatform
    ? await storeService.findAllByLinkedPlatform(user.id, linkedPlatform)
    : await storeService.findAll(user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof list>>({ result: list });
}

async function postHandler(request: NextRequest) {
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = createStoreSchema.parse(body);
  const result = await storeService.create(user.id, dto);
  return NextResponse.json<ApiResponse<typeof result>>({ result }, { status: 201 });
}

export const GET = withRouteHandler(getHandler);
export const POST = withRouteHandler(postHandler);
