import { dismissBaeminTodayPopup } from "@/lib/services/baemin/baemin-dismiss-popup";
import {
  getBaeminSelfApiJsonHeaders,
  type BaeminSessionLoginHints,
  type LoginBaeminOptions,
} from "@/lib/services/baemin/baemin-login-service";
import {
  beginBaeminSelfApiClientHeaderCollection,
  mergeBaeminSelfApiClientHeaders,
  sleepMsForBaeminHeaderCapture,
} from "@/lib/services/baemin/baemin-self-api-request-headers-capture";
import { getBaeminWorkerLoginHints } from "@/lib/services/platform-session-service";
import {
  BAEMIN_SELF_ORDERS_HISTORY_URL,
  ENV_BAEMIN_V4_ORDERS_SMOKE_AFTER_LINK,
  getBaeminOrdersInitialDaysBack,
} from "@/lib/config/platform-orders-sync";
import {
  formatKstYmd,
  platformOrdersStartYmdInclusiveKst,
} from "@/lib/utils/kst-date";

export type BaeminV4OrderContextFromDb = {
  sessionHints: BaeminSessionLoginHints;
  ordersShopOwnerNumber: string;
  ordersShopNumbersParam: string;
};

/** `store_platform_sessions` + `store_platform_shops` → 로그인 힌트 + v4/orders 쿼리 문자열 */
export async function getBaeminV4OrderContextFromDb(
  storeId: string,
): Promise<BaeminV4OrderContextFromDb> {
  const row = await getBaeminWorkerLoginHints(storeId);
  if (!row) {
    throw new Error(
      `배민 세션 없음: store_id=${storeId} (store_platform_sessions.platform=baemin)`,
    );
  }
  const owner = row.shop_owner_number?.trim() ?? "";
  const shopIds =
    row.all_shop_external_ids.length > 0
      ? row.all_shop_external_ids
      : row.external_shop_id?.trim()
        ? [row.external_shop_id.trim()]
        : [];

  if (!owner) {
    throw new Error(
      `shop_owner_number 비어 있음: store_id=${storeId} — 연동/동기화 후 다시 실행`,
    );
  }
  if (shopIds.length === 0) {
    throw new Error(
      `매장 external id 없음: store_id=${storeId} (store_platform_shops 또는 external_shop_id)`,
    );
  }

  const externalShopId = row.external_shop_id?.trim() || shopIds[0];

  return {
    sessionHints: {
      shopOwnerNumber: owner,
      allShopNos: shopIds,
      externalShopId,
    },
    ordersShopOwnerNumber: owner,
    ordersShopNumbersParam: shopIds.join(","),
  };
}

export type BaeminV4OrdersSmokeInPageParams = {
  page: import("playwright").Page;
  shopOwnerNumber: string;
  shopNumbersParam: string;
  ordersHistoryUrl?: string;
  headerPostIdleMs?: number;
  skipHeaderCapture?: boolean;
  pathnameTraceKey?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  /** 기본 100. */
  maxLimit?: number;
  offset?: number;
  logPrefix?: string;
};

export type BaeminV4OrdersSmokeResult = {
  ok: boolean;
  status: number;
  statusText?: string;
  totalSize?: number | null;
  totalPayAmount?: number | null;
  contentsLength?: number | null;
  bodyIsJson?: boolean;
  bodyPreview?: string;
  err?: string;
};

export type BaeminV4OrdersPageJson = {
  totalSize?: number;
  totalPayAmount?: number;
  contents?: unknown[];
};

export type BaeminV4OrdersPageFetchResult = {
  ok: boolean;
  status: number;
  statusText?: string;
  json: BaeminV4OrdersPageJson | null;
  rawTextPreview?: string;
  err?: string;
};

/**
 * self `/orders/history` 컨텍스트에서 `GET self-api.../v4/orders` fetch (credentials include).
 * 날짜·limit 등 미지정 시 process.env `BAEMIN_V4_*` 사용 (dev·워커 공통).
 */
