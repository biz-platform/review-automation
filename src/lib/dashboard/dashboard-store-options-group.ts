/**
 * 대시보드 매장 셀렉트 전용: 댓글 관리와 달리 표시 라벨을 정규화해
 * 동일 매장으로 보이는 항목을 한 줄로 묶는다.
 *
 * DB 샘플 기준: 공백/하이픈/& 등만 다른 동일 명칭(예: 국시촌 상남점 vs 국시촌-상남점)이
 * 같은 그룹으로 합쳐진다. 동일 storeId 내에서만 묶인다.
 */

import { PLATFORMS_LINKED } from "@/app/(protected)/manage/reviews/constants";

const STORE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UI에서 붙는 (배민)(쿠팡이츠) 등 끝쪽 괄호 표기 제거 */
export function stripDashboardStorePlatformSuffix(label: string): string {
  let s = label.normalize("NFKC").trim();
  s = s.replace(/\u200b/g, "");
  for (let i = 0; i < 4; i++) {
    const next = s.replace(
      /\(\s*(?:배달의민족|배민|쿠팡이츠|요기요|땡겨요)\s*\)\s*$/u,
      "",
    ).trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * 특수문자·띄어쓰기 등을 제거한 비교 키 (한글·라틴·숫자만 유지)
 */
export function normalizeStoreLabelForDashboardGrouping(label: string): string {
  const base = stripDashboardStorePlatformSuffix(label);
  return base.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/**
 * 정규화 키가 목록에서 한 번만 나오면 `매장명(플랫폼)` 유지, 2회 이상이면 `매장명`만 (플랫폼 접미 제거).
 */
export function formatDashboardStoreLabels(
  options: StoreFilterOption[],
): StoreFilterOption[] {
  const rest = options.filter((o) => o.value !== "");
  const keys = rest.map((o) =>
    normalizeStoreLabelForDashboardGrouping(o.label),
  );
  const freq = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  return options.map((o) => {
    if (o.value === "") return o;
    const k = normalizeStoreLabelForDashboardGrouping(o.label);
    const unique = k && (freq.get(k) ?? 0) === 1;
    if (unique) return o;
    const stripped = stripDashboardStorePlatformSuffix(o.label).trim();
    return {
      ...o,
      label: stripped || o.label,
    };
  });
}

/**
 * 같은 매장(storeId)인데 그룹 키가 달라 여러 줄로 남은 경우, 포맷 후 표시 라벨이 동일하면 한 줄로 합친다.
 * (첫 행의 value 유지 — 보통 더 넓은 스코프의 id가 앞에 옴)
 */
export function dedupeDashboardStoreOptionsByStoreAndDisplayLabel(
  options: StoreFilterOption[],
): StoreFilterOption[] {
  const seen = new Set<string>();
  const out: StoreFilterOption[] = [];

  for (const o of options) {
    if (o.value === "") {
      out.push(o);
      continue;
    }
    const storeId = o.value.split(":")[0]?.trim() ?? "";
    if (!storeId || !STORE_UUID_RE.test(storeId)) {
      out.push(o);
      continue;
    }
    const labelKey = o.label.normalize("NFKC").trim();
    const dedupeKey = `${storeId}\0${labelKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(o);
  }
  return out;
}

/** `uuid:플랫폼` / `uuid:플랫폼:외부id` → 플랫폼 코드. 순수 UUID면 null */
export function parsePlatformFromStoreFilterValue(value: string): string | null {
  const parts = value.split(":");
  if (parts.length >= 2 && parts[1]) return parts[1];
  return null;
}

/**
 * 상단 플랫폼 칩이 있을 때: 해당 플랫폼과 맞는 매장 옵션만 선택 가능.
 * 순수 UUID(매장 전체)는 그 매장에 해당 플랫폼 연동이 있을 때만 활성.
 */
export function isDashboardStoreOptionEnabledForPlatform(
  rawValue: string,
  platformFilter: string | null | undefined,
  storeLinkedTo: (storeId: string, platform: string) => boolean,
): boolean {
  const p = platformFilter?.trim();
  if (
    !p ||
    !PLATFORMS_LINKED.includes(p as (typeof PLATFORMS_LINKED)[number])
  ) {
    return true;
  }
  if (rawValue === "" || rawValue === "all") return true;
  const parts = rawValue.split(":");
  const storeId = parts[0] ?? "";
  if (!storeId) return true;
  if (parts.length === 1) {
    return storeLinkedTo(storeId, p);
  }
  return parts[1] === p;
}

function pickMergedLabel(labels: string[]): string {
  const unique = [
    ...new Set(labels.map((l) => l.normalize("NFKC").trim()).filter(Boolean)),
  ];
  unique.sort((a, b) => b.length - a.length || a.localeCompare(b, "ko"));
  return stripDashboardStorePlatformSuffix(unique[0] ?? "").trim();
}

export type StoreFilterOption = { value: string; label: string };

/**
 * `useReviewsManageStores`의 `storeFilterOptions`를 받아, 같은 storeId·정규화 라벨이면
 * 한 줄로 합친다. 합친 행의 value는 해당 매장 UUID(전 플랫폼 집계)로 둔다.
 */
export function groupDashboardStoreSelectOptions(
  options: StoreFilterOption[],
): StoreFilterOption[] {
  if (options.length <= 1) return options;

  const head = options[0];
  if (head.value !== "") {
    return groupHeadless(options);
  }

  const tail = options.slice(1);
  return [head, ...groupHeadless(tail)];
}

function groupHeadless(options: StoreFilterOption[]): StoreFilterOption[] {
  type Acc = { items: StoreFilterOption[]; firstIndex: number };
  const map = new Map<string, Acc>();

  options.forEach((o, i) => {
    const storeId = o.value.split(":")[0]?.trim() ?? "";
    let key: string;

    if (!storeId || !STORE_UUID_RE.test(storeId)) {
      key = `__raw_${i}_${o.value}`;
    } else {
      const nk = normalizeStoreLabelForDashboardGrouping(o.label);
      key = nk ? `${storeId}::${nk}` : `__nocol_${storeId}_${i}_${o.value}`;
    }

    const cur = map.get(key);
    if (cur) cur.items.push(o);
    else map.set(key, { items: [o], firstIndex: i });
  });

  const groups = [...map.values()].sort((a, b) => a.firstIndex - b.firstIndex);

  /** `<select>`는 `option value`가 유일해야 함. 같은 storeId로 여러 그룹이 병합되면 순수 UUID가 중복될 수 있음 */
  const usedValues = new Set<string>();
  const out: StoreFilterOption[] = [];

  for (const { items } of groups) {
    if (items.length === 1) {
      const o = items[0];
      usedValues.add(o.value);
      out.push(o);
      continue;
    }

    const storeId = items[0].value.split(":")[0]!;
    const label = pickMergedLabel(items.map((x) => x.label));
    let value = storeId;

    if (usedValues.has(value)) {
      const fallback = items.find((it) => !usedValues.has(it.value));
      value = fallback?.value ?? value;
    }

    usedValues.add(value);
    out.push({ value, label });
  }

  return out;
}
