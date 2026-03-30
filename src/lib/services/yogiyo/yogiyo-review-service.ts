import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { storeHasReviewsForPlatform } from "@/lib/services/review-sync-range-query";
import { getSyncReviewDateRange, toYYYYMMDD } from "@/lib/utils/review-date-range";
import * as YogiyoSession from "./yogiyo-session-service";

const API_BASE = "https://ceo-api.yogiyo.co.kr";
const CEO_ORIGIN = "https://ceo.yogiyo.co.kr";
const PAGE_SIZE = 50;

const DEBUG = process.env.DEBUG_YOGIYO === "1" || process.env.DEBUG_YOGIYO_SYNC === "1";
const log = (...args: unknown[]) => (DEBUG ? console.log("[yogiyo-review]", ...args) : undefined);

const REQUEST_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://ceo.yogiyo.co.kr/",
};

export type YogiyoVendorSummary = {
  id: number;
  name: string;
};

export type YogiyoReviewItem = {
  id: number;
  nickname: string;
  rating: number;
  created_at: string;
  comment: string;
  menu_summary?: string | null;
  /** 동기화 시 어느 vendor(매장) 소속인지 — DB `platform_shop_external_id` 매핑용 */
  _vendor_id?: number;
  [key: string]: unknown;
};

/**
 * 계약 완료 매장 목록 (ceo-api `GET /vendor/?is_contracted=1`).
 * Bearer 필수. 실패 시 빈 배열 (단일 매장 폴백은 호출측).
 */