export async function runBaeminV4OrdersSmokeInPage(
  params: BaeminV4OrdersSmokeInPageParams,
): Promise<BaeminV4OrdersSmokeResult> {
  const {
    page,
    shopOwnerNumber,
    shopNumbersParam,
    ordersHistoryUrl = BAEMIN_SELF_ORDERS_HISTORY_URL,
    logPrefix = "[baemin-orders-fetch]",
  } = params;

  const postIdleWaitMs = Math.max(
    0,
    params.headerPostIdleMs !== undefined
      ? params.headerPostIdleMs
      : Number(process.env.BAEMIN_V4_HEADER_POST_IDLE_MS ?? "2500") || 2500,
  );
  const skipCapture =
    params.skipHeaderCapture ??
    process.env.BAEMIN_V4_SKIP_HEADER_CAPTURE === "1";

  const collector = skipCapture
    ? null
    : beginBaeminSelfApiClientHeaderCollection(page);

  await page.goto(ordersHistoryUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await dismissBaeminTodayPopup(page);
  await page.waitForLoadState("networkidle").catch(() => {});

  if (!skipCapture && postIdleWaitMs > 0) {
    await sleepMsForBaeminHeaderCapture(postIdleWaitMs);
  }

  const captured = skipCapture || !collector ? {} : await collector.finish();

  if (!skipCapture && Object.keys(captured).length > 0) {
    console.log(`${logPrefix} self-api 헤더 캡처:`, JSON.stringify(captured));
  } else if (!skipCapture) {
    console.warn(
      `${logPrefix} 헤더 캡처 없음 — BAEMIN_X_WEB_VERSION / BAEMIN_X_E_REQUEST env 폴백`,
    );
  }

  const endDate =
    params.endDate?.trim() ||
    process.env.BAEMIN_V4_END_DATE?.trim() ||
    formatKstYmd(new Date());
  const startDate =
    params.startDate?.trim() ||
    process.env.BAEMIN_V4_START_DATE?.trim() ||
    platformOrdersStartYmdInclusiveKst(endDate, getBaeminOrdersInitialDaysBack());

  const limit = Math.min(
    Math.max(1, params.maxLimit ?? 100),
    Math.max(
      1,
      params.limit != null && Number.isFinite(params.limit)
        ? params.limit
        : Number(process.env.BAEMIN_V4_LIMIT ?? "10") || 10,
    ),
  );
  const offset = Math.max(
    0,
    params.offset != null && Number.isFinite(params.offset)
      ? params.offset
      : Number(process.env.BAEMIN_V4_OFFSET ?? "0") || 0,
  );

  const qs = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    purchaseType: "",
    startDate,
    endDate,
    shopOwnerNumber,
    shopNumbers: shopNumbersParam,
    orderStatus: "CLOSED",
  });
  const fetchUrl = `https://self-api.baemin.com/v4/orders?${qs.toString()}`;

  const traceKey =
    params.pathnameTraceKey?.trim() ||
    process.env.BAEMIN_V4_PATHNAME_TRACE?.trim() ||
    "/orders/history";
  const headers = mergeBaeminSelfApiClientHeaders(
    getBaeminSelfApiJsonHeaders(traceKey),
    captured,
  );

  console.log(`${logPrefix} 요청:`, fetchUrl);

  const out = await page.evaluate(
    async ({ url, h }: { url: string; h: Record<string, string> }) => {
      try {
        const res = await fetch(url, {
          credentials: "include",
          mode: "cors",
          headers: h,
        });
        const text = await res.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* non-json */
        }
        const j = json as {
          totalSize?: number;
          contents?: unknown[];
          totalPayAmount?: number;
        } | null;
        return {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          totalSize: j?.totalSize ?? null,
          totalPayAmount: j?.totalPayAmount ?? null,
          contentsLength: Array.isArray(j?.contents) ? j.contents.length : null,
          bodyIsJson: json != null && typeof json === "object",
          bodyPreview: text.length > 500 ? `${text.slice(0, 500)}…` : text,
        };
      } catch (e) {
        return { ok: false, status: 0, err: String(e) };
      }
    },
    { url: fetchUrl, h: headers },
  );

  console.log(`${logPrefix} 결과:`, JSON.stringify(out, null, 2));
  return out as BaeminV4OrdersSmokeResult;
}

