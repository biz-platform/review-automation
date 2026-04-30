import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV_KEY } from "@/lib/config/env-keys";

function getSecret(): string | null {
  const raw = process.env[ENV_KEY.WEEKLY_REPORT_IMAGE_SIGNING_SECRET];
  if (!raw || !raw.trim()) return null;
  return raw.trim();
}

function signRaw(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function buildWeeklyReportImageSignature(params: {
  storeId: string;
  weekStartYmd: string;
  ts: string;
}): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload = `${params.storeId}:${params.weekStartYmd}:${params.ts}`;
  return signRaw(payload, secret);
}

/** 이미지·HTML 공개 페이지 공통 쿼리(weekStart + 선택적 ts/sig) */
export function buildWeeklyReportSignedQueryString(params: {
  storeId: string;
  weekStartYmd: string;
}): string {
  const ts = String(Date.now());
  const sig = buildWeeklyReportImageSignature({
    storeId: params.storeId,
    weekStartYmd: params.weekStartYmd,
    ts,
  });
  const qs = new URLSearchParams({ weekStart: params.weekStartYmd });
  if (sig) {
    qs.set("ts", ts);
    qs.set("sig", sig);
  }
  return qs.toString();
}

export function buildWeeklyReportImageUrl(params: {
  publicBaseUrl: string;
  storeId: string;
  weekStartYmd: string;
}): string {
  const base = params.publicBaseUrl.replace(/\/+$/, "");
  const q = buildWeeklyReportSignedQueryString({
    storeId: params.storeId,
    weekStartYmd: params.weekStartYmd,
  });
  return `${base}/api/reports/weekly/stores/${params.storeId}/image?${q}`;
}

/** 알림톡·메일 등에서 여는 HTML 리포트 (서명 규칙은 이미지 API와 동일) */
export function buildWeeklyReportPublicViewUrl(params: {
  publicBaseUrl: string;
  storeId: string;
  weekStartYmd: string;
}): string {
  const base = params.publicBaseUrl.replace(/\/+$/, "");
  const q = buildWeeklyReportSignedQueryString({
    storeId: params.storeId,
    weekStartYmd: params.weekStartYmd,
  });
  return `${base}/reports/weekly/stores/${params.storeId}?${q}`;
}

export function verifyWeeklyReportImageSignature(params: {
  storeId: string;
  weekStartYmd: string;
  ts: string;
  sig: string;
  maxAgeMs?: number;
  now?: Date;
}): boolean {
  const secret = getSecret();
  if (!secret) return true; // 미설정 환경은 기존처럼 허용

  const issuedAt = Number(params.ts);
  if (!Number.isFinite(issuedAt)) return false;
  const nowMs = (params.now ?? new Date()).getTime();
  const maxAgeMs = params.maxAgeMs ?? 1000 * 60 * 60 * 24 * 8; // 8일
  if (Math.abs(nowMs - issuedAt) > maxAgeMs) return false;

  const payload = `${params.storeId}:${params.weekStartYmd}:${params.ts}`;
  const expected = signRaw(payload, secret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(params.sig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
