import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  DashboardGlanceApiRequestData,
  DashboardGlanceData,
} from "@/entities/dashboard/types";
import type {
  DashboardSalesApiRequestData,
  DashboardSalesData,
} from "@/entities/dashboard/sales-types";

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      detail?: string;
      error?: string;
      title?: string;
      message?: string;
      code?: string;
    };
    const msg =
      err.detail ?? err.error ?? err.title ?? err.message ?? res.statusText;
    const e = new Error(msg) as Error & { code?: string };
    e.code = err.code;
    throw e;
  }
  return res.json();
}

export const getDashboardGlance: AsyncApiRequestFn<
  DashboardGlanceData,
  DashboardGlanceApiRequestData
> = async ({ storeId, range, platform }) => {
  const searchParams = new URLSearchParams();
  searchParams.set("storeId", storeId);
  searchParams.set("range", range);
  if (platform?.trim()) searchParams.set("platform", platform.trim());
  const url = `${API_ENDPOINT.dashboard.glance}?${searchParams.toString()}`;
  const data = await getJson<{ result: DashboardGlanceData }>(url);
  return data.result;
};

export const getDashboardSales: AsyncApiRequestFn<
  DashboardSalesData,
  DashboardSalesApiRequestData
> = async ({ storeId, range, platform }) => {
  const searchParams = new URLSearchParams();
  searchParams.set("storeId", storeId);
  searchParams.set("range", range);
  if (platform?.trim()) searchParams.set("platform", platform.trim());
  const url = `${API_ENDPOINT.dashboard.sales}?${searchParams.toString()}`;
  const data = await getJson<{ result: DashboardSalesData }>(url);
  return data.result;
};