/** 동일 페이지 컨텍스트에서 v4/orders 한 페이지를 JSON으로 가져온다. */
export async function fetchBaeminV4OrdersPageInPage(
  params: BaeminV4OrdersSmokeInPageParams,
): Promise<BaeminV4OrdersPageFetchResult> {
  const {
    page,
    shopOwnerNumber,
    shopNumbersParam,
    ordersHistoryUrl = BAEMIN_SELF_ORDERS_HISTORY_URL,
    logPrefix = "[baemin-v4-orders-page]",
  } = params;

  const postIdleWaitMs = Math.max(
    0,
    params.headerPostIdleMs !== undefined
      ? params.headerPostIdleMs
      : Number(process.env.BAEMIN_V4_HEADER_POST_IDLE_MS ?? "2500") || 2500,
  );
  const skipCapture =
    params.skipHeaderCapture ??
    process.env.BAEMIN_V4_SKIP_HEADER_CAPTURE === "1";

  const collector = skipCapture
    ? null
    : beginBaeminSelfApiClientHeaderCollection(page);

  // header capture를 위해 orders/history 컨텍스트 필요
  await page.goto(ordersHistoryUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await dismissBaeminTodayPopup(page);
  await page.waitForLoadState("networkidle").catch(() => {});

  if (!skipCapture && postIdleWaitMs > 0) {
    await sleepMsForBaeminHeaderCapture(postIdleWaitMs);
  }

  const captured = skipCapture || !collector ? {} : await collector.finish();

  const endDate =
    params.endDate?.trim() ||
    process.env.BAEMIN_V4_END_DATE?.trim() ||
    formatKstYmd(new Date());
  const startDate =
    params.startDate?.trim() ||
    process.env.BAEMIN_V4_START_DATE?.trim() ||
    platformOrdersStartYmdInclusiveKst(endDate, getBaeminOrdersInitialDaysBack());

  const limit = Math.min(
    Math.max(1, params.maxLimit ?? 100),
    Math.max(
      1,
      params.limit != null && Number.isFinite(params.limit)
        ? params.limit
        : Number(process.env.BAEMIN_V4_LIMIT ?? "10") || 10,
    ),
  );
  const offset = Math.max(
    0,
    params.offset != null && Number.isFinite(params.offset)
      ? params.offset
      : Number(process.env.BAEMIN_V4_OFFSET ?? "0") || 0,
  );

  const qs = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    purchaseType: "",
    startDate,
    endDate,
    shopOwnerNumber,
    shopNumbers: shopNumbersParam,
    orderStatus: "CLOSED",
  });
  const fetchUrl = `https://self-api.baemin.com/v4/orders?${qs.toString()}`;

  const traceKey =
    params.pathnameTraceKey?.trim() ||
    process.env.BAEMIN_V4_PATHNAME_TRACE?.trim() ||
    "/orders/history";
  const headers = mergeBaeminSelfApiClientHeaders(
    getBaeminSelfApiJsonHeaders(traceKey),
    captured,
  );

  console.log(`${logPrefix} 요청:`, fetchUrl);

  const out = await page.evaluate(
    async ({ url, h }: { url: string; h: Record<string, string> }) => {
      try {
        const res = await fetch(url, {
          credentials: "include",
          mode: "cors",
          headers: h,
        });
        const text = await res.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* non-json */
        }
        const j =
          json != null && typeof json === "object"
            ? (json as BaeminV4OrdersPageJson)
            : null;
        return {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          json: j,
          rawTextPreview: text.length > 500 ? `${text.slice(0, 500)}…` : text,
        };
      } catch (e) {
        return { ok: false, status: 0, json: null, err: String(e) };
      }
    },
    { url: fetchUrl, h: headers },
  );

  return out as BaeminV4OrdersPageFetchResult;
}

