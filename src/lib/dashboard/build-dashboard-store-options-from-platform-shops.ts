/**
 * 대시보드 매장 셀렉트: `store_platform_shops.shop_name` 정규화 키가 같으면 한 줄로 묶음.
 * `platform_shops`가 비어 폴백 라벨만 있는 행도, 동일 정규화 키면 위와 합침(플랫폼별 shops 백필 불균형 완화).
 */

import type { StoreWithSessionData } from "@/entities/store/types";

const PLATFORM_SUFFIX_LABEL: Record<string, string> = {
  baemin: "배민",
  coupang_eats: "쿠팡이츠",
  ddangyo: "땡겨요",
  yogiyo: "요기요",
};

function withPlatformSuffix(label: string, platform: string): string {
  const trimmed = label.trim();
  const suffix = PLATFORM_SUFFIX_LABEL[platform] ?? platform;
  return `${trimmed}(${suffix})`;
}

function sessionName(s: StoreWithSessionData): string {
  return s.store_name ?? s.name;
}

/** shop_name 동일/근동 판단용 키 */
export function mergeKeyFromShopName(raw: string): string {
  const base = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  return base.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

type FlatRow = {
  storeId: string;
  platform: string;
  externalId: string | null;
  mergeKey: string;
  labelBase: string;
  isPrimary: boolean;
  order: number;
};

const STORE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `computeStoreDisplayName` 플레이스홀더와 동일 — 이걸로만 묶으면 서로 다른 기본 매장이 한 줄로 합쳐짐 */
const PLACEHOLDER_STORE_DISPLAY_NAMES = new Set(["내 매장", "내매장"]);

/**
 * synthetic(`__noshop__`/`__empty__`) 행도 표시명(`labelBase`)이 실매장명이면
 * `shop_name`에서 나온 mergeKey와 동일 키로 묶어, 플랫폼별로 한쪽만 shops 행이 있어도 한 줄로 합친다.
 * 표시명이 비었거나 UUID·플레이스홀더뿐이면 기존처럼 store 단위로 분리.
 */
function dashboardStoreOptionGroupKey(row: FlatRow): string {
  if (!row.mergeKey.startsWith("__")) {
    return row.mergeKey;
  }
  const basis = row.labelBase.normalize("NFKC").trim();
  if (
    !basis ||
    PLACEHOLDER_STORE_DISPLAY_NAMES.has(basis) ||
    STORE_UUID_RE.test(basis)
  ) {
    return `${row.storeId}\0${row.mergeKey}`;
  }
  const fromLabel = mergeKeyFromShopName(basis);
  return fromLabel.length > 0 ? fromLabel : `${row.storeId}\0${row.mergeKey}`;
}

export type DashboardStoreFilterOption = { value: string; label: string };

function pickCanonicalLabelBase(candidates: string[]): string {
  const unique = [
    ...new Set(candidates.map((c) => c.normalize("NFKC").trim()).filter(Boolean)),
  ];
  unique.sort((a, b) => b.length - a.length || a.localeCompare(b, "ko"));
  return unique[0] ?? "";
}

function compoundValue(r: FlatRow): string {
  return r.externalId != null
    ? `${r.storeId}:${r.platform}:${r.externalId}`
    : `${r.storeId}:${r.platform}`;
}

function pickRepresentativeCompound(rows: FlatRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.externalId != null && b.externalId == null) return -1;
    if (a.externalId == null && b.externalId != null) return 1;
    return a.order - b.order;
  });
  return compoundValue(sorted[0]!);
}

function joinSegments(segments: string[]): string {
  return segments.map((s) => s.trim()).filter(Boolean).join(",");
}

