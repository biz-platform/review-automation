import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  AdminCustomerListApiRequestData,
  AdminCustomerListData,
} from "@/entities/admin/types";

export type UpdateAdminCustomerRoleApiRequestData = {
  role: "center_manager" | "planner" | "member";
};

export type AdminSellerApplyApiRequestData = {
  dbtalk_id: string;
  name: string;
  phone: string;
};

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      message?: string;
      code?: string;
      title?: string;
    };
    const msg = err.detail ?? err.error ?? err.title ?? err.message ?? res.statusText;
    const e = new Error(msg) as Error & { code?: string };
    e.code = err.code ?? (res.status === 403 ? "ADMIN_REQUIRED" : undefined);
    throw e;
  }
  return res.json();
}

/** 어드민 고객 목록 조회 */
export const getAdminCustomers: AsyncApiRequestFn<
  AdminCustomerListData,
  AdminCustomerListApiRequestData
> = async (params) => {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  if (params?.keyword?.trim()) searchParams.set("keyword", params.keyword.trim());
  if (params?.memberType && params.memberType !== "all") {
    searchParams.set("memberType", params.memberType);
  }
  const url = `${API_ENDPOINT.admin.customers}?${searchParams.toString()}`;
  const data = await getJson<{ result: AdminCustomerListData }>(url);
  return data.result;
};

/** 어드민 고객 회원 유형 변경. 센터장으로 변경 시에만 is_seller=true */
export const updateAdminCustomerRole: AsyncApiRequestFn<
  { id: string; role: string; is_seller: boolean },
  { id: string } & UpdateAdminCustomerRoleApiRequestData
> = async ({ id, role }) => {
  const data = await getJson<{
    result: { id: string; role: string; is_seller: boolean };
  }>(API_ENDPOINT.admin.customer(id), {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  return data.result;
};

/** 어드민이 대상 고객에 대해 셀러 등록(디비톡 센터장 인증). 일반 셀러 신청과 동일 검증 */
export const applySellerForAdmin: AsyncApiRequestFn<
  { success: true },
  { id: string } & AdminSellerApplyApiRequestData
> = async ({ id, dbtalk_id, name, phone }) => {
  const data = await getJson<{ result: { success: true } }>(
    API_ENDPOINT.admin.customerSellerApply(id),
    {
      method: "POST",
      body: JSON.stringify({ dbtalk_id, name, phone }),
    },
  );
  return data.result ?? { success: true as const };
};
