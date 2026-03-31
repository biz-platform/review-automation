import { redirect } from "next/navigation";

/**
 * 임시 숨김: AdminSNB·모바일 어드민 메뉴에서 링크 제거됨.
 * 복구: 이 파일을 `import RealtimeJobsPageClient from "./RealtimeJobsPage.client"; export default RealtimeJobsPageClient;` 로 교체.
 */
export default function AdminRealtimeJobsPage() {
  redirect("/manage/admin/customers");
}
