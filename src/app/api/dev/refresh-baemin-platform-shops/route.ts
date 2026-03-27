import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getBaeminCookies } from "@/lib/services/baemin/baemin-session-service";
import { fetchBaeminShopMetaBatchViaBrowser } from "@/lib/services/baemin/baemin-shop-meta-browser-service";
import { upsertStorePlatformShops } from "@/lib/services/platform-shop-service";

/**
 * 개발 전용: 전체 리뷰 동기화 없이 배민 리뷰 페이지 매장 select만 읽어
 * `store_platform_shops`의 shop_name / shop_category 갱신.
 *
 * POST JSON:
 * - storeId (필수)
 * - shopNos (선택) — 특정 매장 번호만 빠르게 테스트
 * - dryRun (선택, 기본 false) — true면 DB upsert 없이 수집 결과만 반환
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Only available in development" },
      { status: 404 },
    );
  }

  let body: {
    storeId?: string;
    shopNos?: string[];
    dryRun?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON. Required: storeId" },
      { status: 400 },
    );
  }

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, user_id")
    .eq("id", storeId)
    .maybeSingle();

  if (storeError || !store?.user_id) {
    return NextResponse.json(
      { error: "Store not found or has no user_id" },
      { status: 404 },
    );
  }

  const userId = store.user_id as string;

  const { data: sessionRow } = await supabase
    .from("store_platform_sessions")
    .select("external_shop_id")
    .eq("store_id", storeId)
    .eq("platform", "baemin")
    .maybeSingle();

  const primaryShopId =
    typeof sessionRow?.external_shop_id === "string"
      ? sessionRow.external_shop_id.trim()
      : "";

  let shopNos: string[] = [];
  if (Array.isArray(body.shopNos) && body.shopNos.length > 0) {
    shopNos = body.shopNos.map((s) => String(s).trim()).filter(Boolean);
  } else {
    const { data: shopRows } = await supabase
      .from("store_platform_shops")
      .select("platform_shop_external_id")
      .eq("store_id", storeId)
      .eq("platform", "baemin");

    shopNos =
      shopRows
        ?.map((r) => String(r.platform_shop_external_id ?? "").trim())
        .filter(Boolean) ?? [];
  }

  if (shopNos.length === 0 && primaryShopId) {
    shopNos = [primaryShopId];
  }

  if (shopNos.length === 0) {
    return NextResponse.json(
      {
        error:
          "배민 매장 번호가 없습니다. store_platform_shops가 비어 있으면 연동·동기화 후 다시 시도하거나 body에 shopNos를 넣으세요.",
      },
      { status: 400 },
    );
  }

  const cookies = await getBaeminCookies(storeId, userId);
  if (!cookies?.length) {
    return NextResponse.json(
      { error: "배민 세션 쿠키가 없습니다. 먼저 배민 연동을 완료하세요." },
      { status: 400 },
    );
  }

  try {
    const meta = await fetchBaeminShopMetaBatchViaBrowser(cookies, shopNos);
    const dryRun = body.dryRun === true;

    if (!dryRun) {
      await upsertStorePlatformShops(
        supabase,
        storeId,
        "baemin",
        meta.map((r) => ({
          platform_shop_external_id: r.shopNo,
          shop_name: r.shop_name,
          shop_category: r.shop_category,
          is_primary: !!primaryShopId && r.shopNo === primaryShopId,
        })),
      );
    }

    return NextResponse.json({
      ok: true,
      storeId,
      dryRun,
      shopCount: meta.length,
      meta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dev/refresh-baemin-platform-shops]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
