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
      capturedOut = {
        rows: out.rows,
        totalCnt: out.totalCnt,
        pages: out.pages,
        lastJson: out.lastJson,
      };
    },
  });

  if (!capturedOut) {
    throw new Error("땡겨요 주문 수집: beforeClose 가 실행되지 않았습니다.");
  }

  const { rows, totalCnt, pages, lastJson } = capturedOut;
  return {
    rows,
    totalCnt,
    pages,
    lastJson,
    settle_range: range,
  };
}
