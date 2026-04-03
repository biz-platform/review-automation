import { redirect } from "next/navigation";

export default function DashboardIndexPage() {
  redirect("/manage/dashboard/summary");
}

