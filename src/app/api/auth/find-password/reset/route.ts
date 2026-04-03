import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { findPasswordNewPasswordSchema } from "@/lib/validation/find-password-schema";

const bodySchema = z.object({
  recoverySessionId: z.string().uuid(),
  password: findPasswordNewPasswordSchema,
});

type Result = { success: true };

async function postHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<Result>>> {
  const body = await request.json();
  const parsed = bodySchema.parse(body);

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: session, error: selErr } = await supabase
    .from("password_recovery_sessions")
    .select("id, user_id, expires_at, consumed_at")
    .eq("id", parsed.recoverySessionId)
    .maybeSingle();

  if (selErr) {
    console.error("[find-password/reset] select session", selErr);
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_SESSION_INVALID);
  }
  if (!session) {
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_SESSION_INVALID);
  }
  if (session.consumed_at) {
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_SESSION_INVALID);
  }
  if (session.expires_at < nowIso) {
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_SESSION_INVALID);
  }

  const { error: authErr } = await supabase.auth.admin.updateUserById(
    session.user_id as string,
    { password: parsed.password },
  );
  if (authErr) {
    console.error("[find-password/reset] updateUserById", authErr);
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_RESET_FAILED);
  }

  const { error: updErr } = await supabase
    .from("password_recovery_sessions")
    .update({ consumed_at: nowIso })
    .eq("id", parsed.recoverySessionId)
    .is("consumed_at", null);

  if (updErr) {
    console.error("[find-password/reset] consume session", updErr);
  }

  return NextResponse.json({ result: { success: true } });
}

export const POST = withRouteHandler(postHandler);
