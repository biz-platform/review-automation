"use client";

import type { ComponentProps } from "react";
import {
  ManageDashboardShellNav,
  type ManageDashboardShellTabDef,
} from "@/app/(protected)/manage/_components/ManageDashboardShellNav";

export type StoreDashboardShellTabDef = ManageDashboardShellTabDef;

type Props = Omit<ComponentProps<typeof ManageDashboardShellNav>, "variant">;

export function StoreDashboardShellNav(props: Props) {
  return <ManageDashboardShellNav {...props} variant="admin" />;
}
