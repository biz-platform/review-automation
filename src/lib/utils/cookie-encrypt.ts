/**
 * 세션 쿠키 저장 시 간단 암호화.
 * PLATFORM_SESSION_ENCRYPTION_KEY(32자) 미설정 시 기본 키 사용(운영에서는 반드시 32자 이상 설정 권장).
 */
import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
  const raw = process.env.PLATFORM_SESSION_ENCRYPTION_KEY;
  if (raw && raw.length >= KEY_LEN) {
    return Buffer.from(raw.slice(0, KEY_LEN), "utf8");
  }
  return Buffer.alloc(KEY_LEN, "review-automation-default-key-do-not-use-in-prod");
}

export function encryptCookieJson(json: string): string {
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
  } catch {
    return Buffer.from(json, "utf8").toString("base64");
  }
}

export function decryptCookieJson(encrypted: string): string {
  try {
    const buf = Buffer.from(encrypted, "base64");
    if (buf.length <= IV_LEN + TAG_LEN) {
      return Buffer.from(encrypted, "base64").toString("utf8");
    }
    const key = getKey();
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final("utf8");
  } catch {
    return Buffer.from(encrypted, "base64").toString("utf8");
  }
}
