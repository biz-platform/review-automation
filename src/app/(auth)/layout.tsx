import { GNB } from "@/components/layout/GNB";

/**
 * 로그인/회원가입 등 비로그인 공개 페이지용 레이아웃.
 * GNB(public) 상단 고정 + children.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <GNB variant="public" />
      {children}
    </div>
  );
}
