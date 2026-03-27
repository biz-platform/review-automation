/** 리뷰 관리 매장 필터: 값/라벨 파싱·표시용 공통 유틸 */

export type ParsedStoreFilterTarget = {
  storeId: string;
  platform: string;
  platformShopExternalId?: string;
};

/** "uuid:baemin:10652466" 또는 "uuid:coupang_eats:480399" 등 세그먼트 하나 파싱 */
export function parseStoreFilterSegment(segment: string): ParsedStoreFilterTarget | null {
  const p = segment.trim();
  if (!p) return null;
  const parts = p.split(":");
  if (parts.length >= 3 && parts[1]) {
    const platform = parts[1].trim();
    if (!platform) return null;
    return {
      storeId: parts[0] ?? "",
      platform,
      platformShopExternalId: parts.slice(2).join(":").trim() || undefined,
    };
  }
  const i = p.indexOf(":");
  if (i <= 0) return null;
  return {
    storeId: p.slice(0, i),
    platform: p.slice(i + 1),
  };
}

/** 콤마로 이어진 필터 값 → 대상 목록 */
export function parseStoreFilterList(selectedStoreId: string): ParsedStoreFilterTarget[] {
  if (!selectedStoreId.trim()) return [];
  return selectedStoreId
    .split(",")
    .map((s) => parseStoreFilterSegment(s))
    .filter((v): v is ParsedStoreFilterTarget => v != null && !!v.storeId && !!v.platform);
}

function isLikelyStoreUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

/** API 목록/카운트용: 비배민·전체 탭에서 매장·플랫폼 좁히기 (복수 타깃은 linked_only 유지 → 클라 필터) */
export type NonBaeminReviewListNarrowing = {
  store_id?: string;
  platform?: string;
  platform_shop_external_id?: string;
  linked_only?: boolean;
};

export function buildNonBaeminReviewListNarrowing(input: {
  platformTab: string;
  selectedStoreId: string;
}): NonBaeminReviewListNarrowing {
  const platformFromTab =
    input.platformTab && input.platformTab !== "baemin"
      ? input.platformTab
      : undefined;

  const sel = input.selectedStoreId.trim();
  if (!sel) {
    return {
      platform: platformFromTab,
      linked_only: true,
    };
  }

  const targets = parseStoreFilterList(sel);
  if (targets.length === 1) {
    const t = targets[0];
    return {
      store_id: t.storeId,
      platform: t.platform,
      ...(t.platformShopExternalId
        ? { platform_shop_external_id: t.platformShopExternalId }
        : {}),
    };
  }
  if (targets.length > 1) {
    return {
      platform: platformFromTab,
      linked_only: true,
    };
  }

  const first = sel.split(",")[0]?.trim() ?? "";
  if (first && !first.includes(":") && isLikelyStoreUuid(first)) {
    return {
      store_id: first,
      ...(platformFromTab ? { platform: platformFromTab } : {}),
    };
  }

  return {
    platform: platformFromTab,
    linked_only: true,
  };
}

/** 배민 매장 옵션 라벨: 동일 문자열이 겹치면 매장번호 접미사로 구분 */
export function disambiguateBaeminShopLabels(
  items: { platform_shop_external_id: string; label: string }[],
): { platform_shop_external_id: string; label: string }[] {
  const countByLabel = new Map<string, number>();
  for (const it of items) {
    const k = it.label.trim() || it.platform_shop_external_id;
    countByLabel.set(k, (countByLabel.get(k) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return items.map((it) => {
    const base = it.label.trim() || it.platform_shop_external_id;
    const dupKey = base;
    const total = countByLabel.get(dupKey) ?? 1;
    if (total <= 1) return it;
    const n = (seen.get(dupKey) ?? 0) + 1;
    seen.set(dupKey, n);
    return {
      ...it,
      label: `${base} (매장 ${it.platform_shop_external_id})`,
    };
  });
}
