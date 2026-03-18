import { AppShellClient } from "./AppShellClient";

/**
 * 메인 앱 쉘: GNB + SNB(데스크톱) + 콘텐츠 영역(.layout-content).
 * (protected) 레이아웃에서만 사용. manage 이하 공통.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppShellClient>{children}</AppShellClient>;
}
