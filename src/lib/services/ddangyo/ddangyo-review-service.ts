import * as DdangyoSession from "@/lib/services/ddangyo/ddangyo-session-service";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { upsertStorePlatformShops } from "@/lib/services/platform-shop-service";
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

/** 특정 patsto_no로 리뷰 API 호출(다매장 시 각 매장별로 사용) */
async function getSessionForPatsto(
  storeId: string,
  userId: string,
  patstoNo: string,
): Promise<{ patstoNo: string; headers: Record<string, string> }> {
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

const BOSS_INFO_URL = `${ORIGIN}/o2o/shop/cm/requestBossInfo`;
const SHOP_INFO_URL = `${ORIGIN}/o2o/shop/sh/requestQryShopInfo`;

const BOSS_SHOP_HEADERS: Record<string, string> = {
  ...REQUEST_HEADERS,
  submissionid: "mf_wfm_side_sbm_commonSbmObject",
};

export type DdangyoPatstoSummary = {
  patsto_no: string;
  patsto_nm: string;
};

/**
 * requestBossInfo → requestQryShopInfo 의 `dlt_patstoMbrId`로 계정 연동 매장 목록(중복 patsto_no 제거).
 */
export async function fetchDdangyoContractedPatstos(
  storeId: string,
  userId: string,
): Promise<DdangyoPatstoSummary[]> {
  const cookieHeader = await DdangyoSession.getDdangyoCookieHeader(
    storeId,
    userId,
  );
  if (!cookieHeader) {
    throw new Error("저장된 땡겨요 세션이 없습니다.");
  }
  const headers = { ...BOSS_SHOP_HEADERS, Cookie: cookieHeader };

  const bossRes = await fetch(BOSS_INFO_URL, {
    method: "POST",
    headers,
    body: "{}",
    credentials: "omit",
  });
  if (!bossRes.ok) {
    log("fetchDdangyoContractedPatstos bossInfo http", bossRes.status);
    return [];
  }
  const bossJson = (await bossRes.json()) as {
    dma_result?: {
      biz_reg_no?: string;
      rpsnt_patsto_no?: string;
      sotid?: string;
    };
  };
  const dma = bossJson?.dma_result;
  const biz = dma?.biz_reg_no?.trim();
  const rpsnt =
    dma?.rpsnt_patsto_no != null ? String(dma.rpsnt_patsto_no).trim() : "";
  if (!biz || !rpsnt) {
    log("fetchDdangyoContractedPatstos bossInfo missing biz/rpsnt");
    return [];
  }

  const shopRes = await fetch(SHOP_INFO_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      dma_para: {
        patsto_no: rpsnt,
        biz_reg_no: biz,
        sotid: dma?.sotid ?? "0000",
        bizr_no: "",
        mbr_id: "",
      },
    }),
    credentials: "omit",
  });
  if (!shopRes.ok) {
    log("fetchDdangyoContractedPatstos shopInfo http", shopRes.status);
    return [];
  }
  const shopJson = (await shopRes.json()) as {
    dlt_patstoMbrId?: Array<{ patsto_no?: unknown; patsto_nm?: unknown }>;
  };
  const rows = shopJson?.dlt_patstoMbrId;
  if (!Array.isArray(rows)) return [];

  const seen = new Set<string>();
  const out: DdangyoPatstoSummary[] = [];
  for (const row of rows) {
    const no = String(row?.patsto_no ?? "").trim();
    if (!no || seen.has(no)) continue;
    seen.add(no);
    const nm =
      typeof row?.patsto_nm === "string" && row.patsto_nm.trim()
        ? row.patsto_nm.trim()
        : "";
    out.push({ patsto_no: no, patsto_nm: nm });
  }
  return out;
}

/**
 * 계약 매장 목록으로 `store_platform_shops` 갱신(동기화·백필용). 세션 `external_shop_id`와 일치하는 행만 primary.
 */
