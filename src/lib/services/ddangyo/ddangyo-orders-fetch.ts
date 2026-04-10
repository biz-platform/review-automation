/**
 * 땡겨요 사장님라운지 주문내역 `POST .../requestQryOrderList` (테스트·향후 연동용).
 * @see https://boss.ddangyo.com/#SH0402
 */
import { platformOrdersDateRangeInclusiveKst } from "@/lib/utils/kst-date";

export const DDANGYO_ORDER_LIST_URL =
  "https://boss.ddangyo.com/o2o/shop/pu/requestQryOrderList";
export const DDANGYO_ORDER_LIST_SUBMISSION_ID = "mf_wfm_contents_sbm_commonSbmObject";
export const DDANGYO_ORDER_LIST_PAGE_ROW_CNT = 10;

export type DdangyoOrderListDmaPara = {
  psnl_mbr_id: string;
  /** 전체 매장: `"0000000"` + `patsto_nm`: `"가게전체"` */
  patsto_no: string;
  biz_reg_no: string;
  setl_dt_st: string;
  setl_dt_ed: string;
  regl_cust_yn: string;
  ord_prog_stat_cd: string;
  ord_tp_cd: string;
  page_num: number;
  page_row_cnt: number;
  rpsnt_patsto_no: string;
  excel_yn: string;
  patsto_nm: string;
};

export type DdangyoOrderListRow = {
  patsto_no?: string;
  ord_no?: string;
  ord_id?: string;
  setl_dt?: string;
  setl_tm?: string;
  menu_nm?: string;
  tot_setl_amt?: string;
  sale_amt?: string;
  ord_tp_nm?: string;
  total_cnt?: number | string;
  [key: string]: unknown;
};

export type DdangyoOrderListResponse = {
  dma_error?: { resultCode?: string; resultMsg?: string | null };
  dlt_result?: DdangyoOrderListRow[];
  dlt_result_single?: { tot_cnt?: number; tot_sum?: number };
};

/** KST 기준 최근 `days`일(오늘 포함) 결제일 구간 → `YYYYMMDD` — 배민·요기요와 동일 {@link platformOrdersDateRangeInclusiveKst} */
export function ddangyoOrderListSettleRangeCompactDays(
  days: number,
  now: Date = new Date(),
): { setl_dt_st: string; setl_dt_ed: string } {
  const { startYmd, endYmd } = platformOrdersDateRangeInclusiveKst(days, now);
  return {
    setl_dt_st: startYmd.replace(/-/g, ""),
    setl_dt_ed: endYmd.replace(/-/g, ""),
  };
}

export function buildDdangyoOrderListBody(dma: DdangyoOrderListDmaPara): {
  dma_para: DdangyoOrderListDmaPara;
} {
  return { dma_para: dma };
}

/**
 * 브라우저 문서 컨텍스트에서 호출: `credentials: "include"` 로 세션 쿠키 전달.
 * (Playwright `page.evaluate` 안에서 실행)
 */
export function ddangyoOrderListFetchPayloadForEvaluate(args: {
  url: string;
  submissionid: string;
  dma_para: DdangyoOrderListDmaPara;
}): { url: string; submissionid: string; body: string } {
  return {
    url: args.url,
    submissionid: args.submissionid,
    body: JSON.stringify({ dma_para: args.dma_para }),
  };
}

/**
 * 첫 응답의 `total_cnt` / `dlt_result_single.tot_cnt`로 전체 페이지 순회.
 */
export async function fetchDdangyoOrderListAllPagesInPage(
  page: import("playwright").Page,
  baseDma: Omit<DdangyoOrderListDmaPara, "page_num" | "page_row_cnt">,
  options?: { log?: (msg: string, extra?: unknown) => void },
): Promise<{
  rows: DdangyoOrderListRow[];
  totalCnt: number | null;
  pages: number;
  lastJson: DdangyoOrderListResponse | null;
}> {
  const log = options?.log ?? (() => {});
  const rows: DdangyoOrderListRow[] = [];
  let totalCnt: number | null = null;
  let lastJson: DdangyoOrderListResponse | null = null;
  let pageNum = 1;
  let pages = 0;

  for (;;) {
    const dma: DdangyoOrderListDmaPara = {
      ...baseDma,
      page_num: pageNum,
      page_row_cnt: DDANGYO_ORDER_LIST_PAGE_ROW_CNT,
    };
    const payload = ddangyoOrderListFetchPayloadForEvaluate({
      url: DDANGYO_ORDER_LIST_URL,
      submissionid: DDANGYO_ORDER_LIST_SUBMISSION_ID,
      dma_para: dma,
    });

    const out = (await page.evaluate(
      async (p: {
        url: string;
        submissionid: string;
        body: string;
      }) => {
        try {
          const res = await fetch(p.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              Accept: "application/json",
              submissionid: p.submissionid,
            },
            body: p.body,
            credentials: "include",
          });
          const text = await res.text();
          let json: unknown = null;
          try {
            json = JSON.parse(text);
          } catch {
            /* ignore */
          }
          return {
            ok: res.ok,
            status: res.status,
            json: json as DdangyoOrderListResponse | null,
          };
        } catch (e) {
          return {
            ok: false,
            status: 0,
            json: null,
            err: String(e),
          };
        }
      },
      payload,
    )) as {
      ok: boolean;
      status: number;
      json: DdangyoOrderListResponse | null;
      err?: string;
    };

    if (!out.ok || !out.json) {
      log("[ddangyo-orders-fetch] page failed", {
        pageNum,
        status: out.status,
        err: out.err,
      });
      break;
    }

    lastJson = out.json;
    const code = out.json.dma_error?.resultCode;
    if (code != null && code !== "000") {
      log("[ddangyo-orders-fetch] api resultCode", {
        code,
        dma_error: out.json.dma_error,
      });
    }

    const chunk = Array.isArray(out.json.dlt_result) ? out.json.dlt_result : [];
    rows.push(...chunk);
    pages += 1;

    const firstTot = chunk[0]?.total_cnt;
    const singleTot = out.json.dlt_result_single?.tot_cnt;
    if (totalCnt == null) {
      if (typeof firstTot === "number") totalCnt = firstTot;
      else if (typeof firstTot === "string" && /^\d+$/.test(firstTot))
        totalCnt = Number(firstTot);
      else if (typeof singleTot === "number") totalCnt = singleTot;
    }

    const t = totalCnt ?? 0;
    const maxPage = t > 0 ? Math.ceil(t / DDANGYO_ORDER_LIST_PAGE_ROW_CNT) : 1;

    log("[ddangyo-orders-fetch] page", { pageNum, chunkLen: chunk.length, totalCnt: t, maxPage });

    if (chunk.length === 0) break;
    if (pageNum >= maxPage) break;
    pageNum += 1;
    if (pageNum > 5000) break;
  }

  return { rows, totalCnt, pages, lastJson };
}
