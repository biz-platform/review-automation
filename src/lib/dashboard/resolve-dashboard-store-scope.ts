import type { SupabaseClient } from "@supabase/supabase-js";
import { parseStoreFilterSegment } from "@/app/(protected)/manage/reviews/reviews-manage/store-filter-utils";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { AppBadRequestError, AppNotFoundError } from "@/lib/errors/app-error";

export const DASHBOARD_PLATFORMS = [
  "baemin",
  "coupang_eats",
  "yogiyo",
  "ddangyo",
] as const;

const STORE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DashboardMultiSegment = {
  storeId: string;
  platform: string;
  platformShopExternalId: string | null;
};

export type ResolvedDashboardStoreScope = {
  storeIdsForQuery: string[];
  multiSegments: DashboardMultiSegment[] | null;
  platformEq: string | null;
  shopEq: string | null;
  platformConflict: boolean;
  platformFilter: string | null;
};

/**
 * 대시보드 glance / 리뷰 분석 등 동일한 매장·플랫폼 스코프 해석.
 * `ownerUserId`: 매장 `stores.user_id` (회원 본인 또는 어드민이 보는 고객 id).
 */
export async function resolveDashboardStoreScope(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    storeIdRaw: string;
    platformParam: string;
  },
): Promise<ResolvedDashboardStoreScope> {
  const { ownerUserId, storeIdRaw, platformParam } = args;

  const platformFilter =
    platformParam &&
    DASHBOARD_PLATFORMS.includes(
      platformParam as (typeof DASHBOARD_PLATFORMS)[number],
    )
      ? platformParam
      : null;

  const allStoresScope = storeIdRaw === DASHBOARD_ALL_STORES_ID;

  let compositePlatform: string | null = null;
  let compositeShopExternalId: string | null = null;
  let resolvedStoreUuid: string | null = null;
  let multiSegments: DashboardMultiSegment[] | null = null;

  if (!allStoresScope) {
    if (storeIdRaw.includes(",") && storeIdRaw.includes(":")) {
      const parts = storeIdRaw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message:
            "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
        });
      }
      const parsedList = parts.map((p) => parseStoreFilterSegment(p));
      const segs: DashboardMultiSegment[] = [];
      for (const parsed of parsedList) {
        if (
          !parsed?.storeId?.trim() ||
          !STORE_UUID_RE.test(parsed.storeId.trim())
        ) {
          throw new AppBadRequestError({
            code: "INVALID_STORE_ID",
            message:
              "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
          });
        }
        if (
          !DASHBOARD_PLATFORMS.includes(
            parsed.platform as (typeof DASHBOARD_PLATFORMS)[number],
          )
        ) {
          throw new AppBadRequestError({
            code: "INVALID_STORE_ID",
            message: "지원하지 않는 플랫폼입니다.",
          });
        }
        segs.push({
          storeId: parsed.storeId.trim(),
          platform: parsed.platform,
          platformShopExternalId: parsed.platformShopExternalId?.trim() || null,
        });
      }
      multiSegments = segs;
    } else if (storeIdRaw.includes(":")) {
      const parsed = parseStoreFilterSegment(storeIdRaw);
      if (
        !parsed?.storeId?.trim() ||
        !STORE_UUID_RE.test(parsed.storeId.trim())
      ) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message:
            "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
        });
      }
      if (
        !DASHBOARD_PLATFORMS.includes(
          parsed.platform as (typeof DASHBOARD_PLATFORMS)[number],
        )
      ) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message: "지원하지 않는 플랫폼입니다.",
        });
      }
      resolvedStoreUuid = parsed.storeId.trim();
      compositePlatform = parsed.platform;
      compositeShopExternalId = parsed.platformShopExternalId?.trim() || null;
    } else {
      if (!STORE_UUID_RE.test(storeIdRaw)) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message:
            "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
        });
      }
      resolvedStoreUuid = storeIdRaw;
    }
  }

  let storeIdsForQuery: string[] = [];

  if (allStoresScope) {
    const { data: storeRows, error: storesErr } = await supabase
      .from("stores")
      .select("id")
      .eq("user_id", ownerUserId);

    if (storesErr) throw storesErr;
    storeIdsForQuery = (storeRows ?? []).map((r) => r.id).filter(Boolean);
    if (storeIdsForQuery.length === 0) {
      throw new AppNotFoundError({
        code: "STORE_NOT_FOUND",
        message: "연동된 매장이 없습니다.",
      });
    }
  } else {
    if (multiSegments != null) {
      const want = [...new Set(multiSegments.map((s) => s.storeId))];
      const { data: storeRows, error: storeErr } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", ownerUserId)
        .in("id", want);
      if (storeErr) throw storeErr;
      const ok = new Set((storeRows ?? []).map((r) => r.id));
      if (ok.size !== want.length) {
        throw new AppNotFoundError({
          code: "STORE_NOT_FOUND",
          message: "매장을 찾을 수 없습니다.",
        });
      }
      storeIdsForQuery = want;
    } else {
      const { data: storeRow, error: storeErr } = await supabase
        .from("stores")
        .select("id")
        .eq("id", resolvedStoreUuid!)
        .eq("user_id", ownerUserId)
        .maybeSingle();

      if (storeErr) throw storeErr;
      if (!storeRow) {
        throw new AppNotFoundError({
          code: "STORE_NOT_FOUND",
          message: "매장을 찾을 수 없습니다.",
        });
      }
      storeIdsForQuery = [storeRow.id];
    }
  }

  let platformEq: string | null = compositePlatform;
  const shopEq: string | null = compositeShopExternalId;
  let platformConflict = false;

  if (platformFilter) {
    if (platformEq !== null && platformEq !== platformFilter) {
      platformConflict = true;
    } else {
      platformEq = platformFilter;
    }
  }

  return {
    storeIdsForQuery,
    multiSegments,
    platformEq,
    shopEq,
    platformConflict,
    platformFilter,
  };
}
