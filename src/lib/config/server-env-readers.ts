import type { NextRequest } from "next/server";
import { ENV_KEY } from "@/lib/config/env-keys";

function trimNonEmpty(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

export function getCronSecretFromEnv(): string | undefined {
  return trimNonEmpty(process.env[ENV_KEY.CRON_SECRET]);
}

export function getWorkerSecretFromEnv(): string | undefined {
  return trimNonEmpty(process.env[ENV_KEY.WORKER_SECRET]);
}

/** `DEBUG_BROWSER_HEADED=1` 이면 브라우저 표시(headed), 그 외 기본 headless */
export function isPlaywrightHeadlessDefault(): boolean {
  return process.env[ENV_KEY.DEBUG_BROWSER_HEADED] !== "1";
}

export function readCronSecretFromRequestHeaders(request: NextRequest): string {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    ""
  );
}

export function isCronRequestAuthorized(request: NextRequest): boolean {
  const got = readCronSecretFromRequestHeaders(request);
  const expected = getCronSecretFromEnv();
  return Boolean(expected && got === expected);
}

export function isWorkerRequestAuthorized(request: NextRequest): boolean {
  const secret = getWorkerSecretFromEnv();
  if (!secret?.length) return false;
  const header =
    request.headers.get("x-worker-secret") ??
    request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() === secret;
  }
  return header === secret;
}

export type CoolsmsCredentials = {
  apiKey: string;
  apiSecret: string;
  sender: string;
};

export function getCoolsmsCredentialsFromEnv(): CoolsmsCredentials | null {
  const apiKey = trimNonEmpty(process.env[ENV_KEY.COOLSMS_API_KEY]);
  const apiSecret = trimNonEmpty(process.env[ENV_KEY.COOLSMS_API_SECRET]);
  const sender = trimNonEmpty(process.env[ENV_KEY.COOLSMS_SENDER]);
  if (!apiKey || !apiSecret || !sender) return null;
  return { apiKey, apiSecret, sender };
}

export function getSendSmsHookSecretFromEnv(): string | undefined {
  return trimNonEmpty(process.env[ENV_KEY.SEND_SMS_HOOK_SECRET]);
}

export function isSendSmsHookDebugEnabled(): boolean {
  return process.env[ENV_KEY.DEBUG_SEND_SMS_HOOK] === "true";
}
