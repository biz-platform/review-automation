import * as DdangyoSession from "@/lib/services/ddangyo/ddangyo-session-service";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { storeHasReviewsForPlatform } from "@/lib/services/review-sync-range-query";
import { getSyncReviewDateRange, toYYYYMMDDCompact } from "@/lib/utils/review-date-range";

const DEBUG =
  process.env.DEBUG_DDANGYO === "1" ||
  process.env.DEBUG_DDANGYO_REVIEWS === "1";
const log = (...args: unknown[]) =>
  DEBUG ? console.log("[ddangyo-review]", ...args) : undefined;

const ORIGIN = "https://boss.ddangyo.com";
const CNT_URL = `${ORIGIN}/o2o/shop/re/requestQueryReviewCnt`;
const LIST_URL = `${ORIGIN}/o2o/shop/re/requestQueryReviewList`;
const PAGE_ROW_CNT = 10;

const REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Content-Type": "application/json",
  Referer: `${ORIGIN}/`,
  Origin: ORIGIN,
  submissionid: "mf_wfm_contents_wfm_tabFrame_sbm_commonSbmObject",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

export type DdangyoReviewItem = {
  rview_atcl_no: string;
  rview_cont?: string | null;
  psnl_msk_nm?: string | null;
  reg_dttm?: string | null;
  good_eval_cd?: string | null;
  [key: string]: unknown;
};

type ReviewCntResponse = {
  dma_rsltParam?: { tot_cnt?: number };
  dma_reviewCnt?: number | { tot_cnt?: number; cnt?: number };
  dlt_reviewList?: DdangyoReviewItem[];
  [key: string]: unknown;
};

type ReviewListResponse = {
  dma_rsltParam?: { list?: DdangyoReviewItem[] };
  dlt_reviewList?: DdangyoReviewItem[];
  head?: DdangyoReviewItem[] | { list?: DdangyoReviewItem[] };
  [key: string]: unknown;
};

function resolveCntTotal(cnt: ReviewCntResponse): number {
  const n = cnt?.dma_rsltParam?.tot_cnt;
  if (typeof n === "number" && !Number.isNaN(n)) return n;
  const r = cnt?.dma_reviewCnt;
  if (typeof r === "number" && !Number.isNaN(r)) return r;
  if (r && typeof r === "object") {
    const o = r as { tot_cnt?: number; cnt?: number; total_cnt?: number };
    const t = o.total_cnt ?? o.tot_cnt ?? o.cnt;
    if (typeof t === "number" && !Number.isNaN(t)) return t;
  }
  return 0;
}

function resolveListList(listJson: ReviewListResponse): DdangyoReviewItem[] {
  const b = listJson?.dlt_reviewList;
  if (Array.isArray(b)) return b;
  const a = listJson?.dma_rsltParam?.list;
  if (Array.isArray(a)) return a;
  const h = listJson?.head;
  if (Array.isArray(h)) return h;
  if (h && typeof h === "object" && Array.isArray((h as { list?: DdangyoReviewItem[] }).list)) return (h as { list: DdangyoReviewItem[] }).list;
  return [];
}

async function getSession(
  storeId: string,
  userId: string,
): Promise<{ patstoNo: string; headers: Record<string, string> }> {
  const patstoNo = await DdangyoSession.getDdangyoPatstoNo(storeId, userId);
  if (!patstoNo) {
    throw new Error(
      "땡겨요 연동 정보(patsto_no)가 없습니다. 먼저 연동을 진행해 주세요.",
    );
  }
  const cookieHeader = await DdangyoSession.getDdangyoCookieHeader(
    storeId,
    userId,
  );
  if (!cookieHeader) {
    throw new Error("저장된 땡겨요 세션이 없습니다. 먼저 연동해 주세요.");
  }
  return {
    patstoNo,
    headers: { ...REQUEST_HEADERS, Cookie: cookieHeader },
  };
}

const BOSS_ORIGIN = "https://boss.ddangyo.com";

/**
 * Playwright로 boss.ddangyo.com 로드 후 requestInfoStopBiz 응답 캡처로 매장명 조회.
 * (Node fetch는 403 등으로 실패할 수 있어 쿠팡이츠와 동일하게 응답 캡처 방식 사용)
 */
