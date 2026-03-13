"use client";

/**
 * /manage 하위 공통 레이아웃.
 * TabLine은 섹션마다 다름 (댓글 관리=플랫폼 탭, AI 댓글 설정=우리 가게 맞춤 AI|댓글 등록…, 매장 관리=플랫폼 연동 탭)
 * → 각 페이지에서 자체 TabLine 렌더.
 */
export function ManageLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
