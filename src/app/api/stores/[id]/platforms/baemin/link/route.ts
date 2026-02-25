import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import { saveBaeminLinkCredentials } from "@/lib/services/platform-session-service";
import { getUser } from "@/lib/utils/auth/get-user";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

const linkBodySchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

/** POST: 연동 작업 생성. ID/PW는 암호화해 DB에만 저장, job payload에는 넣지 않음. 202 + jobId 반환 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);
  const body = await request.json();
  const { username, password } = linkBodySchema.parse(body);

  await saveBaeminLinkCredentials(storeId, user.id, username.trim(), password);
  const jobId = await createBrowserJob("baemin_link", storeId, user.id, {});

  return NextResponse.json({ jobId }, { status: 202 });
}

export const POST = withRouteHandler(postHandler);
