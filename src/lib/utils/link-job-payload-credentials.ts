import { decryptCookieJson } from "@/lib/utils/cookie-encrypt";

/**
 * `browser_jobs.payload`에서 플랫폼 연동용 ID/PW 추출.
 * 1) `credentials_encrypted` (배민과 동일: encryptCookieJson(JSON.stringify({ username, password })))
 * 2) 레거시: 평문 `username` / `password` (이전에 생성된 pending job 호환)
 */
export function getCredentialsFromLinkJobPayload(
  payload: Record<string, unknown> | null | undefined,
): { username: string; password: string } | null {
  if (!payload || typeof payload !== "object") return null;

  const enc = payload.credentials_encrypted;
  if (typeof enc === "string" && enc.trim() !== "") {
    try {
      const raw = decryptCookieJson(enc);
      const parsed = JSON.parse(raw) as {
        username?: string;
        password?: string;
      };
      if (
        typeof parsed?.username === "string" &&
        typeof parsed?.password === "string"
      ) {
        return { username: parsed.username, password: parsed.password };
      }
    } catch {
      return null;
    }
  }

  const u = payload.username;
  const p = payload.password;
  if (typeof u === "string" && typeof p === "string" && u.trim() !== "") {
    return { username: u.trim(), password: p };
  }
  return null;
}
