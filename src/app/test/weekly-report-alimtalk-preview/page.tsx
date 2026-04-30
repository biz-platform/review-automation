import type { Metadata } from "next";
import { WeeklyStoreReportCard } from "@/components/report/WeeklyStoreReportCard";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getPublicSiteOrigin } from "@/lib/config/public-site";
import { OLIVIEW_ALIMTALK_PUBLIC_WEB_URL } from "@/lib/constants/coolsms-alimtalk";
import {
  buildWeeklyStoreReportData,
  previousWeekRangeFromNowKst,
} from "@/lib/reports/weekly-store-report";
import {
  buildWeeklyReportImageUrl,
  buildWeeklyReportPublicViewUrl,
} from "@/lib/reports/weekly-report-image-signature";
import { addCalendarDaysKst } from "@/lib/utils/kst-date";

const DEFAULT_PREVIEW_EMAIL = "bizplatformofficial@gmail.com";

export const metadata: Metadata = {
  title: "주간 리포트 알림톡 미리보기",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    email?: string;
    storeId?: string;
    weekStart?: string;
  }>;
};

export default async function WeeklyReportAlimtalkPreviewPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const email = (sp.email?.trim() || DEFAULT_PREVIEW_EMAIL).toLowerCase();
  const supabase = createServiceRoleClient();

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, phone, email")
    .eq("email", email)
    .maybeSingle();
  if (userErr) throw userErr;

  if (!userRow?.id) {
    return (
      <main className="mx-auto max-w-lg px-5 py-10 text-gray-02">
        <p className="typo-body-02-regular">
          <code className="rounded bg-gray-08 px-1 py-0.5 text-[12px]">{email}</code>
          에 해당하는 users 행이 없습니다.
        </p>
        <p className="typo-body-03-regular mt-3 text-gray-03">
          ?email= 다른 주소로 시도하거나, 해당 계정으로 회원가입·DB 동기화를 확인하세요.
        </p>
      </main>
    );
  }

  let storeId = sp.storeId?.trim() ?? "";
  if (!storeId) {
    const { data: storeRow, error: storeErr } = await supabase
      .from("stores")
      .select("id, name")
      .eq("user_id", userRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (storeErr) throw storeErr;
    storeId = storeRow?.id ?? "";
  }

  if (!storeId) {
    return (
      <main className="mx-auto max-w-lg px-5 py-10 text-gray-02">
        <p className="typo-body-02-regular">이 사용자에게 연결된 매장(stores)이 없습니다.</p>
        <p className="typo-body-03-regular mt-3 text-gray-03">
          ?storeId=매장UUID 로 직접 지정할 수 있어요.
        </p>
      </main>
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

  const localOrigin = getPublicSiteOrigin().replace(/\/+$/, "");
  const localReportViewUrl = buildWeeklyReportPublicViewUrl({
    publicBaseUrl: localOrigin,
    storeId,
    weekStartYmd,
  });
  const localReportImageUrl = buildWeeklyReportImageUrl({
    publicBaseUrl: localOrigin,
    storeId,
    weekStartYmd,
  });

  const prodAlimtalkOrigin = OLIVIEW_ALIMTALK_PUBLIC_WEB_URL.replace(/\/+$/, "");
  const prodReportViewUrl = buildWeeklyReportPublicViewUrl({
    publicBaseUrl: prodAlimtalkOrigin,
    storeId,
    weekStartYmd,
  });
  const prodReportImageUrl = buildWeeklyReportImageUrl({
    publicBaseUrl: prodAlimtalkOrigin,
    storeId,
    weekStartYmd,
  });

  const dashboardUrl = `${localOrigin}/manage/dashboard/summary`;

  const metaLine = [
    `email=${email}`,
    `store=${storeId.slice(0, 8)}…`,
    `weekStart=${weekStartYmd}`,
  ].join(" · ");

  return (
    <div className="min-h-screen bg-gray-07 py-8">
      <p className="mx-auto mb-2 max-w-[400px] px-5 text-[11px] text-gray-03">{metaLine}</p>
      {userRow.phone ? (
        <p className="mx-auto mb-4 max-w-[400px] px-5 text-[11px] text-gray-03">
          알림톡 수신번호(DB): {String(userRow.phone)}
        </p>
      ) : (
        <p className="mx-auto mb-4 max-w-[400px] px-5 text-[11px] text-amber-700">
          users.phone 비어 있으면 실제 알림톡 미발송
        </p>
      )}

      <WeeklyStoreReportCard data={report} />

      <details className="mx-auto mt-8 max-w-[400px] px-5">
        <summary className="cursor-pointer text-[12px] text-gray-03 underline decoration-gray-05">
          알림톡·메일에 실리는 URL 참고
        </summary>
        <div className="mt-3 space-y-3 rounded border border-gray-06 bg-white p-3 text-[11px] text-gray-02">
          <p>
            <span className="font-medium text-gray-01">로컬 HTML (「리포트 확인하기」와 동일 형식)</span>
            <br />
            <a href={localReportViewUrl} className="break-all text-blue-600 underline" target="_blank" rel="noreferrer">
              {localReportViewUrl}
            </a>
          </p>
          <p>
            <span className="font-medium text-gray-01">발송 시 고정 호스트 HTML</span>
            <br />
            <a href={prodReportViewUrl} className="break-all text-blue-600 underline" target="_blank" rel="noreferrer">
              {prodReportViewUrl}
            </a>
          </p>
          <p>
            <span className="font-medium text-gray-01">메일용 PNG API (선택)</span>
            <br />
            <a href={localReportImageUrl} className="break-all text-blue-600 underline" target="_blank" rel="noreferrer">
              {localReportImageUrl}
            </a>
          </p>
          <p>
            <span className="font-medium text-gray-01">프로덕션 PNG API</span>
            <br />
            <a href={prodReportImageUrl} className="break-all text-blue-600 underline" target="_blank" rel="noreferrer">
              {prodReportImageUrl}
            </a>
          </p>
          <p>
            <span className="font-medium text-gray-01">매장별 정보 (로컬)</span>
            <br />
            <a href={dashboardUrl} className="break-all text-blue-600 underline" target="_blank" rel="noreferrer">
              {dashboardUrl}
            </a>
          </p>
        </div>
      </details>
    </div>
  );
}
