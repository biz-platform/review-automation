/**
 * 인증번호(OTP) 저장소. 메모리 기반.
 *
 * - 단일 인스턴스·재시작 시 재발송 허용이면 in-memory로 충분.
 * - 서버리스/다중 인스턴스(Vercel 등)면 인스턴스 간 메모리 공유가 없어
 *   send한 서버와 verify한 서버가 다를 수 있으므로 Redis 등 공유 저장소 필요.
 */

import {
  OTP_CODE_VALIDITY_MS,
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS_PER_HOUR,
  ONE_HOUR_MS,
  OTP_EMAIL_KEY_PREFIX,
} from "@/lib/constants/verification";

export interface OtpEntry {
  code: string;
  expiresAt: number;
  createdAt: number;
}

/** key: normalized phone (E.164) 또는 email:xxx */
const store = new Map<string, OtpEntry>();
const lastSentAt = new Map<string, number>();
const sentTimestampsByPhone = new Map<string, number[]>();
const sentTimestampsByEmail = new Map<string, number[]>();

function pruneOldTimestamps(phone: string) {
  const timestamps = sentTimestampsByPhone.get(phone) ?? [];
  const cutoff = Date.now() - ONE_HOUR_MS;
  const kept = timestamps.filter((t) => t > cutoff);
  if (kept.length === 0) sentTimestampsByPhone.delete(phone);
  else sentTimestampsByPhone.set(phone, kept);
}

export function setOtp(phone: string, code: string): void {
  const now = Date.now();
  store.set(phone, {
    code,
    expiresAt: now + OTP_CODE_VALIDITY_MS,
    createdAt: now,
  });
  lastSentAt.set(phone, now);
  pruneOldTimestamps(phone);
  const timestamps = sentTimestampsByPhone.get(phone) ?? [];
  timestamps.push(now);
  sentTimestampsByPhone.set(phone, timestamps);
}

export function getOtp(phone: string): OtpEntry | null {
  const entry = store.get(phone);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return null;
  }
  return entry;
}

/** 검증 성공 시 한 번만 사용되도록 삭제 */
export function consumeOtp(phone: string): boolean {
  return store.delete(phone);
}

export type SendLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "cooldown"; retryAfterSec: number }
  | { allowed: false; reason: "max_per_hour" };

export function checkSendLimit(phone: string): SendLimitResult {
  const now = Date.now();
  const last = lastSentAt.get(phone);
  if (last != null && now - last < OTP_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterSec: Math.ceil((OTP_COOLDOWN_MS - (now - last)) / 1000),
    };
  }
  pruneOldTimestamps(phone);
  const timestamps = sentTimestampsByPhone.get(phone) ?? [];
  if (timestamps.length >= OTP_MAX_ATTEMPTS_PER_HOUR) {
    return { allowed: false, reason: "max_per_hour" };
  }
  return { allowed: true };
}

// --- 이메일 OTP (로컬 테스트용: 발송 없이 코드만 저장·반환) ---

function emailKey(email: string): string {
  return OTP_EMAIL_KEY_PREFIX + email.trim().toLowerCase();
}

function pruneOldTimestampsEmail(emailKeyStr: string) {
  const timestamps = sentTimestampsByEmail.get(emailKeyStr) ?? [];
  const cutoff = Date.now() - ONE_HOUR_MS;
  const kept = timestamps.filter((t) => t > cutoff);
  if (kept.length === 0) sentTimestampsByEmail.delete(emailKeyStr);
  else sentTimestampsByEmail.set(emailKeyStr, kept);
}

export function setOtpEmail(email: string, code: string): void {
  const key = emailKey(email);
  const now = Date.now();
  store.set(key, {
    code,
    expiresAt: now + OTP_CODE_VALIDITY_MS,
    createdAt: now,
  });
  lastSentAt.set(key, now);
  pruneOldTimestampsEmail(key);
  const timestamps = sentTimestampsByEmail.get(key) ?? [];
  timestamps.push(now);
  sentTimestampsByEmail.set(key, timestamps);
}

export function getOtpEmail(email: string): OtpEntry | null {
  const key = emailKey(email);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function consumeOtpEmail(email: string): boolean {
  return store.delete(emailKey(email));
}

export function checkSendLimitEmail(email: string): SendLimitResult {
  const key = emailKey(email);
  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last != null && now - last < OTP_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterSec: Math.ceil((OTP_COOLDOWN_MS - (now - last)) / 1000),
    };
  }
  pruneOldTimestampsEmail(key);
  const timestamps = sentTimestampsByEmail.get(key) ?? [];
  if (timestamps.length >= OTP_MAX_ATTEMPTS_PER_HOUR) {
    return { allowed: false, reason: "max_per_hour" };
  }
  return { allowed: true };
}
