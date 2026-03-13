import { GNB } from "@/components/layout/GNB";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

/**
 * 로그인/회원가입 등 공개 페이지용 레이아웃. GNB + children.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <GNB />
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
}
