/**
 * 땡겨요 주문내역 `requestQryOrderList` 스모크: 로그인 → #SH0402 → 사이드 「주문내역」 클릭으로 API 트리거 → 60일(또는 env) 전 페이지 수집.
 *
 * 사용법:
 *   pnpm exec tsx scripts/dev-ddangyo-orders-fetch.ts <store_id>
 *   pnpm run dev:ddangyo-orders-fetch -- <store_id>
 *
 * 크레덴셜: DB 우선, 없으면 DDANGYO_FETCH_ID / DDANGYO_FETCH_PW
 *
 * 선택: DDANGYO_ORDERS_DAYS_BACK 또는 DDANGYO_ORDERS_INITIAL_DAYS_BACK (기본 60)
 *
 * 출력: ./tmp/ddangyo-orders-<storeId>-<timestamp>.json
 *
 * DB 저장(선택):
 * - `pnpm run dev:ddangyo-orders-fetch -- <store_id> --persist`
 * - 또는 `DDANGYO_ORDERS_PERSIST=1`
 * → `store_platform_orders` + `store_platform_dashboard_*`
 *
 * .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { config as loadEnv } from "dotenv";
import {
  ENV_DDANGYO_ORDERS_PERSIST,
  getDdangyoDevOrdersDaysBack,
} from "@/lib/config/platform-orders-sync";
import { kstClosedRangeFromDdangyoSettleCompact } from "@/lib/dashboard/dashboard-order-sync-kst-range";
import type {
  DdangyoOrderListDmaPara,
  DdangyoOrderListRow,
} from "@/lib/services/ddangyo/ddangyo-orders-fetch";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

const SH0402_URL = "https://boss.ddangyo.com/#SH0402";

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const persistFlag =
    process.env[ENV_DDANGYO_ORDERS_PERSIST] === "1" ||
    argv.includes("--persist") ||
    argv.includes("-p");
  const storeId = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!storeId) {
    console.error(
      "첫 번째 인자로 stores.id (UUID) 필요.\n" +
        "  예: pnpm run dev:ddangyo-orders-fetch -- <store_id> [--persist]",
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  process.env.WORKER_MODE = "1";

  const { loginDdangyoAndGetCookies } = await import(
    "@/lib/services/ddangyo/ddangyo-login-service"
  );
  const { getStoredCredentials } = await import(
    "@/lib/services/platform-session-service"
  );
  const {
    ddangyoOrderListSettleRangeCompactDays,
    fetchDdangyoOrderListAllPagesInPage,
  } = await import("@/lib/services/ddangyo/ddangyo-orders-fetch");

  const credsDb = await getStoredCredentials(storeId, "ddangyo");
  const idEnv = process.env.DDANGYO_FETCH_ID?.trim();
  const pwEnv = process.env.DDANGYO_FETCH_PW?.trim();
  const username = credsDb?.username ?? idEnv;
  const password = credsDb?.password ?? pwEnv;
  if (!username || !password) {
    console.error(
      "땡겨요 로그인 정보 없음: DB credentials_encrypted 또는 DDANGYO_FETCH_ID / DDANGYO_FETCH_PW",
    );
    process.exit(1);
  }

  const daysBack = getDdangyoDevOrdersDaysBack();

  let savedJson: string | null = null;

  await loginDdangyoAndGetCookies(username, password, {
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

      // 해시만 바꿔 진입하면 SPA가 requestQryOrderList를 쏘지 않는 경우가 있음 — 사이드바 링크 클릭으로 트리거
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
        console.warn(
          "[ddangyo-orders-fetch] requestQryOrderList 캡처 실패 → dma 수동",
          e instanceof Error ? e.message : e,
        );
      }

      const range = ddangyoOrderListSettleRangeCompactDays(daysBack);
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
          `biz_reg_no / rpsnt_patsto_no 없음. bossInfo·#SH0402 네트워크 확인. biz=${biz}, rpsnt=${rpsnt}`,
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

      console.log("[ddangyo-orders-fetch] range", range, "dma(base)", {
        ...base,
        psnl_mbr_id: `${psnl.slice(0, 4)}…`,
      });

      const out = await fetchDdangyoOrderListAllPagesInPage(ctx.page, base, {
        log: (...args) => console.log(...args),
      });

      const ts = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
      const outDir = path.resolve(process.cwd(), "tmp");
      await fs.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `ddangyo-orders-${storeId}-${ts}.json`);

      const payload = {
        store_id: storeId,
        fetched_at: new Date().toISOString(),
        days_back: daysBack,
        settle_range: range,
        total_cnt: out.totalCnt,
        pages_fetched: out.pages,
        row_count: out.rows.length,
        rows: out.rows,
        last_response_meta: out.lastJson
          ? {
              dma_error: out.lastJson.dma_error,
              dlt_result_single: out.lastJson.dlt_result_single,
            }
          : null,
      };
      savedJson = JSON.stringify(payload, null, 2);
      await fs.writeFile(outPath, savedJson, "utf8");
      console.log("[ddangyo-orders-fetch] wrote", outPath);
    },
  });

  if (!savedJson) {
    console.error("[ddangyo-orders-fetch] beforeClose 미실행 또는 파일 미기록");
    process.exit(1);
  }

  if (persistFlag) {
    const parsed = JSON.parse(savedJson) as {
      rows?: DdangyoOrderListRow[];
      settle_range?: { setl_dt_st: string; setl_dt_ed: string };
    };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const dashboardReplaceKstRangeFallback =
      parsed.settle_range != null
        ? kstClosedRangeFromDdangyoSettleCompact(parsed.settle_range)
        : null;
    if (rows.length === 0) {
      console.warn(
        "[ddangyo-orders-fetch] --persist 였으나 수집 행이 없어 DB 스킵",
      );
    } else {
      const { createServiceRoleClient } = await import(
        "@/lib/db/supabase-server"
      );
      const { persistDdangyoOrdersSnapshot } = await import(
        "@/lib/dashboard/persist-ddangyo-orders"
      );
      const supabase = createServiceRoleClient();
      const snap = await persistDdangyoOrdersSnapshot({
        supabase,
        storeId,
        rows,
        dashboardReplaceKstRangeFallback,
      });
      console.log("[ddangyo-orders-fetch] DB 반영:", {
        platform_orders_upserted: snap.platformOrdersUpserted,
        platform_orders_skipped: snap.platformOrdersSkipped,
        dashboard_shops: snap.dashboardByShop.length,
        warnings: snap.warnings.length,
      });
      if (snap.warnings.length > 0) {
        console.warn("[ddangyo-orders-fetch] warnings:", snap.warnings);
      }
    }
  }

  console.log("[ddangyo-orders-fetch] 로그인·수집 완료(브라우저 종료됨).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
