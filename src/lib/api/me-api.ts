import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export type MeProfileData = { email: string | null; phone: string | null };

export type MeOnboardingData = {
  hasStores: boolean;
  aiSettingsCompleted: boolean;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();
  return data.result as T;
}

export const getMeProfile: AsyncApiRequestFn<MeProfileData, void> = async () => {
  return getJson<MeProfileData>(API_ENDPOINT.me);
};

export const getMeOnboarding: AsyncApiRequestFn<MeOnboardingData, void> = async () => {
  return getJson<MeOnboardingData>(API_ENDPOINT.meOnboarding);
};
