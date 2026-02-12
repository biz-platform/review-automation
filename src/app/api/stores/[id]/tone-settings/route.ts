import { NextRequest, NextResponse } from "next/server";
import { ToneSettingsService } from "@/lib/services/tone-settings-service";
import { toneSettingsSchema } from "@/lib/types/dto/tone-settings-dto";
import type { ApiResponse, AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const toneSettingsService = new ToneSettingsService();

async function getHandler(
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const { id: storeId } = await (context.params ?? Promise.resolve({ id: "" }));
  const { user } = await getUser(request);
  const result = await toneSettingsService.getByStoreId(storeId, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({
    result: result ?? { store_id: storeId, tone: "friendly", extra_instruction: null, updated_at: new Date().toISOString() },
  });
}

async function patchHandler(
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const { id: storeId } = await (context.params ?? Promise.resolve({ id: "" }));
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = toneSettingsSchema.parse(body);
  const result = await toneSettingsService.upsert(storeId, user.id, dto);
  return NextResponse.json<ApiResponse<typeof result>>({ result });
}

export const GET = withRouteHandler(getHandler);
export const PATCH = withRouteHandler(patchHandler);
