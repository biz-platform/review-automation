/**
 * 땡겨요 정산(입금) 내역 API (`POST .../requestImdtlPaymAmt`)
 * - `paym_plan_dt`(정산일) + `paym_amt`(정산금액) 제공
 * - 브라우저 문서 컨텍스트에서 `credentials: "include"`로 호출해야 SESSION 쿠키가 전달된다.
 */

export const DDANGYO_IMDTL_PAYM_AMT_URL =
  "https://boss.ddangyo.com/o2o/shop/pu/requestImdtlPaymAmt";
export const DDANGYO_IMDTL_PAYM_AMT_SUBMISSION_ID =
  "mf_wfm_contents_sbm_commonSbmObject";
export const DDANGYO_IMDTL_PAYM_AMT_PAGE_ROW_CNT = 10;

export type DdangyoSettlementDmaPara = {
  patsto_no: string;
  biz_reg_no: string;
  sotid: string;
  inq_st_dt: string; // YYYYMMDD
  inq_ed_dt: string; // YYYYMMDD
  page_num: number;
  page_row_cnt: number;
  rowStatus: string;
};

export type DdangyoSettlementRow = {
  paym_plan_dt?: string; // YYYYMMDD
  ajst_div_cd?: string;
  paym_plan_no?: string | null;
  paym_div_cd?: string;
  tab_gubun?: string;
  wtran_rslt_cd?: string;
  wtran_rslt_nm?: string;
  paym_amt?: string; // "25058.00"
  patsto_no?: string;
  total_cnt?: string | number;
  [key: string]: unknown;
};

export type DdangyoSettlementResponse = {
  dma_error?: { resultCode?: string; resultMsg?: string | null; result?: string };
  body_imdtlPaymAmt?: unknown;
  dlt_data_result_list?: DdangyoSettlementRow[];
  [key: string]: unknown;
};

export function ddangyoSettlementFetchPayloadForEvaluate(args: {
  url: string;
  submissionid: string;
  dma_para: DdangyoSettlementDmaPara[];
}): { url: string; submissionid: string; body: string } {
  return {
    url: args.url,
    submissionid: args.submissionid,
    body: JSON.stringify({ dma_para: args.dma_para }),
  };
}

function parseTotalCnt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

export async function fetchDdangyoSettlementAllPagesInPage(
  page: import("playwright").Page,
  base: Omit<DdangyoSettlementDmaPara, "page_num" | "page_row_cnt">,
  options?: { log?: (msg: string, extra?: unknown) => void },
): Promise<{
  rows: DdangyoSettlementRow[];
  totalCnt: number | null;
  pages: number;
  lastJson: DdangyoSettlementResponse | null;
}> {
  const log = options?.log ?? (() => {});
  const rows: DdangyoSettlementRow[] = [];
  let totalCnt: number | null = null;
  let lastJson: DdangyoSettlementResponse | null = null;
  let pageNum = 1;
  let pages = 0;

  for (;;) {
    const dma: DdangyoSettlementDmaPara = {
      ...base,
      page_num: pageNum,
      page_row_cnt: DDANGYO_IMDTL_PAYM_AMT_PAGE_ROW_CNT,
    };
    const payload = ddangyoSettlementFetchPayloadForEvaluate({
      url: DDANGYO_IMDTL_PAYM_AMT_URL,
      submissionid: DDANGYO_IMDTL_PAYM_AMT_SUBMISSION_ID,
      dma_para: [dma],
    });

    const out = (await page.evaluate(
      async (p: { url: string; submissionid: string; body: string }) => {
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
          return { ok: res.ok, status: res.status, json: json as DdangyoSettlementResponse | null };
        } catch (e) {
          return { ok: false, status: 0, json: null as DdangyoSettlementResponse | null, err: String(e) };
        }
      },
      payload,
    )) as { ok: boolean; status: number; json: DdangyoSettlementResponse | null; err?: string };

    if (!out.ok || !out.json) {
      log("[ddangyo-settlement-fetch] page failed", { pageNum, status: out.status, err: out.err });
      break;
    }

    lastJson = out.json;
    const code = out.json.dma_error?.resultCode ?? out.json.dma_error?.result;
    if (code != null && code !== "0000" && code !== "SUCCESS") {
      log("[ddangyo-settlement-fetch] api resultCode", { code, dma_error: out.json.dma_error });
    }

    const chunk = Array.isArray(out.json.dlt_data_result_list) ? out.json.dlt_data_result_list : [];
    rows.push(...chunk);
    pages += 1;

    if (totalCnt == null) {
      totalCnt = parseTotalCnt(chunk[0]?.total_cnt);
    }

    const t = totalCnt ?? 0;
    const maxPage = t > 0 ? Math.ceil(t / DDANGYO_IMDTL_PAYM_AMT_PAGE_ROW_CNT) : 1;
    log("[ddangyo-settlement-fetch] page", { pageNum, chunkLen: chunk.length, totalCnt: t, maxPage });

    if (chunk.length === 0) break;
    if (pageNum >= maxPage) break;
    pageNum += 1;
    if (pageNum > 5000) break;
  }

  return { rows, totalCnt, pages, lastJson };
}

