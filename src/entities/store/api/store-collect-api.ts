import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export const collectStoreReviews: AsyncApiRequestFn<
  { collected: number },
  { storeId: string }
> = async ({ storeId }) => {
  const res = await fetch(API_ENDPOINT.stores.collect(storeId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.message ?? res.statusText);
  }
  const data = await res.json();
  return data.result;
};
