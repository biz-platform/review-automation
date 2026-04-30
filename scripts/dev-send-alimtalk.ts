import dotenv from "dotenv";

import {
  OLIVIEW_ALIMTALK_LINK_TOKEN_NO_SCHEME,
  OLIVIEW_ALIMTALK_PUBLIC_WEB_URL,
} from "@/lib/constants/coolsms-alimtalk";
import { sendCoolSMSAlimTalk } from "@/lib/utils/notifications/sendCoolSMSAlimTalk";
import type { OliviewAlimtalkTemplateType } from "@/lib/utils/notifications/sendCoolSMSAlimTalk";

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  const v = process.argv[idx + 1];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function usage(): never {
  console.log(
    [
      "Usage:",
      "  pnpm exec tsx --no-cache scripts/dev-send-alimtalk.ts --to 01012345678 --template trial_ends_3d",
      "",
      "Templates:",
      "  - dissatisfied_review",
      "  - trial_ends_3d",
      "  - trial_ended_unpaid",
      "  - payment_failed",
      "",
      "Optional vars:",
      "  --platform 배민",
      "  --rating 2점 ",
      "  --content '맛이 별로에요'",
      "  --author '고객닉'",
      "  --writtenAt '2026-04-27 12:34'",
      "  --guideUrl 'https://...'(결제 사용가이드 링크)",
      "  --replyGuideUrl 'https://...'(댓글 등록하기 사용가이드 링크)",
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  // Next.js 로컬 개발과 동일하게 .env.local을 우선 로드
  dotenv.config({ path: ".env.local" });

  const to = getArg("to");
  const template = getArg("template") as OliviewAlimtalkTemplateType | null;
  if (!to || !template) usage();

  const variables: Record<string, string> = {};
  if (template === "dissatisfied_review") {
    variables["플랫폼명"] = getArg("platform") ?? "배민";
    variables["별점"] = getArg("rating") ?? "2점 ";
    variables["리뷰내용"] = getArg("content") ?? "맛이 아쉬웠어요.";
    variables["리뷰작성자닉네임"] = getArg("author") ?? "테스트고객";
    variables["리뷰등록일시"] = getArg("writtenAt") ?? "2026-04-27 12:34";
  } else {
    // 템플릿 버튼이 https://#{LINK} 일 때 치환용
    variables["LINK"] = OLIVIEW_ALIMTALK_LINK_TOKEN_NO_SCHEME;
  }

  const guideUrl = getArg("guideUrl") ?? OLIVIEW_ALIMTALK_PUBLIC_WEB_URL;
  const replyGuideUrl = getArg("replyGuideUrl") ?? OLIVIEW_ALIMTALK_PUBLIC_WEB_URL;

  const buttons =
    template === "dissatisfied_review"
      ? [
          {
            buttonType: "WL" as const,
            buttonName: "리뷰 확인하기",
            linkMo: OLIVIEW_ALIMTALK_PUBLIC_WEB_URL,
            linkPc: OLIVIEW_ALIMTALK_PUBLIC_WEB_URL,
          },
          {
            buttonType: "WL" as const,
            buttonName: "댓글 등록하기 사용가이드",
            linkMo: replyGuideUrl,
            linkPc: replyGuideUrl,
          },
        ]
      : [
          {
            buttonType: "WL" as const,
            buttonName: "결제 등록하기",
            linkMo: OLIVIEW_ALIMTALK_PUBLIC_WEB_URL,
            linkPc: OLIVIEW_ALIMTALK_PUBLIC_WEB_URL,
          },
          {
            buttonType: "WL" as const,
            buttonName: "결제 등록하기 사용가이드",
            linkMo: guideUrl,
            linkPc: guideUrl,
          },
        ];

  const r = await sendCoolSMSAlimTalk(to, variables, buttons, template);
  console.log(JSON.stringify(r, null, 2));
}

void main();
