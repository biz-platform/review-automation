import type { Metadata } from "next";
import { WeeklyStoreReportCard } from "@/components/report/WeeklyStoreReportCard";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  buildWeeklyStoreReportData,
  previousWeekRangeFromNowKst,
} from "@/lib/reports/weekly-store-report";
import { addCalendarDaysKst } from "@/lib/utils/kst-date";

export const metadata: Metadata = {
  title: "주간 리포트 카드 테스트",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ storeId?: string; weekStart?: string }>;
};

export default async function WeeklyReportTestPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const supabase = createServiceRoleClient();

  let storeId = sp.storeId?.trim() ?? "";
  if (!storeId) {
    const { data: row, error } = await supabase
      .from("stores")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    storeId = row?.id ?? "";
  }

  if (!storeId) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-gray-02">
        <p className="typo-body-02-regular">stores에 매장이 없어요.</p>
        <p className="mt-2 text-[12px] text-gray-03">
          ?storeId=매장UUID 로 지정할 수 있어요.
        </p>
      </div>
    );
  }

  const defaultRange = previousWeekRangeFromNowKst(new Date());
  const weekStartYmd = sp.weekStart?.trim() || defaultRange.weekStartYmd;
  const weekEndYmd = addCalendarDaysKst(weekStartYmd, 6);
  const prevWeekStartYmd = addCalendarDaysKst(weekStartYmd, -7);
  const prevWeekEndYmd = addCalendarDaysKst(weekEndYmd, -7);

  const report = await buildWeeklyStoreReportData(supabase, {
    storeId,
    weekStartYmd,
    weekEndYmd,
    prevWeekStartYmd,
    prevWeekEndYmd,
  });

  return (
    <div className="min-h-screen bg-gray-07 py-8">
      <p className="mx-auto mb-4 max-w-[400px] px-5 text-[11px] text-gray-03">
        storeId={storeId.slice(0, 8)}… · weekStart={weekStartYmd}
      </p>
      <WeeklyStoreReportCard data={report} />
    </div>
  );
}
