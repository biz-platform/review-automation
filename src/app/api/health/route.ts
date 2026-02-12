import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

async function getHandler() {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from("stores").select("id").limit(1);
  } catch {
    return NextResponse.json(
      { result: { status: "unhealthy", database: "disconnected" } } as AppRouteHandlerResponse<{ status: string; database?: string }>,
      { status: 503 }
    );
  }
  return NextResponse.json({
    result: { status: "ok", database: "connected" },
  } as AppRouteHandlerResponse<{ status: string; database?: string }>);
}

export const GET = withRouteHandler(getHandler);
