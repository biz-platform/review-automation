import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const secret = process.env.SELLER_REFERRAL_SECRET;
  if (!secret || secret.length < KEY_LENGTH) {
    throw new Error("SELLER_REFERRAL_SECRET required (32 bytes) for referral crypto");
  }
  return Buffer.from(secret, "utf8").subarray(0, KEY_LENGTH);
}

/** 셀러 추천인 ref 파라미터 암호화. 반환값을 URL의 ref 쿼리로 사용 */
export function encryptSellerUserId(userId: string): string {
  try {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const enc = Buffer.concat([
      cipher.update(userId, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, enc, authTag]).toString("base64url");
  } catch {
    return Buffer.from(userId, "utf8").toString("base64url");
  }
}

/**
 * ref → 셀러 user.id. 회원가입 시 추천인 연결용.
 * - 짧은 ref(8자): users.referral_code 로 조회 (supabase 필요 시 별도 서비스에서 조회).
 * - 긴 ref(과거 암호화): decryptSellerRef 로 복호화.
 */
/** ref 쿼리 값 복호화 → 셀러 user.id (과거 암호화 링크용) */
export function decryptSellerRef(refParam: string): string | null {
  const secret = process.env.SELLER_REFERRAL_SECRET;
  if (!secret || secret.length < KEY_LENGTH) {
    return null;
  }
  try {
    const key = Buffer.from(secret, "utf8").subarray(0, KEY_LENGTH);
    const combined = Buffer.from(refParam, "base64url");
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return null;
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    try {
      return Buffer.from(refParam, "base64url").toString("utf8");
    } catch {
      return null;
    }
  }
}
