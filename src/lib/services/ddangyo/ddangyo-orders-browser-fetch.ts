/**
 * Playwright 로그인 후 #SH0402 주문내역 API로 전 페이지 수집 (워커·동기화용).
 */
import { loginDdangyoAndGetCookies } from "@/lib/services/ddangyo/ddangyo-login-service";
import {
  type DdangyoOrderListDmaPara,
  type DdangyoOrderListResponse,
  type DdangyoOrderListRow,
  ddangyoOrderListSettleRangeCompactDays,
  fetchDdangyoOrderListAllPagesInPage,
} from "@/lib/services/ddangyo/ddangyo-orders-fetch";
import {
  fetchDdangyoSettlementAllPagesInPage,
  type DdangyoSettlementRow,
} from "@/lib/services/ddangyo/ddangyo-settlement-fetch";
import {
  fetchDdangyoCalculateDetailInPage,
  type DdangyoCalculateDetailAmtRow,
} from "@/lib/services/ddangyo/ddangyo-calculate-detail-fetch";

const SH0402_URL = "https://boss.ddangyo.com/#SH0402";

export async function fetchDdangyoOrderListAllPagesWithPlaywright(args: {
  username: string;
  password: string;
  /** `settleRange` 없을 때만 사용 (기본 60) */
  daysBack?: number;
  /** 지정 시 결제일 구간 고정 (예: 어제 하루만 YYYYMMDD 동일) */
  settleRange?: { setl_dt_st: string; setl_dt_ed: string };
  log?: (msg: string, extra?: unknown) => void;
}): Promise<{
  rows: DdangyoOrderListRow[];
  totalCnt: number | null;
  pages: number;
  lastJson: DdangyoOrderListResponse | null;
  settlements: DdangyoSettlementRow[];
  settlementDetails: DdangyoCalculateDetailAmtRow[];
  settle_range: { setl_dt_st: string; setl_dt_ed: string };
}> {
  const range =
    args.settleRange ??
    ddangyoOrderListSettleRangeCompactDays(args.daysBack ?? 60);
  const log = args.log ?? (() => {});

  let capturedOut: {
    rows: DdangyoOrderListRow[];
    totalCnt: number | null;
    pages: number;
    lastJson: DdangyoOrderListResponse | null;
    settlements: DdangyoSettlementRow[];
    settlementDetails: DdangyoCalculateDetailAmtRow[];
  } | null = null;

  await loginDdangyoAndGetCookies(args.username, args.password, {
    beforeClose: async (ctx) => {
      const orderReqPromise = ctx.page.waitForRequest(
        (r) =>
          r.url().includes("requestQryOrderList") && r.method() === "POST",
        { timeout: 40_000 },
      );

      await ctx.page.goto(SH0402_URL, {
        waitUntil: "domcontentloaded",
        timeout: 28_000,
      });
      await ctx.page.waitForLoadState("networkidle").catch(() => {});
      await ctx.page.waitForTimeout(500);

      const orderNav = ctx.page.getByRole("link", { name: "주문내역" }).first();
      await orderNav.waitFor({ state: "visible", timeout: 20_000 });
      await orderNav.click();

      let captured: DdangyoOrderListDmaPara | null = null;
      try {
        const req = await orderReqPromise;
        const raw = req.postData();
        if (raw) {
          const j = JSON.parse(raw) as { dma_para?: DdangyoOrderListDmaPara };
          if (j.dma_para && typeof j.dma_para === "object") {
            captured = j.dma_para;
          }
        }
      } catch (e) {
        log(
          "[ddangyo-orders-browser-fetch] requestQryOrderList 캡처 실패",
          e instanceof Error ? e.message : e,
        );
      }

      const biz =
        ctx.business_registration_number?.trim() ??
        captured?.biz_reg_no?.trim() ??
        "";
      const rpsnt =
        ctx.rpsnt_patsto_no?.trim() ?? captured?.rpsnt_patsto_no?.trim() ?? "";
      const psnl =
        captured?.psnl_mbr_id?.trim() ?? ctx.external_user_id?.trim() ?? "";

      if (!biz || !rpsnt) {
        throw new Error(
          `biz_reg_no / rpsnt_patsto_no 없음. biz=${biz}, rpsnt=${rpsnt}`,
        );
      }
      if (!psnl) {
        throw new Error(
          "psnl_mbr_id 없음: #SH0402에서 requestQryOrderList 캡처 실패 또는 external_user_id 미수집.",
        );
      }

      const base: Omit<DdangyoOrderListDmaPara, "page_num" | "page_row_cnt"> = {
        psnl_mbr_id: psnl,
        patsto_no: captured?.patsto_no ?? "0000000",
        biz_reg_no: biz,
        setl_dt_st: range.setl_dt_st,
        setl_dt_ed: range.setl_dt_ed,
        regl_cust_yn: captured?.regl_cust_yn ?? "",
        ord_prog_stat_cd: captured?.ord_prog_stat_cd ?? "",
        ord_tp_cd: captured?.ord_tp_cd ?? "",
        rpsnt_patsto_no: rpsnt,
        excel_yn: "0",
        patsto_nm: captured?.patsto_nm ?? "가게전체",
      };

      log("[ddangyo-orders-browser-fetch] range", range);
      const out = await fetchDdangyoOrderListAllPagesInPage(ctx.page, base, {
        log,
      });

      // 정산(입금) 내역: 동일 세션·기간으로 조회. (patsto_no는 전체/개별 모두 가능; 우선 전체로 조회)
      let settlements: DdangyoSettlementRow[] = [];
      const settlementDetails: DdangyoCalculateDetailAmtRow[] = [];
      try {
        const settlement = await fetchDdangyoSettlementAllPagesInPage(
          ctx.page,
          {
            // NOTE: 주문목록은 전체(patsto_no=0000000) 조회가 가능하지만,
            // 정산/정산상세는 대표 점포번호(rpsnt_patsto_no)를 요구하는 케이스가 있어 대표값을 사용한다.
            patsto_no: base.rpsnt_patsto_no || base.patsto_no || "0000000",
            biz_reg_no: base.biz_reg_no,
            sotid: "0000",
            inq_st_dt: range.setl_dt_st,
            inq_ed_dt: range.setl_dt_ed,
            rowStatus: "R",
          },
          { log },
        );
        settlements = settlement.rows;

        // 정산 상세: 각 정산 row 기준으로 주문일자(setl_dt) breakdown 수집
        for (const s of settlements) {
          const paymPlanDt =
            typeof s.paym_plan_dt === "string" ? s.paym_plan_dt.trim() : "";
          const ajstDivCd =
            typeof s.ajst_div_cd === "string" ? s.ajst_div_cd.trim() : "";
          const wtranRsltCd =
            typeof s.wtran_rslt_cd === "string" ? s.wtran_rslt_cd.trim() : "";
          const patsto =
            typeof s.patsto_no === "string" ? s.patsto_no.trim() : "";
          if (!paymPlanDt || !ajstDivCd || !wtranRsltCd || !patsto) continue;

          const { rows: det } = await fetchDdangyoCalculateDetailInPage(
            ctx.page,
            {
              paym_plan_dt: paymPlanDt,
              ajst_div_cd: ajstDivCd,
              paym_plan_no:
                s.paym_plan_no != null ? String(s.paym_plan_no) : "",
              tab_gubun: typeof s.tab_gubun === "string" ? s.tab_gubun : "",
              patsto_no: patsto,
              paym_div_cd:
                typeof s.paym_div_cd === "string" ? s.paym_div_cd : "",
              wtran_rslt_cd: wtranRsltCd,
              rowStatus: "R",
            },
          );
          if (det.length > 0) {
            // 일부 응답은 dlt_amtList row에 patsto_no가 없어서, 호출 기준 patsto_no로 보강한다.
            settlementDetails.push(
              ...det.map((r) => ({
                ...r,
                patsto_no:
                  typeof r.patsto_no === "string" && r.patsto_no.trim()
                    ? r.patsto_no
                    : patsto,
              })),
            );
          }
        }
      } catch (e) {
        log("[ddangyo-orders-browser-fetch] settlement fetch failed", e);
      }
      capturedOut = {
        rows: out.rows,
        totalCnt: out.totalCnt,
        pages: out.pages,
        lastJson: out.lastJson,
        settlements,
        settlementDetails,
      };
    },
  });

  if (!capturedOut) {
    throw new Error("땡겨요 주문 수집: beforeClose 가 실행되지 않았습니다.");
  }

  const { rows, totalCnt, pages, lastJson, settlements, settlementDetails } =
    capturedOut;
  return {
    rows,
    totalCnt,
    pages,
    lastJson,
    settlements,
    settlementDetails,
    settle_range: range,
  };
}
