import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";

const LOGIN_URL =
  new URL("/login", process.env.NEXT_PUBLIC_VERCEL_URL ?? "http://localhost:3000").href;

async function doSignOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(LOGIN_URL, { status: 302 });
}

export async function GET() {
  return doSignOut();
}

export async function POST() {
  return doSignOut();
}
