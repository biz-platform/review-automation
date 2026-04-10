import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import { encryptCookieJson } from "@/lib/utils/cookie-encrypt";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

const linkBodySchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

const PLATFORM_JOB: Record<string, "baemin_link" | "yogiyo_link" | "ddangyo_link" | "coupang_eats_link"> = {
  baemin: "baemin_link",
  "coupang-eats": "coupang_eats_link",
  yogiyo: "yogiyo_link",
  ddangyo: "ddangyo_link",
};

/** POST: 매장 없이 첫 연동. 연동 성공 시에만 서버에서 매장 생성. 202 + jobId 반환 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const params = await (context?.params ?? Promise.resolve({}));
  const platform = (params as { platform?: string }).platform ?? "";
  const jobType = PLATFORM_JOB[platform];
  if (!jobType) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
  }

  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const body = await request.json();
  const { username, password } = linkBodySchema.parse(body);

  const payload: Record<string, unknown> =
    jobType === "baemin_link"
      ? {
          credentials_encrypted: encryptCookieJson(
            JSON.stringify({ username: username.trim(), password }),
          ),
        }
      : { username: username.trim(), password };

  const jobId = await createBrowserJob(jobType, null, user.id, payload);

  return NextResponse.json({ result: { jobId } }, { status: 202 });
}

export const POST = withRouteHandler(postHandler);
