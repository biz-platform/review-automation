import { NextRequest, NextResponse } from "next/server";
import { StoreService } from "@/lib/services/store-service";
import { updateStoreSchema } from "@/lib/types/dto/store-dto";
import type { ApiResponse, AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const storeService = new StoreService();

async function getHandler(
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const { id } = await (context.params ?? Promise.resolve({ id: "" }));
  const { user } = await getUser(request);
  const result = await storeService.findById(id, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

async function patchHandler(
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const { id } = await (context.params ?? Promise.resolve({ id: "" }));
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = updateStoreSchema.parse(body);
  const result = await storeService.update(id, user.id, dto);
  return NextResponse.json<ApiResponse<typeof result>>({ result });
}

async function deleteHandler(
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const { id } = await (context.params ?? Promise.resolve({ id: "" }));
  const { user } = await getUser(request);
  await storeService.delete(id, user.id);
  return new NextResponse(null, { status: 204 });
}

export const GET = withRouteHandler(getHandler);
export const PATCH = withRouteHandler(patchHandler);
export const DELETE = withRouteHandler(deleteHandler);