export async function upsertDdangyoStorePlatformShopsFromContract(
  storeId: string,
  userId: string,
  patstos: DdangyoPatstoSummary[],
): Promise<void> {
  const extId =
    (await DdangyoSession.getDdangyoPatstoNo(storeId, userId))?.trim() ?? "";
  const mapped = patstos
    .map((p) => {
      const id = String(p.patsto_no ?? "").trim();
      if (!id) return null;
      return {
        platform_shop_external_id: id,
        shop_name:
          typeof p.patsto_nm === "string" && p.patsto_nm.trim()
            ? p.patsto_nm.trim()
            : null,
        is_primary: !!extId && id === extId,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  if (mapped.length === 0) return;
  const supabase = createServiceRoleClient();
  await upsertStorePlatformShops(supabase, storeId, "ddangyo", mapped);
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
 * 한 매장(patsto_no)에 대해 CNT → LIST 페이지네이션. 리뷰 항목에 `_patsto_no` 부여.
 */
async function fetchDdangyoReviewsForPatsto(
  storeId: string,
  userId: string,
  patstoNo: string,
  from_date: string,
  to_date: string,
): Promise<{ list: DdangyoReviewItem[]; total: number }> {
  let session = await getSessionForPatsto(storeId, userId, patstoNo);
  let { patstoNo: activePatsto, headers } = session;

  const cntBody = JSON.stringify({
    dma_reqParam: { patsto_no: activePatsto, from_date, to_date },
  });
  log("CNT request", { patstoNo: activePatsto, from_date, to_date });
  let cntRes = await fetch(CNT_URL, {
    method: "POST",
    headers,
    body: cntBody,
    credentials: "include",
  });
  if (cntRes.status === 401) {
    await DdangyoSession.refreshDdangyoSession(storeId, userId);
    session = await getSessionForPatsto(storeId, userId, patstoNo);
    activePatsto = session.patstoNo;
    headers = session.headers;
    cntRes = await fetch(CNT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dma_reqParam: { patsto_no: activePatsto, from_date, to_date },
      }),
      credentials: "include",
    });
  }
  const cntText = await cntRes.text();
  if (!cntRes.ok) {
    throw new Error(
      `땡겨요 리뷰 건수 API ${cntRes.status} (patsto_no=${patstoNo}): ${cntText.slice(0, 200)}`,
    );
  }
  let cntJson: ReviewCntResponse;
  try {
    cntJson = JSON.parse(cntText) as ReviewCntResponse;
  } catch (e) {
    throw new Error(
      `땡겨요 CNT JSON 파싱 실패 (patsto_no=${patstoNo}): ${String(e)}`,
    );
  }
  const total = resolveCntTotal(cntJson);
  log("CNT total", { patstoNo, total });

  const all: DdangyoReviewItem[] = [];
  let pageNo = 1;
  const totalPages = Math.ceil(total / PAGE_ROW_CNT) || 1;

  while (pageNo <= totalPages) {
    const listBody = JSON.stringify({
      dma_reqParam: {
        patsto_no: activePatsto,
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
    if (DEBUG) {
      console.log("[ddangyo-review] LIST patsto", activePatsto, "page", pageNo);
    }

    let listRes = await fetch(LIST_URL, {
      method: "POST",
      headers,
      body: listBody,
      credentials: "include",
    });
    if (listRes.status === 401) {
      await DdangyoSession.refreshDdangyoSession(storeId, userId);
      const nextSession = await getSessionForPatsto(storeId, userId, patstoNo);
      activePatsto = nextSession.patstoNo;
      headers = nextSession.headers;
      const retryBody = JSON.stringify({
        dma_reqParam: {
          patsto_no: activePatsto,
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

    if (!listRes.ok) {
      throw new Error(
        `땡겨요 리뷰 목록 API ${listRes.status} (patsto_no=${patstoNo}): ${listText.slice(0, 200)}`,
      );
    }
    let listJson: ReviewListResponse;
    try {
      listJson = JSON.parse(listText) as ReviewListResponse;
    } catch (e) {
      throw new Error(
        `땡겨요 LIST JSON 파싱 실패 (patsto_no=${patstoNo}): ${String(e)}`,
      );
    }
    const list = resolveListList(listJson);
    for (const item of list) {
      if (item?.rview_atcl_no) {
        all.push({
          ...item,
          _patsto_no: patstoNo,
        } as DdangyoReviewItem);
      }
    }
    if (list.length < PAGE_ROW_CNT) break;
    pageNo += 1;
  }

  return { list: all, total };
}

/**
 * 계정 연동 매장 전부 순회해 리뷰 병합. 각 항목에 `_patsto_no` 부여 → DB `platform_shop_external_id` 매핑.
 * `options.patstoNos` 지정 시 해당 매장만 조회.
 */
export async function fetchAllDdangyoReviews(
  storeId: string,
  userId: string,
  options?: { patstoNos?: string[] },
): Promise<{
  list: DdangyoReviewItem[];
  total: number;
  /** 필터 전 전체 계약 매장(동기화 후 `store_platform_shops` 백필용) */
  contractedPatstos: DdangyoPatstoSummary[];
}> {
  console.log("[ddangyo-review] start", { storeId: storeId.slice(0, 8), userId: userId.slice(0, 8) });

  let shops = await fetchDdangyoContractedPatstos(storeId, userId).catch(() => []);
  const fallback = await DdangyoSession.getDdangyoPatstoNo(storeId, userId);
  if (shops.length === 0 && fallback) {
    shops = [{ patsto_no: fallback, patsto_nm: "" }];
  }
  const contractedPatstos = shops.map((s) => ({
    patsto_no: s.patsto_no,
    patsto_nm: s.patsto_nm,
  }));
  if (options?.patstoNos?.length) {
    const want = new Set(options.patstoNos.map((s) => s.trim()));
    shops = shops.filter((s) => want.has(s.patsto_no));
  }
  if (shops.length === 0) {
    throw new Error(
      "땡겨요 연동 매장 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
    );
  }

  const supabase = createServiceRoleClient();
  const hasExisting = await storeHasReviewsForPlatform(supabase, storeId, "ddangyo");
  const { since, to } = getSyncReviewDateRange(hasExisting);
  const from_date = toYYYYMMDDCompact(since);
  const to_date = toYYYYMMDDCompact(to);

  const all: DdangyoReviewItem[] = [];
  let combinedTotal = 0;

  for (const shop of shops) {
    const pid = shop.patsto_no;
    console.log("[ddangyo-review] shop", pid, shop.patsto_nm || "");
    const { list, total } = await fetchDdangyoReviewsForPatsto(
      storeId,
      userId,
      pid,
      from_date,
      to_date,
    );
    combinedTotal += total;
    all.push(...list);
  }

  console.log("[ddangyo-review] done", {
    shops: shops.length,
    listLength: all.length,
    combinedTotalHint: combinedTotal,
  });
  return {
    list: all,
    total: combinedTotal > 0 ? combinedTotal : all.length,
    contractedPatstos,
  };
}
