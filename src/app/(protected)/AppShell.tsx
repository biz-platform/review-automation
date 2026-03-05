import Link from "next/link";
import { SignOutButton } from "@/components/shared/SignOutButton";

/**
 * 메인 앱 쉘: GNB + LNB + 콘텐츠 영역(.layout-content).
 * (protected) 레이아웃에서만 사용. 로그인/회원가입 등은 이 레이아웃 밖에 두면 됨.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* GNB */}
      <header className="h-20 shrink-0 border-b border-border bg-gray-01 px-4">
        <nav className="flex h-full items-center gap-4">
          <Link href="/stores" className="font-medium text-white hover:opacity-90">
            매장 관리
          </Link>
          <Link
            href="/reviews/manage"
            className="font-medium text-white hover:opacity-90"
          >
            리뷰 관리
          </Link>
          <Link href="/" className="text-white/80 hover:text-white">
            홈
          </Link>
          <span className="ml-auto [&_button]:text-white/80 [&_button]:hover:text-white [&_button]:no-underline">
            <SignOutButton />
          </span>
        </nav>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* LNB: 1280~1920 동일 280px */}
        <aside className="w-lnb shrink-0 border-r border-border bg-white">
          <nav className="flex flex-col gap-1 p-4">
            <Link
              href="/stores"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-01 hover:bg-gray-08"
            >
              매장 관리
            </Link>
            <Link
              href="/reviews/manage"
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
