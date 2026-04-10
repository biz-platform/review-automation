import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { encryptCookieJson } from "@/lib/utils/cookie-encrypt";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

const linkBodySchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

/** POST: 연동 작업 생성. ID/PW는 job payload에 암호화해 넣음. 연동 성공 시에만 store_platform_sessions에 저장. 202 + jobId 반환 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const body = await request.json();
  const { username, password } = linkBodySchema.parse(body);

  const credentialsEncrypted = encryptCookieJson(
    JSON.stringify({ username: username.trim(), password }),
  );
  const jobId = await createBrowserJob("baemin_link", storeId, user.id, {
    credentials_encrypted: credentialsEncrypted,
  });

  return NextResponse.json({ result: { jobId } }, { status: 202 });
}

export const POST = withRouteHandler(postHandler);
