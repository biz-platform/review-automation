import Link from "next/link";
import { GNB } from "@/components/layout/GNB";

/**
 * 메인 앱 쉘: GNB + LNB + 콘텐츠 영역(.layout-content).
 * (protected) 레이아웃에서만 사용. 로그인/회원가입은 (auth) 레이아웃에서 GNB(public) 사용.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <GNB variant="authenticated" />

      <div className="flex flex-1 min-h-0">
        {/* LNB: 1280~1920 동일 280px */}
        <aside className="w-lnb shrink-0 border-r border-border bg-white">
          <nav className="flex flex-col gap-1 p-4">
            <Link
              href="/manage/stores"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-01 hover:bg-gray-08"
            >
              매장 관리
            </Link>
            <Link
              href="/manage/reviews/manage"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-01 hover:bg-gray-08"
            >
              리뷰 관리
            </Link>
          </nav>
        </aside>

        {/* 콘텐츠: 가변 폭 1070~1550 + 패딩 상32 하80 좌50 우40 */}
        <main className="min-h-0 flex-1 overflow-auto bg-gray-08">
          <div className="layout-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