export type BaeminV4OrdersFetchAllResult = {
  ok: boolean;
  totalSize: number | null;
  totalPayAmount: number | null;
  fetchedCount: number;
  pages: number;
  contents: unknown[];
  lastStatus?: number;
  lastError?: string;
};

/** v4/orders 전체 페이지네이션 (offset/limit) */
export async function fetchBaeminV4OrdersAllInPage(
  params: Omit<BaeminV4OrdersSmokeInPageParams, "offset"> & {
    maxPages?: number;
  },
): Promise<BaeminV4OrdersFetchAllResult> {
  const limit = Math.min(
    Math.max(1, params.maxLimit ?? 100),
    Math.max(
      1,
      params.limit != null && Number.isFinite(params.limit)
        ? params.limit
        : Number(process.env.BAEMIN_V4_LIMIT ?? "100") || 100,
    ),
  );
  const maxPages =
    params.maxPages != null && Number.isFinite(params.maxPages)
      ? Math.max(1, params.maxPages)
      : 1000;

  const all: unknown[] = [];
  let pages = 0;
  let totalSize: number | null = null;
  let totalPayAmount: number | null = null;

  for (let i = 0; i < maxPages; i += 1) {
    const offset = i * limit;
    const pageRes = await fetchBaeminV4OrdersPageInPage({
      ...params,
      limit,
      offset,
      logPrefix:
        params.logPrefix != null
          ? `${params.logPrefix}[page:${i + 1}]`
          : `[baemin-v4-orders-all][page:${i + 1}]`,
    });
    pages += 1;

    if (!pageRes.ok || !pageRes.json) {
      return {
        ok: false,
        totalSize,
        totalPayAmount,
        fetchedCount: all.length,
        pages,
        contents: all,
        lastStatus: pageRes.status,
        lastError: pageRes.err ?? pageRes.rawTextPreview ?? "unknown error",
      };
    }

    const c = Array.isArray(pageRes.json.contents) ? pageRes.json.contents : [];
    if (totalSize == null && typeof pageRes.json.totalSize === "number") {
      totalSize = pageRes.json.totalSize;
    }
    if (
      totalPayAmount == null &&
      typeof pageRes.json.totalPayAmount === "number"
    ) {
      totalPayAmount = pageRes.json.totalPayAmount;
    }

    all.push(...c);

    // 종료 조건: 빈 페이지 OR totalSize 도달
    if (c.length === 0) break;
    if (totalSize != null && all.length >= totalSize) break;
  }

  return {
    ok: true,
    totalSize,
    totalPayAmount,
    fetchedCount: all.length,
    pages,
    contents: all,
  };
}

/**
 * 워커 `baemin_link`: {@link ENV_BAEMIN_V4_ORDERS_SMOKE_AFTER_LINK}=1 이면
 * 브라우저 종료 직전 동일 세션으로 v4/orders 스모크 실행 (연동 직후 검증).
 */
export function mergeBaeminLinkOptionsWithV4OrdersSmoke(
  opts: LoginBaeminOptions,
): LoginBaeminOptions {
  if (process.env[ENV_BAEMIN_V4_ORDERS_SMOKE_AFTER_LINK] !== "1") {
    return opts;
  }
  const prev = opts.beforeClose;
  return {
    ...opts,
    beforeClose: async (a) => {
      if (prev) await prev(a);
      const owner = a.shopOwnerNumber?.trim() ?? "";
      const shopParam =
        a.allShopNos.length > 0
          ? a.allShopNos.join(",")
          : (a.baeminShopId?.trim() ?? "");
      if (!owner || !shopParam) {
        console.warn(
          `[worker][baemin_link] ${ENV_BAEMIN_V4_ORDERS_SMOKE_AFTER_LINK}=1 이지만 owner/shop 번호 없음 → 스킵`,
        );
        return;
      }
      try {
        await runBaeminV4OrdersSmokeInPage({
          page: a.page,
          shopOwnerNumber: owner,
          shopNumbersParam: shopParam,
          logPrefix: "[worker][baemin_link][v4-orders]",
        });
      } catch (e) {
        console.error("[worker][baemin_link] v4 orders smoke 실패", e);
      }
    },
  };
}
