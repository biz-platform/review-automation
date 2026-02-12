import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AppUnauthorizedError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";

export async function getUser(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AppUnauthorizedError({
      ...ERROR_CODES.UNAUTHORIZED,
      detail: error?.message ?? "No session",
    });
  }
  return { user, supabase };
}
