import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationEventStatus = "pending" | "sent" | "error";

export type CreateNotificationEventParams = {
  dedupeKey: string;
  eventType:
    | "trial_ends_3d"
    | "trial_ended_unpaid"
    | "payment_failed"
    | "dissatisfied_review"
    | "weekly_store_report"
    | "weekly_store_report_alimtalk";
  userId?: string | null;
  storeId?: string | null;
  reviewId?: string | null;
  invoiceId?: string | null;
  recipientPhone?: string | null;
  meta?: Record<string, unknown>;
};

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export async function tryCreateNotificationEvent(
  supabase: SupabaseClient,
  params: CreateNotificationEventParams,
): Promise<{ created: boolean; id?: string }> {
  const insert = await supabase
    .from("notification_events")
    .insert({
      dedupe_key: params.dedupeKey,
      event_type: params.eventType,
      status: "pending" satisfies NotificationEventStatus,
      user_id: params.userId ?? null,
      store_id: params.storeId ?? null,
      review_id: params.reviewId ?? null,
      invoice_id: params.invoiceId ?? null,
      recipient_phone: params.recipientPhone ?? null,
      meta: params.meta ?? {},
    })
    .select("id")
    .maybeSingle();

  if (insert.error) {
    if (isPgUniqueViolation(insert.error)) return { created: false };
    throw insert.error;
  }
  const id = (insert.data?.id as string | undefined) ?? undefined;
  return { created: Boolean(id), id };
}

export async function markNotificationEventSent(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("notification_events")
    .update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
    .eq("id", id);
  if (error) throw error;
}

export async function markNotificationEventError(
  supabase: SupabaseClient,
  id: string,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("notification_events")
    .update({ status: "error", error_message: message })
    .eq("id", id);
  if (error) throw error;
}

