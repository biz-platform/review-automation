import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { StoreService } from "@/lib/services/store-service";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

const storeService = new StoreService();

export type OnboardingResult = {
  hasStores: boolean;
  /** 연동된 매장 1개 이상 여부. 0개면 신규 유저 취급하여 리뷰 관리·구매 및 청구 접근 차단 */
  hasLinkedStores: boolean;
  aiSettingsCompleted: boolean;
};

/** GET: 매장 연동 여부 및 AI 댓글 설정 완료 여부. 온보딩/가드용 */
async function getHandler(request: NextRequest) {
  const { user } = await getUser(request);
  const stores = await storeService.findAll(user.id);
  const hasStores = stores.length > 0;

  if (!hasStores) {
    return NextResponse.json({
      result: {
        hasStores: false,
        hasLinkedStores: false,
        aiSettingsCompleted: true,
      } satisfies OnboardingResult,
    });
  }

  const storeIds = stores.map((s) => s.id);
  const supabase = await createServerSupabaseClient();

  const { data: sessionRows, error: sessionError } = await supabase
    .from("store_platform_sessions")
    .select("store_id")
    .in("store_id", storeIds)
    .limit(1);
  if (sessionError) throw sessionError;
  const hasLinkedStores = (sessionRows?.length ?? 0) > 0;

  const { data, error } = await supabase
    .from("tone_settings")
    .select("store_id")
    .in("store_id", storeIds)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const aiSettingsCompleted = data != null;

  return NextResponse.json({
    result: {
      hasStores: true,
      hasLinkedStores,
      aiSettingsCompleted,
    } satisfies OnboardingResult,
  });
}

export const GET = withRouteHandler(getHandler);
