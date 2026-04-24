import type { SupabaseClient } from "@supabase/supabase-js";
import { ENV_KEY } from "@/lib/config/env-keys";
import { computeMemberFreeAccessEndsAt } from "@/lib/billing/member-subscription-access";
import { addCalendarDaysKst, formatKstYmd } from "@/lib/utils/kst-date";
import {
  markNotificationEventError,
  markNotificationEventSent,
  tryCreateNotificationEvent,
} from "@/lib/notifications/notification-events";
import {
  sendCoolSMSAlimTalk,
  type CoolSmsAlimtalkButton,
  type OliviewAlimtalkTemplateType,
} from "@/lib/utils/notifications/sendCoolSMSAlimTalk";

function appUrl(): string {
  // 알림톡 메시지에 들어가는 URL은 실행 환경과 무관하게 항상 프로덕션 도메인 고정
  return "https://www.oliview.kr/";
}

function nonEmpty(s: unknown): string | null {
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

export type BillingGuideUrls = {
  billingRegisterGuideUrl?: string | null;
  billingManageGuideUrl?: string | null;
  replyRegisterGuideUrl?: string | null;
};

export function defaultBillingGuideUrls(): BillingGuideUrls {
  return {
    billingRegisterGuideUrl:
      nonEmpty(process.env[ENV_KEY.OLIVIEW_BILLING_REGISTER_GUIDE_URL]) ?? null,
    billingManageGuideUrl:
      nonEmpty(process.env[ENV_KEY.OLIVIEW_BILLING_MANAGE_GUIDE_URL]) ?? null,
    replyRegisterGuideUrl:
      nonEmpty(process.env[ENV_KEY.OLIVIEW_REPLY_REGISTER_GUIDE_URL]) ?? null,
  };
}

export async function sendMemberAlimtalkIfNeeded(
  supabase: SupabaseClient,
  params: {
    eventType: "trial_ends_3d" | "trial_ended_unpaid" | "payment_failed";
    userId: string;
    phone: string;
    dedupeKey: string;
    guideUrls?: BillingGuideUrls;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const { created, id } = await tryCreateNotificationEvent(supabase, {
    dedupeKey: params.dedupeKey,
    eventType: params.eventType,
    userId: params.userId,
    recipientPhone: params.phone,
    meta: { appUrl: appUrl() },
  });
  if (!created || !id) return { sent: false, reason: "deduped" };

  const guide = params.guideUrls ?? defaultBillingGuideUrls();
  const template: OliviewAlimtalkTemplateType =
    params.eventType === "trial_ends_3d"
      ? "trial_ends_3d"
      : params.eventType === "trial_ended_unpaid"
        ? "trial_ended_unpaid"
        : "payment_failed";

  const registerGuideUrl =
    guide.billingRegisterGuideUrl ??
    guide.billingManageGuideUrl ??
    appUrl();

  const buttons: CoolSmsAlimtalkButton[] = [
    {
      buttonType: "WL",
      buttonName: "결제 등록하기",
      linkMo: appUrl(),
      linkPc: appUrl(),
    },
    {
      buttonType: "WL",
      buttonName: "결제 등록하기 사용가이드",
      linkMo: registerGuideUrl,
      linkPc: registerGuideUrl,
    },
  ];

  const r = await sendCoolSMSAlimTalk(params.phone, {}, buttons, template);
  if (!r.ok) {
    await markNotificationEventError(supabase, id, r.error ?? "send_failed");
    return { sent: false, reason: "send_failed" };
  }
  await markNotificationEventSent(supabase, id);
  return { sent: true };
}

type UserRow = {
  id: string;
  role: string | null;
  created_at: string;
  paid_until: string | null;
  phone: string | null;
};

export async function runMemberBillingAlimtalkCron(
  supabase: SupabaseClient,
  now: Date = new Date(),
  guideUrls?: BillingGuideUrls,
): Promise<{
  usersChecked: number;
  trialEnds3dSent: number;
  trialEndedUnpaidSent: number;
  paymentFailedSent: number;
}> {
  const today = formatKstYmd(now);
  const target3d = addCalendarDaysKst(today, 3);

  const { data: users, error } = await supabase
    .from("users")
    .select("id, role, created_at, paid_until, phone")
    .in("role", ["member", "planner"]);
  if (error) throw error;

  let trialEnds3dSent = 0;
  let trialEndedUnpaidSent = 0;
  let paymentFailedSent = 0;

  const rows = (users ?? []) as UserRow[];
  for (const u of rows) {
    const phone = nonEmpty(u.phone);
    if (!phone) continue;

    const createdAt = new Date(u.created_at);
    const paidUntil = u.paid_until ? new Date(u.paid_until) : null;
    const freeEndsAt = computeMemberFreeAccessEndsAt(createdAt);
    const freeEndYmd = formatKstYmd(freeEndsAt);

    const isPaidActive = paidUntil != null && paidUntil.getTime() >= now.getTime();
    const isTrialActive = now.getTime() < freeEndsAt.getTime();

    if (!isPaidActive && isTrialActive && freeEndYmd === target3d) {
      const dedupeKey = `trial_ends_3d:${u.id}:${freeEndYmd}`;
      const r = await sendMemberAlimtalkIfNeeded(supabase, {
        eventType: "trial_ends_3d",
        userId: u.id,
        phone,
        dedupeKey,
        guideUrls,
      });
      if (r.sent) trialEnds3dSent += 1;
    }

    if (!isPaidActive && !isTrialActive && freeEndYmd === today) {
      const dedupeKey = `trial_ended_unpaid:${u.id}:${freeEndYmd}`;
      const r = await sendMemberAlimtalkIfNeeded(supabase, {
        eventType: "trial_ended_unpaid",
        userId: u.id,
        phone,
        dedupeKey,
        guideUrls,
      });
      if (r.sent) trialEndedUnpaidSent += 1;
    }
  }

  const inv = await supabase
    .from("member_billing_invoices")
    .select("id, user_id, payment_status, usage_status, paid_at")
    .eq("payment_status", "error")
    .eq("usage_status", "suspended")
    .order("paid_at", { ascending: false })
    .limit(200);
  if (inv.error) {
    // 테이블이 없는 환경(마이그레이션 전)에서도 크론이 죽지 않게
    // (me/billing 라우트도 유사 패턴으로 방어함)
    return {
      usersChecked: rows.length,
      trialEnds3dSent,
      trialEndedUnpaidSent,
      paymentFailedSent,
    };
  }

  for (const r of inv.data ?? []) {
    const invoiceId = r.id as string;
    const userId = r.user_id as string;
    const { data: u } = await supabase
      .from("users")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    const phone = nonEmpty((u as { phone?: unknown } | null)?.phone);
    if (!phone) continue;

    const dedupeKey = `payment_failed:${invoiceId}`;
    const s = await sendMemberAlimtalkIfNeeded(supabase, {
      eventType: "payment_failed",
      userId,
      phone,
      dedupeKey,
      guideUrls,
    });
    if (s.sent) paymentFailedSent += 1;
  }

  return {
    usersChecked: rows.length,
    trialEnds3dSent,
    trialEndedUnpaidSent,
    paymentFailedSent,
  };
}

export async function sendDissatisfiedReviewAlimtalkIfNeeded(
  supabase: SupabaseClient,
  params: {
    userId: string;
    storeId: string;
    reviewId: string;
    phone: string;
    platformName: string;
    rating: string;
    content: string;
    authorNickname: string;
    writtenAtKst: string;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const dedupeKey = `dissatisfied_review:${params.reviewId}`;
  const { created, id } = await tryCreateNotificationEvent(supabase, {
    dedupeKey,
    eventType: "dissatisfied_review",
    userId: params.userId,
    storeId: params.storeId,
    reviewId: params.reviewId,
    recipientPhone: params.phone,
    meta: { platform: params.platformName, rating: params.rating },
  });
  if (!created || !id) return { sent: false, reason: "deduped" };

  const variables: Record<string, string> = {
    플랫폼명: params.platformName,
    별점: params.rating,
    리뷰내용: params.content,
    리뷰작성자닉네임: params.authorNickname,
    리뷰등록일시: params.writtenAtKst,
  };

  const guide = defaultBillingGuideUrls();
  const replyRegisterGuideUrl = guide.replyRegisterGuideUrl ?? appUrl();

  const buttons: CoolSmsAlimtalkButton[] = [
    {
      buttonType: "WL",
      buttonName: "리뷰 확인하기",
      linkMo: appUrl(),
      linkPc: appUrl(),
    },
    {
      buttonType: "WL",
      buttonName: "댓글 등록하기 사용가이드",
      linkMo: replyRegisterGuideUrl,
      linkPc: replyRegisterGuideUrl,
    },
  ];

  const r = await sendCoolSMSAlimTalk(
    params.phone,
    variables,
    buttons,
    "dissatisfied_review",
  );
  if (!r.ok) {
    await markNotificationEventError(supabase, id, r.error ?? "send_failed");
    return { sent: false, reason: "send_failed" };
  }
  await markNotificationEventSent(supabase, id);
  return { sent: true };
}