export async function fetchDdangyoStoreName(
  storeId: string,
  userId: string,
): Promise<string | null> {
  const cookies = await DdangyoSession.getDdangyoCookies(storeId, userId);
  if (!cookies?.length) {
    log("fetchDdangyoStoreName: no cookies");
    return null;
  }
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    log("fetchDdangyoStoreName: Playwright not installed");
    return null;
  }
  const {
    logMemory,
    logBrowserMemory,
    closeBrowserWithMemoryLog,
  } = await import("@/lib/utils/browser-memory-logger");
  logMemory("[ddangyo-store-name] before launch");
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  logBrowserMemory(browser as unknown, "[ddangyo-store-name] browser");
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const playCookies = cookies
      .filter((c) => c.name && (c.domain?.includes("ddangyo.com") || !c.domain))
      .map((c) => ({
        name: c.name.trim(),
        value: typeof c.value === "string" ? c.value : String(c.value ?? ""),
        domain: c.domain?.trim() || ".boss.ddangyo.com",
        path: c.path?.trim()?.startsWith("/") ? c.path.trim() : "/",
      }))
      .filter((c) => c.name.length > 0);
    if (playCookies.length > 0) await context.addCookies(playCookies);

    let resolveCapture: (name: string | null) => void;
    const capturePromise = new Promise<string | null>((resolve) => {
      resolveCapture = resolve;
    });
    let captured = false;
    const page = await context.newPage();
    page.on("response", async (response) => {
      if (captured) return;
      const url = response.url();
      if (!url.includes("requestInfoStopBiz") || !response.ok()) return;
      captured = true;
      try {
        const data = (await response.json()) as {
          dma_shop_result?: { patsto_nm?: string };
        };
        const name = data?.dma_shop_result?.patsto_nm;
        if (typeof name === "string" && name.trim()) {
          resolveCapture(name.trim());
        } else {
          resolveCapture(null);
        }
      } catch {
        resolveCapture(null);
      }
    });
    await page.goto(`${BOSS_ORIGIN}/`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    const store_name = await Promise.race([
      capturePromise,
      new Promise<null>((resolve) => {
        setTimeout(() => {
          log("fetchDdangyoStoreName: no requestInfoStopBiz response in time");
          resolve(null);
        }, 10_000);
      }),
    ]);
    log("fetchDdangyoStoreName capture", { store_name: store_name ?? "(null)" });
    return store_name;
  } finally {
    await closeBrowserWithMemoryLog(browser, "[ddangyo-store-name]");
  }
}

/**
 * 저장된 세션(patsto_no + 쿠키)으로 requestQueryReviewCnt → requestQueryReviewList 페이지네이션 호출 후 전체 리뷰 반환.
 * 401 시 저장된 계정으로 재로그인 후 재시도.
 */
