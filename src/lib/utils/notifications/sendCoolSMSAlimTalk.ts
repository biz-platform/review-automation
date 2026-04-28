import { createHmac, randomBytes } from "node:crypto";
import { ENV_KEY } from "@/lib/config/env-keys";
import {
  getCoolsmsAlimtalkConfigFromEnv,
  type CoolsmsAlimtalkConfig,
} from "@/lib/config/server-env-readers";
import {
  buildAlimtalkDissatisfiedReviewBody,
  buildAlimtalkPaymentFailedBody,
  buildAlimtalkTrialEndedUnpaidBody,
  buildAlimtalkTrialEnds3dBody,
  COOLSMS_ALIMTALK_KAKAO_TEMPLATE_ID,
  COOLSMS_MESSAGES_V4_SEND_URL,
} from "@/lib/constants/coolsms-alimtalk";

export type CoolSmsAlimtalkButton = {
  buttonType: "WL" | "AL" | "DS" | "BK" | "MD" | "AC";
  buttonName: string;
  linkMo?: string;
  linkPc?: string;
};

function normalizeToDomesticNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("82")) return "0" + digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(0, 11);
  return digits.length >= 9 ? "0" + digits.slice(-9) : "0" + digits;
}

function signCoolsmsAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export type OliviewAlimtalkTemplateType =
  | "trial_ends_3d"
  | "trial_ended_unpaid"
  | "payment_failed"
  | "dissatisfied_review";

type TemplateSpec = {
  templateId: string;
  generateText: (variables: Record<string, string>) => string;
};

/** 템플릿 ID·본문은 `@/lib/constants/coolsms-alimtalk` 단일 출처 */
const TEMPLATES: Record<OliviewAlimtalkTemplateType, TemplateSpec> = {
  trial_ends_3d: {
    templateId: COOLSMS_ALIMTALK_KAKAO_TEMPLATE_ID.trial_ends_3d,
    generateText: () => buildAlimtalkTrialEnds3dBody(),
  },
  trial_ended_unpaid: {
    templateId: COOLSMS_ALIMTALK_KAKAO_TEMPLATE_ID.trial_ended_unpaid,
    generateText: () => buildAlimtalkTrialEndedUnpaidBody(),
  },
  payment_failed: {
    templateId: COOLSMS_ALIMTALK_KAKAO_TEMPLATE_ID.payment_failed,
    generateText: () => buildAlimtalkPaymentFailedBody(),
  },
  dissatisfied_review: {
    templateId: COOLSMS_ALIMTALK_KAKAO_TEMPLATE_ID.dissatisfied_review,
    generateText: (v) => buildAlimtalkDissatisfiedReviewBody(v),
  },
};

export async function sendCoolSMSAlimTalk(
  phoneNumber: string,
  variables: Record<string, string>,
  buttons: CoolSmsAlimtalkButton[] | undefined,
  template: OliviewAlimtalkTemplateType,
  opts?: { config?: CoolsmsAlimtalkConfig | null },
): Promise<{ ok: boolean; raw?: unknown; error?: string }> {
  const config = opts?.config ?? getCoolsmsAlimtalkConfigFromEnv();
  if (!config) {
    console.error("[alimtalk] CoolSMS 알림톡 환경변수가 설정되지 않았습니다.");
    return { ok: false, error: "missing_coolsms_env" };
  }

  const spec = TEMPLATES[template];
  const to = normalizeToDomesticNumber(phoneNumber);
  const text = spec.generateText(variables);

  if (process.env[ENV_KEY.NODE_ENV] !== "production") {
    console.log("[alimtalk] send request", {
      template,
      toMasked: "***" + to.slice(-4),
      textPreview: text.slice(0, 80),
    });
  }

  const res = await fetch(COOLSMS_MESSAGES_V4_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: signCoolsmsAuthHeader(config.apiKey, config.apiSecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        to,
        from: config.senderNumber,
        text,
        kakaoOptions: {
          pfId: config.pfId,
          templateId: spec.templateId,
          buttons: buttons ?? [],
        },
      },
    }),
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  const statusCode =
    typeof json === "object" && json !== null && "statusCode" in json
      ? String((json as { statusCode?: unknown }).statusCode ?? "")
      : "";

  if (!res.ok || statusCode !== "2000") {
    const err = `[alimtalk] failed http=${res.status} statusCode=${statusCode}`;
    console.error(err, { template, to: "***" + to.slice(-4), json });
    return { ok: false, raw: json, error: err };
  }

  if (process.env[ENV_KEY.NODE_ENV] !== "production") {
    console.log("[alimtalk] send ok", { template, toMasked: "***" + to.slice(-4) });
  }
  return { ok: true, raw: json };
}

