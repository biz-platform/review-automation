import { createHmac, randomBytes } from "node:crypto";
import { ENV_KEY } from "@/lib/config/env-keys";
import {
  getCoolsmsAlimtalkConfigFromEnv,
  type CoolsmsAlimtalkConfig,
} from "@/lib/config/server-env-readers";

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

/**
 * IMPORTANT:
 * - `templateId`는 CoolSMS 콘솔에 연동된 KA01TP... 를 넣어야 함
 * - `generateText` 결과 문자열이 카카오 심사된 템플릿 본문과 글자 단위로 일치해야 함
 */
const TEMPLATES: Record<OliviewAlimtalkTemplateType, TemplateSpec> = {
  trial_ends_3d: {
    templateId: "KA01TP260423014252917RVjCfW45NZz",
    generateText: () => `올리뷰 무료 체험 기간이 3일 후 종료됩니다.
체험 기간 종료 후 계속 이용하시려면 결제 수단을 등록해주세요.
등록하지 않으시면 서비스 이용이 자동으로 중단됩니다.`,
  },
  trial_ended_unpaid: {
    templateId: "KA01TP2604230149158834xNn2yEcAQx",
    generateText: () => `올리뷰 무료 체험 기간이 종료되었어요.

아직 결제 수단이 등록되지 않아 현재 서비스 이용이 일시 중단된 상태입니다. 계속 이용하시려면 아래에서 결제 수단을 등록해 주세요.

※ 결제 수단을 90일 이내에 등록하지 않으면, 고객 정보가 삭제되어 매장 연동 등 초기 설정을 다시 진행해야 할 수 있어요.`,
  },
  payment_failed: {
    templateId: "KA01TP260423015853116YpdgVIK51Hj",
    generateText: () => `올리뷰 결제가 실패하여 서비스 이용이 제한됩니다.

결제 수단을 확인하신 후 재시도해주세요.`,
  },
  dissatisfied_review: {
    templateId: "KA01TP260422023153461ZNGG49e6Tac",
    generateText: (v) => `서비스 올리뷰에서 알려드립니다.

사장님의 가게에 불만족 리뷰가 등록되었습니다. 해당 내용은 사장님 직접 확인이 필요합니다.

${v["플랫폼명"] ?? ""}에 ${v["별점"] ?? ""}리뷰가 달렸습니다. 자동 답글 설정과 관계없이 직접 확인 후 수동으로 답글을 등록해주세요.

리뷰 내용 : ${v["리뷰내용"] ?? ""}
작성자 : ${v["리뷰작성자닉네임"] ?? ""}
등록 일시 : ${v["리뷰등록일시"] ?? ""}`,
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

  const res = await fetch("https://api.coolsms.co.kr/messages/v4/send", {
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