export async function fetchYogiyoContractedVendors(
  token: string,
): Promise<YogiyoVendorSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/vendor/?is_contracted=1`, {
      method: "GET",
      headers: { ...REQUEST_HEADERS, Authorization: `Bearer ${token}` },
      credentials: "omit",
    });
    if (!res.ok) {
      log("fetchYogiyoContractedVendors http", res.status);
      return [];
    }
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    const out: YogiyoVendorSummary[] = [];
    for (const x of data) {
      if (x == null || typeof x !== "object") continue;
      const o = x as { id?: unknown; name?: unknown };
      const id = typeof o.id === "number" ? o.id : Number(o.id);
      if (!Number.isFinite(id)) continue;
      const name = typeof o.name === "string" ? o.name : "";
      out.push({ id, name });
    }
    return out;
  } catch (e) {
    log("fetchYogiyoContractedVendors error", e);
    return [];
  }
}

type YogiyoReviewsResponse = {
  count?: number;
  total_count?: number;
  reviews?: YogiyoReviewItem[];
  next?: string | null;
  previous?: string | null;
};

/** 현재 세션으로 한 페이지 요청. 401이면 재로그인 후 재시도 1회 */
async function fetchYogiyoReviewsPage(
  storeId: string,
  userId: string,
  vendorId: string,
  token: string,
  create_from: string,
  create_to: string,
  page: number,
): Promise<{ res: Response; didRefresh: boolean }> {
  const params = new URLSearchParams({
    create_from,
    create_to,
    no_reply_only: "false",
    page_size: String(PAGE_SIZE),
    page: String(page),
  });
  const url = `${API_BASE}/vendor/${vendorId}/reviews/v2/?${params.toString()}`;
  let res = await fetch(url, {
    method: "GET",
    headers: { ...REQUEST_HEADERS, Authorization: `Bearer ${token}` },
    credentials: "omit",
  });
  let didRefresh = false;
  if (res.status === 401) {
    await YogiyoSession.refreshYogiyoSession(storeId, userId);
    didRefresh = true;
    const newVendorId = await YogiyoSession.getYogiyoVendorId(storeId, userId);
    const newToken = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
    if (!newVendorId || !newToken) throw new Error("요기요 세션 갱신 후에도 인증 정보를 가져올 수 없습니다.");
    const url2 = `${API_BASE}/vendor/${newVendorId}/reviews/v2/?${params.toString()}`;
    res = await fetch(url2, {
      method: "GET",
      headers: { ...REQUEST_HEADERS, Authorization: `Bearer ${newToken}` },
      credentials: "omit",
    });
  }
  return { res, didRefresh };
}

/**
 * 저장된 세션(Bearer 토큰)으로 계약 매장 전체의 리뷰 v2 API를 호출해 병합 반환.
 * 각 항목에 `_vendor_id`를 붙여 DB `platform_shop_external_id`와 맞춘다.
 * `options.vendorIds`가 있으면 해당 vendor만 조회(답글 잡에서 replyId 조회 등).
 * 401 시 저장된 계정으로 재로그인 후 재시도.
 */
export async function fetchAllYogiyoReviews(
  storeId: string,
  userId: string,
  options?: {
    create_from?: string;
    create_to?: string;
    /** 지정 시 해당 vendor(들)만 조회 */
    vendorIds?: string[];
  },
): Promise<{ list: YogiyoReviewItem[]; total: number }> {
  let token = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
  if (!token) {
    throw new Error("요기요 세션(토큰)이 없습니다. 먼저 연동해 주세요.");
  }

  let vendorSummaries = await fetchYogiyoContractedVendors(token);
  const sessionVendorId = await YogiyoSession.getYogiyoVendorId(storeId, userId);
  if (vendorSummaries.length === 0 && sessionVendorId) {
    const n = Number(sessionVendorId);
    if (Number.isFinite(n)) vendorSummaries = [{ id: n, name: "" }];
  }
  if (options?.vendorIds?.length) {
    const want = new Set(options.vendorIds.map((s) => String(s).trim()));
    vendorSummaries = vendorSummaries.filter((v) => want.has(String(v.id)));
  }
  if (vendorSummaries.length === 0) {
    throw new Error(
      "요기요 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
    );
  }

  const supabase = createServiceRoleClient();
  const hasExisting = await storeHasReviewsForPlatform(supabase, storeId, "yogiyo");
  const { since, to } = getSyncReviewDateRange(hasExisting);
  const create_from = options?.create_from ?? toYYYYMMDD(since);
  const create_to = options?.create_to ?? toYYYYMMDD(to);
  const all: YogiyoReviewItem[] = [];
  let combinedTotal = 0;

  for (const v of vendorSummaries) {
    const vid = String(v.id);
    let page = 0;
    let vendorTotal = 0;

    while (true) {
      const { res, didRefresh } = await fetchYogiyoReviewsPage(
        storeId,
        userId,
        vid,
        token,
        create_from,
        create_to,
        page,
      );
      if (didRefresh) {
        token =
          (await YogiyoSession.getYogiyoBearerToken(storeId, userId)) ?? token;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`요기요 리뷰 API ${res.status}: ${text}`);
      }

      const body = (await res.json()) as YogiyoReviewsResponse;
      const reviews = body.reviews ?? [];
      if (vendorTotal === 0) {
        vendorTotal = body.total_count ?? body.count ?? reviews.length;
        combinedTotal += vendorTotal;
      }

      for (const item of reviews) {
        all.push({ ...item, _vendor_id: v.id } as YogiyoReviewItem);
      }

      if (reviews.length < PAGE_SIZE || reviews.length === 0) break;
      page += 1;
    }
  }

  return { list: all, total: combinedTotal > 0 ? combinedTotal : all.length };
}

const YOGIYO_STORE_NAME_PAGE = `${CEO_ORIGIN}/self-service-home`;

/**
 * Playwright로 ceo.yogiyo.co.kr/self-service-home 로드 후 contract-audit/ 응답 캡처로 매장명(vendor_name) 조회.
 */
export async function fetchYogiyoStoreName(
  storeId: string,
  userId: string,
): Promise<string | null> {
  const cookies = await YogiyoSession.getYogiyoCookies(storeId, userId);
  if (!cookies?.length) {
    log("fetchYogiyoStoreName: no cookies");
    return null;
  }
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    log("fetchYogiyoStoreName: Playwright not installed");
    return null;
  }
  const {
    logMemory,
    logBrowserMemory,
    closeBrowserWithMemoryLog,
  } = await import("@/lib/utils/browser-memory-logger");
  logMemory("[yogiyo-store-name] before launch");
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  logBrowserMemory(browser as unknown, "[yogiyo-store-name] browser");
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const playCookies = cookies
      .filter((c) => c.name && (c.domain?.includes("yogiyo.co.kr") || !c.domain))
      .map((c) => ({
        name: c.name.trim(),
        value: typeof c.value === "string" ? c.value : String(c.value ?? ""),
        domain: c.domain?.trim() || ".ceo.yogiyo.co.kr",
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
      if (!url.includes("contract-audit") || !response.ok()) return;
      captured = true;
      try {
        const data = (await response.json()) as Array<{ vendor_name?: string }>;
        const first = Array.isArray(data) ? data[0] : null;
        const name = first?.vendor_name;
        if (typeof name === "string" && name.trim()) {
          resolveCapture(name.trim());
        } else {
          resolveCapture(null);
        }
      } catch {
        resolveCapture(null);
      }
    });
    await page.goto(YOGIYO_STORE_NAME_PAGE, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    const store_name = await Promise.race([
      capturePromise,
      new Promise<null>((resolve) => {
        setTimeout(() => {
          log("fetchYogiyoStoreName: no contract-audit response in time");
          resolve(null);
        }, 10_000);
      }),
    ]);
    log("fetchYogiyoStoreName capture", { store_name: store_name ?? "(null)" });
    return store_name;
  } finally {
    await closeBrowserWithMemoryLog(browser, "[yogiyo-store-name]");
  }
}
