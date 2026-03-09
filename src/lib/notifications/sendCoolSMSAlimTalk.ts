import crypto from "crypto";

export interface CoolSMSAlimTalkButton {
  buttonType: string;
  buttonName: string;
  linkMo?: string;
  linkPc?: string;
}

export type CoolSMSAlimTalkTemplateType =
  | "signup"
  | "payment"
  | "completion"
  | "seller notification"
  | "verification";

interface TemplateConfig {
  templateId: string;
  generateMessage: (variables: Record<string, string>) => string;
}

const TEMPLATES: Record<CoolSMSAlimTalkTemplateType, TemplateConfig> = {
  signup: {
    templateId: "KA01TP250104042206482mjQMJtUbFA9",
    generateMessage: (v) =>
      `안녕하세요, ${v.고객명}님!\n${v.회사명}입니다.\n\n회원가입 감사 적립금 1,000 포인트가 지급되었습니다 😆\n\n이 메시지는 고객님의 동의에 따라 지급된 적립금 안내 메시지입니다.`,
  },
  payment: {
    templateId: "KA01TP250108005050221BqM0EIShwH9",
    generateMessage: (v) =>
      `[${v.회사명}] 결제 완료\n\n🎁 주문상품: ${v.상품명}\n⏰ 예상 소요시간: ${v.시간}\n💳 결제금액: ${v.결제금액}원\n\n곧 빠르게 준비해드릴게요!\n궁금한 점이 있으시면 언제든 문의해주세요. 😊`,
  },
  completion: {
    templateId: "KA01TP250109004820988BXu8kqldpKj",
    generateMessage: (v) =>
      `[${v.회사명}] 작업 완료 안내\n\n🎁 주문 상품: ${v.상품명}\n💳 주문 확인 링크: ${v.링크}\n\n작업이 성공적으로 완료되었습니다!\n더 궁금한 사항이 있으시면 언제든지 저희에게 문의해주세요. 😊`,
  },
  "seller notification": {
    templateId: "KA01TP250109004820988BXu8kqldpKj",
    generateMessage: (v) =>
      `[${v.회사명}]\n${v.주문자명}님 결제 완료\n\n🎁 주문상품: ${v.상품명}\n💳 결제금액: ${v.결제금액}원\n\n(카톡)  주문자명: ${v.주문자명}\n(카톡)  주문자ID: ${v.주문자ID}\n(돈)  예상수당: ${v.수당}원\n\n궁금한 점이 있으시면 언제든 문의해주세요. 😊`,
  },
  verification: {
    /** CoolSMS/카카오에 등록한 인증번호 알림톡 템플릿 ID. env COOLSMS_VERIFICATION_TEMPLATE_ID로 덮어쓰기 가능 */
    templateId: "KA01TP250104042206482mjQMJtUbFA9",
    generateMessage: (v) =>
      `[올리뷰]\n\n인증번호: ${v.인증번호}\n3분 이내에 입력해주세요.`,
  },
};

/**
 * CoolSMS 알림톡 발송 (Messages v4 API, HMAC-SHA256).
 * env: COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER, COOLSMS_PFID
 */
export async function sendCoolSMSAlimTalk(
  phoneNumber: string,
  variables: Record<string, string>,
  buttons?: CoolSMSAlimTalkButton[],
  template: CoolSMSAlimTalkTemplateType = "signup",
): Promise<unknown> {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  const from = process.env.COOLSMS_SENDER;
  const pfId = process.env.COOLSMS_PFID;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "CoolSMS 설정 누락: " + (!apiKey ? "API_KEY " : "") + (!apiSecret ? "API_SECRET " : ""),
    );
  }
  if (!from || !pfId) {
    throw new Error("CoolSMS 알림톡용 COOLSMS_SENDER, COOLSMS_PFID 필요");
  }

  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");

  const templateConfig = TEMPLATES[template];
  const templateId =
    template === "verification" && process.env.COOLSMS_VERIFICATION_TEMPLATE_ID
      ? process.env.COOLSMS_VERIFICATION_TEMPLATE_ID
      : templateConfig.templateId;
  const message: Record<string, unknown> = {
    to: phoneNumber,
    from,
    text: templateConfig.generateMessage(variables),
    kakaoOptions: {
      pfId,
      templateId,
      variables,
    },
  };
  if (buttons?.length) {
    (message.kakaoOptions as Record<string, unknown>).buttons = buttons;
  }

  const res = await fetch("https://api.coolsms.co.kr/messages/v4/send", {
    method: "POST",
    headers: {
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const result = (await res.json()) as {
    statusCode?: string;
    statusMessage?: string;
  };

  if (!res.ok) {
    throw new Error(
      `CoolSMS HTTP ${res.status}: ${JSON.stringify(result)}`,
    );
  }
  if (result.statusCode !== "2000") {
    throw new Error(
      `CoolSMS ${result.statusCode ?? ""}: ${result.statusMessage ?? "알 수 없음"}`,
    );
  }

  return result;
}
