import { redirect } from "next/navigation";

export default function StoreDashboardIndexPage() {
  redirect("/manage/admin/store-dashboard/summary");
}
