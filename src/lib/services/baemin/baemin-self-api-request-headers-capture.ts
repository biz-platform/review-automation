import type { Page, Request } from "playwright";

export type BaeminSelfApiCapturedClientHeaders = {
  "x-web-version"?: string;
  "x-e-request"?: string;
};

function headerGet(
  h: Record<string, string>,
  key: string,
): string | undefined {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === lower && typeof v === "string" && v.trim() !== "") {
      return v;
    }
  }
  return undefined;
}

/**
 * `self-api.baemin.com` 요청을 스냅샷한다. `goto` **전**에 `begin` 하고,
 * 로드·idle 후 잠시 더 기다린 뒤 `finish()` 호출.
 * 여러 요청에 걸쳐 `x-web-version` / `x-e-request` 가 갱신되면 **마지막으로 본 값**을 사용.
 */
export function beginBaeminSelfApiClientHeaderCollection(page: Page): {
  finish: () => Promise<BaeminSelfApiCapturedClientHeaders>;
} {
  const out: BaeminSelfApiCapturedClientHeaders = {};

  const onRequest = (req: Request) => {
    try {
      const u = req.url();
      if (!u.includes("self-api.baemin.com")) return;
      const h = req.headers();
      const xw = headerGet(h, "x-web-version");
      const xe = headerGet(h, "x-e-request");
      if (xw) out["x-web-version"] = xw;
      if (xe) out["x-e-request"] = xe;
    } catch {
      /* ignore */
    }
  };

  page.on("request", onRequest);

  return {
    finish: async () => {
      page.off("request", onRequest);
      return { ...out };
    },
  };
}

/** `finish` 전에 SPA가 추가 요청을보낼 시간 */
export async function sleepMsForBaeminHeaderCapture(waitMs: number): Promise<void> {
  await new Promise((r) => setTimeout(r, waitMs));
}

/** 캡처값이 있으면 `base` 위에 덮어씀 (빈 문자열은 무시) */
export function mergeBaeminSelfApiClientHeaders(
  base: Record<string, string>,
  captured: BaeminSelfApiCapturedClientHeaders,
): Record<string, string> {
  const m = { ...base };
  if (captured["x-web-version"]?.trim()) {
    m["x-web-version"] = captured["x-web-version"].trim();
  }
  if (captured["x-e-request"]?.trim()) {
    m["x-e-request"] = captured["x-e-request"].trim();
  }
  return m;
}
