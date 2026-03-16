import { GNB } from "@/components/layout/GNB";
import { SNB } from "@/components/layout/SNB";

/**
 * 메인 앱 쉘: GNB + SNB(데스크톱) + 콘텐츠 영역(.layout-content).
 * (protected) 레이아웃에서만 사용. manage 이하 공통.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <GNB />

      <div className="flex flex-1 min-h-0">
        <SNB />

        {/* 콘텐츠: 1024px 미만 p-4, 1024px 이상 layout-content(가변 폭 1070~1550, 패딩 상32 하80 좌50 우40) */}
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-white">
          <div
            className={
              "min-w-0 p-4 lg:w-[var(--layout-content-width)] lg:p-0 lg:pt-[var(--layout-content-padding-top)] lg:pb-[var(--layout-content-padding-bottom)] lg:pl-[var(--layout-content-padding-left)] lg:pr-[var(--layout-content-padding-right)]"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
