import { NextRequest, NextResponse } from "next/server";
import {
  getBrowserJobById,
  completeBrowserJob,
  failBrowserJob,
} from "@/lib/services/browser-job-service";
import { applyBrowserJobResult } from "@/lib/services/browser-job-apply-result";

const WORKER_SECRET = process.env.WORKER_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!WORKER_SECRET?.length) return false;
  const header = request.headers.get("x-worker-secret") ?? request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() === WORKER_SECRET;
  }
  return header === WORKER_SECRET;
}

/** POST: 워커가 작업 결과 제출. body: { success: boolean, result?: object, errorMessage?: string } */
export async function POST(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await (context?.params ?? Promise.resolve({}));
  const jobId = (params as { id?: string }).id ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "job id required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const success = Boolean(body.success);
  const result = body.result as Record<string, unknown> | undefined;
  const errorMessage = typeof body.errorMessage === "string" ? body.errorMessage : "Unknown error";

  const job = await getBrowserJobById(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status === "cancelled") {
    return NextResponse.json({ ok: true });
  }
  if (job.status !== "processing") {
    return NextResponse.json({ error: "Job not in processing state" }, { status: 409 });
  }

  if (success && result) {
    try {
      await applyBrowserJobResult(job, result);
      await completeBrowserJob(jobId, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await failBrowserJob(jobId, msg);
      return NextResponse.json({ error: "Apply failed", detail: msg }, { status: 500 });
    }
  } else {
    await failBrowserJob(jobId, errorMessage);
  }

  return NextResponse.json({ ok: true });
}
