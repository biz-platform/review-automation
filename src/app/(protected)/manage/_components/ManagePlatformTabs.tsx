"use client";

import { ManageSectionTabLine } from "@/app/(protected)/manage/ManageSectionTabLine";
import {
  STORE_MANAGE_PLATFORM_TABS,
  STORE_MANAGE_PLATFORM_TABS_MOBILE,
} from "@/const/platform";
import { LinkedPlatformCheckIcon } from "@/components/ui/icons";

export type ManagePlatformTabsProps = {
  /** 현재 선택된 플랫폼 값 ("" 포함 가능) */
  value: string;
  onValueChange: (value: string) => void;
  /** "전체 플랫폼" 탭을 포함할지 */
  includeAll?: boolean;
  /** 연동된 플랫폼 목록 (없으면 disabled/icon 처리 생략) */
  linkedPlatforms?: readonly string[];
  /** 연동 안 된 플랫폼을 disabled 처리할지 */
  disableUnlinked?: boolean;
};

export function ManagePlatformTabs({
  value,
  onValueChange,
  includeAll = false,
  linkedPlatforms,
  disableUnlinked = false,
}: ManagePlatformTabsProps) {
  const isLinked = (platform: string) =>
    linkedPlatforms ? linkedPlatforms.includes(platform) : false;

  const desktopItems = [
    ...(includeAll ? [{ value: "", label: "전체 플랫폼" }] : []),
    ...STORE_MANAGE_PLATFORM_TABS.map((t) => {
      const linked = linkedPlatforms ? isLinked(t.value) : false;
      return {
        value: t.value,
        label: t.label,
        disabled: disableUnlinked && linkedPlatforms ? !linked : false,
        icon: linked ? <LinkedPlatformCheckIcon /> : undefined,
      };
    }),
  ];

  const mobileItems = [
    ...(includeAll ? [{ value: "", label: "전체" }] : []),
    ...STORE_MANAGE_PLATFORM_TABS.map((t) => {
      const short = STORE_MANAGE_PLATFORM_TABS_MOBILE.find(
        (m) => m.value === t.value,
      );
      const linked = linkedPlatforms ? isLinked(t.value) : false;
      return {
        value: t.value,
        label: short?.label ?? t.label,
        disabled: disableUnlinked && linkedPlatforms ? !linked : false,
        icon: linked ? <LinkedPlatformCheckIcon /> : undefined,
      };
    }),
  ];

  return (
    <ManageSectionTabLine
      items={desktopItems}
      itemsMobile={mobileItems}
      value={value}
      onValueChange={onValueChange}
    />
  );
}

