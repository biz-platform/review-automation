import { NextRequest, NextResponse } from "next/server";
import {
  getBrowserJobById,
  completeBrowserJob,
  failBrowserJob,
  updateBrowserJobStoreId,
} from "@/lib/services/browser-job-service";
import { applyBrowserJobResult } from "@/lib/services/browser-job-apply-result";
import { buildPersistedBrowserJobOutcome } from "@/lib/services/browser-job-result-persist";
import { StoreService } from "@/lib/services/store-service";
import { deriveInitialStoreNameFromLinkResult } from "@/lib/services/store-name-helpers";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { unlinkPlatformSessionWithReviewSnapshot } from "@/lib/services/platform-unlink-service";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";
import { withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

const storeService = new StoreService();

const WORKER_SECRET = process.env.WORKER_SECRET;

function serializeApplyFailure(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e !== null && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const msg = o.message ?? o.error_description;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    try {
      return JSON.stringify(o);
    } catch {
      return Object.prototype.toString.call(e);
    }
  }
  return String(e);
}

function isAuthorized(request: NextRequest): boolean {
  if (!WORKER_SECRET?.length) return false;
  const header = request.headers.get("x-worker-secret") ?? request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() === WORKER_SECRET;
  }
  return header === WORKER_SECRET;
}

/** POST: 워커가 작업 결과 제출. body: { success: boolean, result?: object, errorMessage?: string } */
async function postHandler(request: NextRequest, context?: RouteContext) {
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

  const isLinkJob = [
    "baemin_link",
    "coupang_eats_link",
    "yogiyo_link",
    "ddangyo_link",
  ].includes(job.type);

  const JOB_TYPE_TO_PLATFORM: Partial<Record<string, PlatformCode>> = {
    baemin_link: "baemin",
    baemin_sync: "baemin",
    baemin_orders_sync: "baemin",
    coupang_eats_link: "coupang_eats",
    coupang_eats_sync: "coupang_eats",
    yogiyo_link: "yogiyo",
    yogiyo_sync: "yogiyo",
    yogiyo_orders_sync: "yogiyo",
    ddangyo_link: "ddangyo",
    ddangyo_sync: "ddangyo",
    ddangyo_orders_sync: "ddangyo",
  };
  const isLoginFailureMessage = (msg: string): boolean => {
    const n = msg.trim();
    return (
      n.includes("매장 연동에 실패") ||
      n.includes("아이디·비밀번호를 확인") ||
      n.includes("아이디 혹은 비밀번호가 일치하지 않습니다") ||
      /아이디.*비밀번호|비밀번호.*확인/.test(n)
    );
  };

  if (success && result) {
    if (isLinkJob) {
      const cookies = result.cookies;
      if (!Array.isArray(cookies) || cookies.length === 0) {
        await failBrowserJob(
          jobId,
          "연동 결과가 올바르지 않습니다(cookies 없음). 연동 데이터는 저장되지 않았습니다."
        );
        return NextResponse.json({ ok: true });
      }
    }

    const isReplyJob = [
      "baemin_register_reply",
      "baemin_modify_reply",
      "baemin_delete_reply",
      "yogiyo_register_reply",
      "yogiyo_modify_reply",
      "yogiyo_delete_reply",
      "ddangyo_register_reply",
      "ddangyo_modify_reply",
      "ddangyo_delete_reply",
      "coupang_eats_register_reply",
      "coupang_eats_modify_reply",
      "coupang_eats_delete_reply",
    ].includes(job.type);
    const mergedResult =
      isReplyJob && job.payload
        ? {
            ...job.payload,
            ...result,
            reviewId:
              (result?.reviewId as string) ??
              (job.payload.reviewId as string) ??
              (job.payload.review_id as string),
            content:
              (result?.content as string) ?? (job.payload.content as string),
          }
        : result;

    if (isReplyJob) {
      const rid = (mergedResult as { reviewId?: string }).reviewId;
      const len = typeof (mergedResult as { content?: string }).content === "string" ? (mergedResult as { content: string }).content.length : 0;
      console.log("[result] reply job apply 예정", {
        jobId,
        reviewId: rid ?? "(없음)",
        reviewIdFromPayload: (job.payload?.reviewId as string) ?? (job.payload?.review_id as string) ?? "(없음)",
        contentLength: len,
      });
    }

    let jobToApply = job;
    if (isLinkJob && !job.store_id) {
      const extId = result?.external_shop_id;
      if (extId != null && String(extId).trim() !== "") {
        const platformByType: Record<string, string> = {
          baemin_link: "baemin",
          yogiyo_link: "yogiyo",
          ddangyo_link: "ddangyo",
          coupang_eats_link: "coupang_eats",
        };
        const platform = platformByType[job.type];
        if (platform) {
          const supabase = createServiceRoleClient();
          const extIdStr = String(extId).trim();
          const { data: rows } = await supabase
            .from("store_platform_sessions")
            .select("store_id")
            .eq("platform", platform)
            .eq("external_shop_id", extIdStr)
            .limit(1);
          if (rows && rows.length > 0) {
            await failBrowserJob(jobId, "이미 다른 계정에 연동된 매장입니다.");
            return NextResponse.json({ ok: true });
          }
        }
      }
      const supabase = createServiceRoleClient();
      const initialName =
        deriveInitialStoreNameFromLinkResult(
          job.type,
          result as Record<string, unknown>,
        ) ?? "내 매장";
      const created = await storeService.create(
        job.user_id,
        { name: initialName },
        supabase,
      );
      await updateBrowserJobStoreId(jobId, created.id);
      jobToApply = (await getBrowserJobById(jobId)) ?? job;
      (mergedResult as Record<string, unknown>).store_id = created.id;
    }

    try {
      await applyBrowserJobResult(jobToApply, mergedResult);
      const persisted = buildPersistedBrowserJobOutcome(
        jobToApply.type,
        mergedResult as Record<string, unknown>,
      );
      await completeBrowserJob(jobId, persisted);
    } catch (e) {
      const msg = serializeApplyFailure(e);
      console.error("[worker/jobs/result] applyBrowserJobResult failed", jobId, jobToApply.type, e);
      await failBrowserJob(jobId, msg);
      if (isLinkJob && !job.store_id && jobToApply.store_id) {
        const supabase = createServiceRoleClient();
        const { error: deleteErr } = await supabase
          .from("stores")
          .delete()
          .eq("id", jobToApply.store_id)
          .eq("user_id", job.user_id);
        if (deleteErr) {
          console.error("[result] rollback store delete failed", jobToApply.store_id, deleteErr.message);
        }
      }
      return NextResponse.json({ error: "Apply failed", detail: msg }, { status: 500 });
    }
  } else {
    let finalMessage = errorMessage;
    const shouldUnlink =
      job.store_id &&
      JOB_TYPE_TO_PLATFORM[job.type] != null &&
      isLoginFailureMessage(errorMessage);
    if (shouldUnlink) {
      const platform = JOB_TYPE_TO_PLATFORM[job.type];
      const storeId = job.store_id;
      if (platform && storeId) {
        try {
          await unlinkPlatformSessionWithReviewSnapshot(storeId, platform);
          finalMessage = `${errorMessage}\n\n해당 플랫폼 연동이 자동 해제되었습니다. 다시 연동해 주세요.`;
        } catch (delErr) {
          console.error(
            "[worker/result] unlink on login failure failed",
            storeId,
            platform,
            delErr instanceof Error ? delErr.message : String(delErr),
          );
        }
      }
    }
    await failBrowserJob(jobId, finalMessage);
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRouteHandler(postHandler);
