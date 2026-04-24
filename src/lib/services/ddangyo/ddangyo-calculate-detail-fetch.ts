/**
 * 땡겨요 정산(입금) 상세 API (`POST .../requestQryCalculateDetail`)
 * - 정산 1건(paym_plan_dt 등) 기준으로 주문일자(`setl_dt`)가 포함된 breakdown을 제공
 * - 브라우저 문서 컨텍스트에서 `credentials: "include"`로 호출해야 SESSION 쿠키가 전달된다.
 */

export const DDANGYO_CALCULATE_DETAIL_URL =
  "https://boss.ddangyo.com/o2o/shop/pu/requestQryCalculateDetail";
export const DDANGYO_CALCULATE_DETAIL_SUBMISSION_ID =
  "mf_wfm_contents_SMWPU030000P01_wframe_sbm_commonSbmObject";

export type DdangyoCalculateDetailReqRow = {
  paym_plan_dt: string;
  ajst_div_cd: string;
  paym_plan_no: string;
  tab_gubun: string;
  patsto_no: string;
  paym_div_cd: string;
  wtran_rslt_cd: string;
  rowStatus: string;
};

export type DdangyoCalculateDetailAmtRow = {
  setl_dt?: string; // YYYYMMDD (주문/정산 기준일로 보임)
  paym_plan_dt?: string; // YYYYMMDD
  paym_amt?: number | string; // breakdown row의 금액 (예: 25058)
  payn_amt?: number | string; // 예: 25058
  patsto_no?: string;
  wtran_rslt_nm?: string;
  [key: string]: unknown;
};

export type DdangyoCalculateDetailResponse = {
  dma_error?: { resultCode?: string; resultMsg?: string | null; result?: string };
  dlt_amtList?: DdangyoCalculateDetailAmtRow[];
  dlt_ajst?: unknown;
  [key: string]: unknown;
};

export function ddangyoCalculateDetailFetchPayloadForEvaluate(args: {
  url: string;
  submissionid: string;
  dlt_param_req: DdangyoCalculateDetailReqRow[];
}): { url: string; submissionid: string; body: string } {
  return {
    url: args.url,
    submissionid: args.submissionid,
    body: JSON.stringify({ dlt_param_req: args.dlt_param_req }),
  };
}

export async function fetchDdangyoCalculateDetailInPage(
  page: import("playwright").Page,
  req: DdangyoCalculateDetailReqRow,
): Promise<{ rows: DdangyoCalculateDetailAmtRow[]; lastJson: DdangyoCalculateDetailResponse | null }> {
  const payload = ddangyoCalculateDetailFetchPayloadForEvaluate({
    url: DDANGYO_CALCULATE_DETAIL_URL,
    submissionid: DDANGYO_CALCULATE_DETAIL_SUBMISSION_ID,
    dlt_param_req: [req],
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
        return { ok: res.ok, status: res.status, json: json as DdangyoCalculateDetailResponse | null };
      } catch (e) {
        return { ok: false, status: 0, json: null as DdangyoCalculateDetailResponse | null, err: String(e) };
      }
    },
    payload,
  )) as { ok: boolean; status: number; json: DdangyoCalculateDetailResponse | null; err?: string };

  if (!out.ok || !out.json) {
    return { rows: [], lastJson: null };
  }

  const chunk = Array.isArray(out.json.dlt_amtList) ? out.json.dlt_amtList : [];
  return { rows: chunk, lastJson: out.json };
}