export function buildDashboardStoreOptionsFromPlatformShops(args: {
  storesBaemin: StoreWithSessionData[];
  storesCoupangEats: StoreWithSessionData[];
  storesDdangyo: StoreWithSessionData[];
  storesYogiyo: StoreWithSessionData[];
}): DashboardStoreFilterOption[] {
  const platformLists = [
    ["baemin", args.storesBaemin],
    ["coupang_eats", args.storesCoupangEats],
    ["ddangyo", args.storesDdangyo],
    ["yogiyo", args.storesYogiyo],
  ] as const;

  const flat: FlatRow[] = [];
  let order = 0;

  for (const [plat, stores] of platformLists) {
    for (const s of stores) {
      const store = s as StoreWithSessionData;
      const shops = store.platform_shops ?? [];
      const fb =
        (store.display_name ?? "").trim() || sessionName(store) || store.name;

      if (
        (plat === "baemin" ||
          plat === "coupang_eats" ||
          plat === "yogiyo" ||
          plat === "ddangyo") &&
        shops.length > 0
      ) {
        for (const shop of shops) {
          const raw = shop.shop_name?.trim() ?? "";
          const ext = String(shop.platform_shop_external_id ?? "").trim();
          const mergeKey = raw
            ? mergeKeyFromShopName(raw)
            : `__empty__:${plat}:${ext || `i${order}`}`;

          const labelBase = raw || fb || ext || store.id;

          flat.push({
            storeId: store.id,
            platform: plat,
            externalId: ext || null,
            mergeKey,
            labelBase,
            isPrimary: Boolean(shop.is_primary),
            order: order++,
          });
        }
        continue;
      }

      flat.push({
        storeId: store.id,
        platform: plat,
        externalId: null,
        mergeKey: `__noshop__:${store.id}:${plat}`,
        labelBase: fb,
        isPrimary: false,
        order: order++,
      });
    }
  }

  type Acc = { rows: FlatRow[]; firstOrder: number };
  const groupMap = new Map<string, Acc>();

  for (const row of flat) {
    // shop_name 기반 그룹은 storeId가 달라도 같은 매장으로 묶는다.
    // synthetic은 원칙적으로 storeId 단위 분리였으나, labelBase가 실매장명이면 shop_name과 같은 키로 재분류.
    const gk = dashboardStoreOptionGroupKey(row);
    const cur = groupMap.get(gk);
    if (cur) cur.rows.push(row);
    else groupMap.set(gk, { rows: [row], firstOrder: row.order });
  }

  const groups = [...groupMap.values()].sort((a, b) => {
    // 멀티 플랫폼(연동 수 많은 매장) 우선 노출
    const aPlat = new Set(a.rows.map((r) => r.platform)).size;
    const bPlat = new Set(b.rows.map((r) => r.platform)).size;
    if (aPlat !== bPlat) return bPlat - aPlat;
    // 동률이면 기존 순서(첫 등장) 유지
    return a.firstOrder - b.firstOrder;
  });

  const usedValues = new Set<string>();
  const out: DashboardStoreFilterOption[] = [{ value: "", label: "매장 전체" }];

  for (const { rows } of groups) {
    const storeId = rows[0].storeId;
    const platforms = new Set(rows.map((r) => r.platform));
    const canonicalLabel = pickCanonicalLabelBase(rows.map((r) => r.labelBase));

    let value: string;
    if (platforms.size > 1) {
      // 같은 매장 그룹 내 여러 플랫폼이면, 플랫폼별 대표 세그먼트를 콤마로 묶어서 value로 사용.
      // 예) "<uuid1>:baemin:<shopNo>,<uuid2>:yogiyo:<shopNo>"
      const byPlatform = new Map<
        string,
        { rows: FlatRow[]; firstOrder: number }
      >();
      for (const r of rows) {
        const cur = byPlatform.get(r.platform);
        if (cur) cur.rows.push(r);
        else byPlatform.set(r.platform, { rows: [r], firstOrder: r.order });
      }
      const picked = [...byPlatform.entries()]
        .sort((a, b) => a[1].firstOrder - b[1].firstOrder)
        .map(([, acc]) => pickRepresentativeCompound(acc.rows));
      value = joinSegments(picked);
    } else {
      value = pickRepresentativeCompound(rows);
    }

    if (usedValues.has(value)) {
      const alt = rows.find((r) => !usedValues.has(compoundValue(r)));
      if (alt) value = compoundValue(alt);
    }
    usedValues.add(value);

    let label: string;
    if (platforms.size > 1) {
      label = canonicalLabel;
    } else {
      label = withPlatformSuffix(canonicalLabel, rows[0].platform);
    }

    // 멀티 플랫폼 그룹은 storeId가 섞일 수 있으니, 모든 storeId가 UUID 형태인지만 확인.
    const allUuid = rows.every((r) => STORE_UUID_RE.test(r.storeId));
    if (!allUuid) continue;
    out.push({ value, label });
  }

  return out;
}
