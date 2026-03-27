"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { getAdminRealtimeJobs } from "@/entities/admin/api/store-api";
import type { AdminRealtimeJobRow } from "@/entities/admin/types";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";

const POLL_INTERVAL_MS = 5_000;

function isAdmin(profile: { is_admin?: boolean | null } | undefined): boolean {
  return Boolean(profile?.is_admin);
}

function toPercentLabel(v: number | null): string {
  if (v == null) return "—";
  return `${v}%`;
}

function toRemainingLabel(v: number | null): string {
  if (v == null) return "—";
  return `${v}분`;
}

export default function AdminRealtimeJobsPage() {
  const { data: profile, isLoading: profileLoading } = useAccountProfile();
  const [list, setList] = useState<AdminRealtimeJobRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const data = await getAdminRealtimeJobs({ limit: 120 });
      setList(data.list);
      setCount(data.count);
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "ADMIN_REQUIRED") setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin(profile)) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    void fetchList();
    const t = setInterval(() => {
      void fetchList();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [profileLoading, profile?.is_admin, fetchList]);

  if (profileLoading || loading) {
    return (
      <div className="">
        <p className="typo-body-02-regular text-gray-04">불러오는 중…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="">
        <h1 className="typo-heading-01-bold text-gray-01">실시간 작업 관리</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          관리자 권한이 필요합니다.
        </p>
      </div>
    );
  }

  const columns = [
    { id: "status", header: "상태" },
    { id: "platform", header: "플랫폼" },
    { id: "store", header: "매장" },
    { id: "user", header: "계정" },
    { id: "type", header: "작업 타입" },
    { id: "phase", header: "단계" },
    { id: "percent", header: "진행률" },
    { id: "remaining", header: "남은 시간(분)" },
    { id: "elapsed", header: "경과 시간(분)" },
  ];

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="typo-heading-01-bold text-gray-01">실시간 작업 관리</h1>
        <p className="mt-2 typo-body-02-regular text-gray-03">
          현재 처리 중인 작업의 진행률과 남은 시간을 실시간으로 확인합니다. (5초
          자동 갱신)
        </p>
      </div>
      <div className="mb-4">
        <span className="typo-body-03-regular text-gray-05">진행 중 작업</span>
        <p className="typo-body-02-bold text-gray-01">{count}건</p>
      </div>

      <DataTable<AdminRealtimeJobRow>
        columns={columns}
        data={list}
        getRowKey={(row) => row.id}
        renderCell={(row, colId) => {
          switch (colId) {
            case "status":
              return (
                <Badge variant={row.status === "processing" ? "default" : "outline"}>
                  {row.status}
                </Badge>
              );
            case "platform":
              return row.platformLabel ?? "—";
            case "store":
              return row.storeName ?? row.storeId ?? "—";
            case "user":
              return row.userEmail ?? "—";
            case "type":
              return row.type;
            case "phase":
              return row.phase ?? "—";
            case "percent":
              return toPercentLabel(row.progressPercent);
            case "remaining":
              return toRemainingLabel(row.remainingMinutes);
            case "elapsed":
              return toRemainingLabel(row.elapsedMinutes);
            default:
              return "—";
          }
        }}
        emptyMessage="진행 중인 작업이 없습니다."
      />
    </div>
  );
}
