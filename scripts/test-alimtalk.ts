import dotenv from "dotenv";
import { ENV_KEY } from "@/lib/config/env-keys";
import { OLIVIEW_ALIMTALK_PUBLIC_WEB_URL } from "@/lib/constants/coolsms-alimtalk";
import {
  sendCoolSMSAlimTalk,
  type CoolSmsAlimtalkButton,
} from "@/lib/utils/notifications/sendCoolSMSAlimTalk";

dotenv.config({ path: ".env.local" });
dotenv.config();

function usage(): never {
  console.log(
    [
      "",
      "Usage:",
      "  pnpm exec tsx --no-cache scripts/test-alimtalk.ts <phone> <template>",
      "",
      "Templates:",
      "  trial_ends_3d | trial_ended_unpaid | payment_failed | dissatisfied_review",
      "",
      "Examples:",
      "  pnpm exec tsx --no-cache scripts/test-alimtalk.ts 01012345678 trial_ends_3d",
      "  pnpm exec tsx --no-cache scripts/test-alimtalk.ts 01012345678 dissatisfied_review",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const phone = process.argv[2]?.trim();
const template = process.argv[3]?.trim() as
  | "trial_ends_3d"
  | "trial_ended_unpaid"
  | "payment_failed"
  | "dissatisfied_review"
  | undefined;

if (!phone || !template) usage();

const appUrl = OLIVIEW_ALIMTALK_PUBLIC_WEB_URL;

function trimNonEmpty(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

const billingRegisterGuideUrl =
  trimNonEmpty(process.env[ENV_KEY.OLIVIEW_BILLING_REGISTER_GUIDE_URL]) ??
  "https://oliview.kr/guide/billing-register";
const billingManageGuideUrl =
  trimNonEmpty(process.env[ENV_KEY.OLIVIEW_BILLING_MANAGE_GUIDE_URL]) ??
  "https://oliview.kr/guide/billing-manage";
const replyRegisterGuideUrl =
  trimNonEmpty(process.env[ENV_KEY.OLIVIEW_REPLY_REGISTER_GUIDE_URL]) ??
  "https://oliview.kr/guide/review-reply";

let variables: Record<string, string> = {};
let buttons: CoolSmsAlimtalkButton[] | undefined;
if (template === "trial_ends_3d" || template === "trial_ended_unpaid") {
  variables = {};
  buttons = [
    {
      buttonType: "WL",
      buttonName: "결제 등록하기",
      linkMo: appUrl,
      linkPc: appUrl,
    },
    {
      buttonType: "WL",
      buttonName: "결제 등록하기 사용가이드",
      linkMo: billingRegisterGuideUrl,
      linkPc: billingRegisterGuideUrl,
    },
  ];
} else if (template === "payment_failed") {
  variables = {};
  buttons = [
    {
      buttonType: "WL",
      buttonName: "결제 등록하기",
      linkMo: appUrl,
      linkPc: appUrl,
    },
    {
      buttonType: "WL",
      buttonName: "결제 등록하기 사용가이드",
      linkMo: billingManageGuideUrl,
      linkPc: billingManageGuideUrl,
    },
  ];
} else {
  variables = {
    플랫폼명: "배민",
    별점: "2",
    리뷰내용: "테스트 리뷰입니다. 확인 부탁드립니다.",
    리뷰작성자닉네임: "테스터",
    리뷰등록일시: new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    }),
  };
  buttons = [
    {
      buttonType: "WL",
      buttonName: "리뷰 확인하기",
      linkMo: appUrl,
      linkPc: appUrl,
    },
    {
      buttonType: "WL",
      buttonName: "댓글 등록하기 사용가이드",
      linkMo: replyRegisterGuideUrl,
      linkPc: replyRegisterGuideUrl,
    },
  ];
}

async function main() {
  const r = await sendCoolSMSAlimTalk(
    phone,
    variables,
    buttons,
    template as NonNullable<typeof template>,
  );
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