export async function fetchAllDdangyoReviews(
  storeId: string,
  userId: string,
): Promise<{ list: DdangyoReviewItem[]; total: number }> {
  console.log("[ddangyo-review] 1. start", { storeId: storeId.slice(0, 8), userId: userId.slice(0, 8) });

  let session = await getSession(storeId, userId);
  let { patstoNo, headers } = session;
  console.log("[ddangyo-review] 2. patstoNo", patstoNo ?? "(null)");
  console.log("[ddangyo-review] 3. cookieHeader length", headers.Cookie?.length ?? 0);

  const supabase = createServiceRoleClient();
  const hasExisting = await storeHasReviewsForPlatform(supabase, storeId, "ddangyo");
  const { since, to } = getSyncReviewDateRange(hasExisting);
  const from_date = toYYYYMMDDCompact(since);
  const to_date = toYYYYMMDDCompact(to);

  const cntBody = JSON.stringify({
    dma_reqParam: { patsto_no: patstoNo, from_date, to_date },
  });
  log("4. CNT request", { CNT_URL, patstoNo, from_date, to_date, body: cntBody });
  console.log("[ddangyo-review] 4. CNT fetch", CNT_URL);
  let cntRes = await fetch(CNT_URL, {
    method: "POST",
    headers,
    body: cntBody,
    credentials: "include",
  });
  if (cntRes.status === 401) {
    await DdangyoSession.refreshDdangyoSession(storeId, userId);
    session = await getSession(storeId, userId);
    patstoNo = session.patstoNo;
    headers = session.headers;
    cntRes = await fetch(CNT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dma_reqParam: { patsto_no: patstoNo, from_date, to_date },
      }),
      credentials: "include",
    });
  }
  const cntText = await cntRes.text();
  if (!cntRes.ok) {
    throw new Error(
      `땡겨요 리뷰 건수 API ${cntRes.status}: ${cntText.slice(0, 200)}`,
    );
  }
  let cntJson: ReviewCntResponse;
  try {
    cntJson = JSON.parse(cntText) as ReviewCntResponse;
  } catch (e) {
    console.log("[ddangyo-review] 5. CNT parse error", e);
    console.log("[ddangyo-review] 5. CNT raw (first 400)", cntText.slice(0, 400));
    throw new Error(`땡겨요 CNT 응답 JSON 파싱 실패: ${String(e)}`);
  }
  console.log("[ddangyo-review] 5. CNT status", cntRes.status, "body keys", Object.keys(cntJson));
  log("5. CNT response (full)", JSON.stringify(cntJson));
  const total = resolveCntTotal(cntJson);
  console.log("[ddangyo-review] 6. total", total, "(dma_reviewCnt:", cntJson?.dma_reviewCnt, ")");
  log("6. total", total);

  const all: DdangyoReviewItem[] = [];
  let pageNo = 1;
  const totalPages = Math.ceil(total / PAGE_ROW_CNT) || 1;
  console.log("[ddangyo-review] 7. totalPages", totalPages, "PAGE_ROW_CNT", PAGE_ROW_CNT);

  while (pageNo <= totalPages) {
    const listBody = JSON.stringify({
      dma_reqParam: {
        patsto_no: patstoNo,
        ord_tp_cd: "",
        from_date,
        to_date,
        page_num: pageNo,
        page_row_cnt: PAGE_ROW_CNT,
        chg_req_dttm: "",
        chg_proc_mbr_id: "",
        fin_chg_id: "",
      },
    });
    // ——— LIST 요청 상세 (브라우저 요청과 비교용) ———
    console.log("[ddangyo-review] 8a. LIST request URL", LIST_URL);
    console.log("[ddangyo-review] 8b. LIST request body", listBody);
    const headerNames = Object.keys(headers);
    console.log("[ddangyo-review] 8c. LIST request header names", headerNames.join(", "));
    console.log("[ddangyo-review] 8d. LIST Cookie length", headers.Cookie?.length ?? 0);

    let listRes = await fetch(LIST_URL, {
      method: "POST",
      headers,
      body: listBody,
      credentials: "include",
    });
    if (listRes.status === 401) {
      await DdangyoSession.refreshDdangyoSession(storeId, userId);
      const nextSession = await getSession(storeId, userId);
      patstoNo = nextSession.patstoNo;
      headers = nextSession.headers;
      const retryBody = JSON.stringify({
        dma_reqParam: {
          patsto_no: patstoNo,
          ord_tp_cd: "",
          from_date,
          to_date,
          page_num: pageNo,
          page_row_cnt: PAGE_ROW_CNT,
          chg_req_dttm: "",
          chg_proc_mbr_id: "",
          fin_chg_id: "",
        },
      });
      listRes = await fetch(LIST_URL, {
        method: "POST",
        headers,
        body: retryBody,
        credentials: "include",
      });
    }
    const listText = await listRes.text();

    // ——— LIST 응답 상세 ———
    console.log("[ddangyo-review] 8e. LIST response status", listRes.status, listRes.statusText);
    const resHeaders: Record<string, string> = {};
    listRes.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });
    console.log("[ddangyo-review] 8f. LIST response headers", JSON.stringify(resHeaders));
    console.log("[ddangyo-review] 8g. LIST response body length", listText.length);
    if (listText.length > 0 && listText.length <= 2000) {
      console.log("[ddangyo-review] 8h. LIST response body (full)", listText);
    } else if (listText.length > 2000) {
      console.log("[ddangyo-review] 8h. LIST response body (first 1200)", listText.slice(0, 1200));
      console.log("[ddangyo-review] 8h. LIST response body (last 300)", listText.slice(-300));
    }

    if (!listRes.ok) {
      console.log("[ddangyo-review] LIST error", listRes.status, listText.slice(0, 300));
      throw new Error(
        `땡겨요 리뷰 목록 API ${listRes.status}: ${listText.slice(0, 200)}`,
      );
    }
    let listJson: ReviewListResponse;
    try {
      listJson = JSON.parse(listText) as ReviewListResponse;
    } catch (e) {
      console.log("[ddangyo-review] 9. LIST parse error pageNo=" + pageNo, e);
      console.log("[ddangyo-review] 9. LIST raw (first 400)", listText.slice(0, 400));
      throw new Error(`땡겨요 LIST 응답 JSON 파싱 실패: ${String(e)}`);
    }
    console.log("[ddangyo-review] 9. LIST pageNo=" + pageNo, "status", listRes.status, "body keys", Object.keys(listJson));
    log("9. LIST response (full)", JSON.stringify(listJson));
    const list = resolveListList(listJson);
    console.log("[ddangyo-review] 10. list length", list.length, "raw dlt_reviewList length", listJson?.dlt_reviewList?.length ?? "n/a", "first item keys:", list[0] ? Object.keys(list[0]) : []);
    if (list.length === 0 && listJson?.dlt_reviewList !== undefined) {
      console.log("[ddangyo-review] 10. dlt_reviewList is", Array.isArray(listJson.dlt_reviewList) ? "array length " + listJson.dlt_reviewList.length : typeof listJson.dlt_reviewList, listJson.dlt_reviewList);
    }
    log("10. list length", list.length);
    for (const item of list) {
      if (item?.rview_atcl_no) all.push(item);
    }
    if (list.length < PAGE_ROW_CNT) break;
    pageNo += 1;
  }

  console.log("[ddangyo-review] 11. done", { listLength: all.length, total });
  return { list: all, total };
}
