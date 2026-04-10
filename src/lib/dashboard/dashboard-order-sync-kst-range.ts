import { formatKstYmd } from "@/lib/utils/kst-date";
import type { BaeminV4OrderContentRow } from "@/lib/dashboard/baemin-dashboard-types";
import type { DdangyoOrderListRow } from "@/lib/services/ddangyo/ddangyo-orders-fetch";
import type { YogiyoOrderProxyItem } from "@/lib/services/yogiyo/yogiyo-orders-fetch";

/** KST 달력 `YYYY-MM-DD` 닫힌 구간 (양끝 포함) */
export type KstYmdClosedRange = { startYmd: string; endYmd: string };

/** 행에서 뽑은 구간과 동기화 창(fallback)을 합친 replace 범위 — 둘 중 하나만 있어도 됨 */
export function mergeKstYmdClosedRanges(
  fromRows: KstYmdClosedRange | null | undefined,
  fallback: KstYmdClosedRange | null | undefined,
): KstYmdClosedRange | null {
  const a = fromRows ?? null;
  const b = fallback ?? null;
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return {
    startYmd: a.startYmd < b.startYmd ? a.startYmd : b.startYmd,
    endYmd: a.endYmd > b.endYmd ? a.endYmd : b.endYmd,
  };
}

/** 땡겨요 API `setl_dt_st` / `setl_dt_ed` (YYYYMMDD) → KST 구간 */
export function kstClosedRangeFromDdangyoSettleCompact(args: {
  setl_dt_st: string;
  setl_dt_ed: string;
}): KstYmdClosedRange | null {
  const st = String(args.setl_dt_st).replace(/\D/g, "");
  const ed = String(args.setl_dt_ed).replace(/\D/g, "");
  if (!/^\d{8}$/.test(st) || !/^\d{8}$/.test(ed)) return null;
  const startYmd = `${st.slice(0, 4)}-${st.slice(4, 6)}-${st.slice(6, 8)}`;
  const endYmd = `${ed.slice(0, 4)}-${ed.slice(4, 6)}-${ed.slice(6, 8)}`;
  if (startYmd > endYmd) return null;
  return { startYmd, endYmd };
}

/** 요기요 등 `yyyy-MM-dd` 쌍 */
export function kstClosedRangeFromIsoDatePair(
  dateFrom: string,
  dateTo: string,
): KstYmdClosedRange | null {
  const a = dateFrom.trim();
  const b = dateTo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    return null;
  }
  if (a > b) return null;
  return { startYmd: a, endYmd: b };
}

function expandRange(
  cur: KstYmdClosedRange | null,
  ymd: string,
): KstYmdClosedRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return cur;
  if (!cur) return { startYmd: ymd, endYmd: ymd };
  return {
    startYmd: ymd < cur.startYmd ? ymd : cur.startYmd,
    endYmd: ymd > cur.endYmd ? ymd : cur.endYmd,
  };
}

/** 배민 v4 주문 행 → 해당 점포 스냅샷이 덮는 KST 일자 범위 */
export function kstClosedRangeFromBaeminV4ContentsForShop(
  rows: readonly BaeminV4OrderContentRow[],
): KstYmdClosedRange | null {
  let r: KstYmdClosedRange | null = null;
  for (const row of rows) {
    const raw = row.order?.orderDateTime?.trim();
    if (!raw) continue;
    let t: number;
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
      t = Date.parse(raw);
    } else {
      t = Date.parse(`${raw}+09:00`);
    }
    if (Number.isNaN(t)) continue;
    r = expandRange(r, formatKstYmd(new Date(t)));
  }
  return r;
}

/** 땡겨요 주문 목록 행 → 결제일(`setl_dt` YYYYMMDD) KST 범위 */
export function kstClosedRangeFromDdangyoOrderListRows(
  rows: readonly DdangyoOrderListRow[],
): KstYmdClosedRange | null {
  let r: KstYmdClosedRange | null = null;
  for (const row of rows) {
    const dt =
      typeof row.setl_dt === "string" ? row.setl_dt.trim().replace(/\D/g, "") : "";
    if (!/^\d{8}$/.test(dt)) continue;
    const ymd = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    r = expandRange(r, ymd);
  }
  return r;
}

/** 요기요 proxy 주문 → `submitted_at` KST 범위 */
export function kstClosedRangeFromYogiyoProxyOrders(
  rows: readonly YogiyoOrderProxyItem[],
): KstYmdClosedRange | null {
  let r: KstYmdClosedRange | null = null;
  for (const row of rows) {
    const s = row.submitted_at?.trim();
    if (!s) continue;
    const t = Date.parse(`${s.replace(" ", "T")}+09:00`);
    if (Number.isNaN(t)) continue;
    r = expandRange(r, formatKstYmd(new Date(t)));
  }
  return r;
}
