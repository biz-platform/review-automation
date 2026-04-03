"use client";

import { createContext, useContext } from "react";
import type { StoreWithSessionData } from "@/entities/store/types";

export type AdminDashboardPlatformStoresValue = {
  loading: boolean;
  storesBaemin: StoreWithSessionData[];
  storesCoupangEats: StoreWithSessionData[];
  storesDdangyo: StoreWithSessionData[];
  storesYogiyo: StoreWithSessionData[];
};

const defaultValue: AdminDashboardPlatformStoresValue = {
  loading: true,
  storesBaemin: [],
  storesCoupangEats: [],
  storesDdangyo: [],
  storesYogiyo: [],
};

const AdminDashboardPlatformStoresContext =
  createContext<AdminDashboardPlatformStoresValue>(defaultValue);

export function AdminDashboardPlatformStoresProvider({
  value,
  children,
}: {
  value: AdminDashboardPlatformStoresValue;
  children: React.ReactNode;
}) {
  return (
    <AdminDashboardPlatformStoresContext.Provider value={value}>
      {children}
    </AdminDashboardPlatformStoresContext.Provider>
  );
}

export function useAdminDashboardPlatformStores() {
  return useContext(AdminDashboardPlatformStoresContext);
}
