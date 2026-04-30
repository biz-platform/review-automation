import type { Metadata } from "next";
import { WeeklyStoreReportCard } from "@/components/report/WeeklyStoreReportCard";
import { ButtonLink } from "@/components/ui/button";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  buildWeeklyStoreReportData,
  previousWeekRangeFromNowKst,
} from "@/lib/reports/weekly-store-report";
import { verifyWeeklyReportImageSignature } from "@/lib/reports/weekly-report-image-signature";
import { addCalendarDaysKst } from "@/lib/utils/kst-date";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "주간 매장 리포트",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ weekStart?: string; ts?: string; sig?: string }>;
};

export default async function WeeklyStoreReportPublicPage({ params, searchParams }: PageProps) {
  const { storeId } = await params;
  const sp = await searchParams;
  const weekStartQ = sp.weekStart?.trim();
  const ts = sp.ts ?? "";
  const sig = sp.sig ?? "";
  const now = new Date();

  const defaultRange = previousWeekRangeFromNowKst(now);
  const weekStartYmd = weekStartQ || defaultRange.weekStartYmd;

  if (!verifyWeeklyReportImageSignature({ storeId, weekStartYmd, ts, sig })) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-08 px-5 text-center typo-body-02-regular text-gray-02">
        <p>링크가 만료되었거나 유효하지 않습니다.</p>
      </main>
    );
  }

  const weekEndYmd = addCalendarDaysKst(weekStartYmd, 6);
  const prevWeekStartYmd = addCalendarDaysKst(weekStartYmd, -7);
  const prevWeekEndYmd = addCalendarDaysKst(weekEndYmd, -7);

  const supabase = createServiceRoleClient();
  const report = await buildWeeklyStoreReportData(supabase, {
    storeId,
    weekStartYmd,
    weekEndYmd,
    prevWeekStartYmd,
    prevWeekEndYmd,
  });

  return (
    <div className="min-h-screen bg-gray-07 py-8">
      <WeeklyStoreReportCard data={report} />
      <div className="mx-auto mt-6 w-[360px] max-w-[calc(100vw-40px)]">
        <ButtonLink href="/manage/dashboard/summary" variant="primary" size="lg" fullWidth>
          내 매장 대시보드 확인
        </ButtonLink>
      </div>
    </div>
  );
}
