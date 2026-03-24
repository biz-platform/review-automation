"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { LinkedStoreCard } from "@/components/store/LinkedStoreCard";
import { PlatformIcon } from "@/components/store/PlatformIcon";
import type { StoreWithSessionData } from "@/entities/store/types";

export interface StoresLinkedViewProps {
  platform: string;
  platformLabel: string;
  linkedStores: { id: string; name: string }[];
  onLogout?: (storeId: string, platform: string) => void | Promise<void>;
  logoutLoading?: boolean;
}

const changeStoreText = `다른 매장으로 변경하려면 
    연동해제 후 해당 플랫폼 로그인 정보를 다시 입력해 주세요.`;

/** 모바일 전용: 연동 완료 + 매장 목록 (Figma P-03) */
export function StoresLinkedViewMobile({
  platform,
  platformLabel,
  linkedStores,
  onLogout,
  logoutLoading,
}: StoresLinkedViewProps) {
  const firstStore = linkedStores[0];
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1DA6A2] bg-white">
          <PlatformIcon platform={platform} />
        </div>
        <h2 className="typo-heading-02-bold text-gray-01">
          {platformLabel} 매장 연동 완료
        </h2>
      </div>
      <p className="typo-body-02-regular mt-4 text-gray-04">
        연결된 매장의 리뷰 관리를 시작할 수 있어요
      </p>
      <p className="typo-body-02-regular mt-1 text-gray-04 whitespace-pre-line">
        {changeStoreText}
      </p>
      <div className="mt-6 flex gap-2">
        <ButtonLink
          href={`/manage/stores?platform=${platform}`}
          variant="secondaryDark"
          size="lg"
          className="h-[38px] min-w-0 flex-1 rounded-lg justify-center"
        >
          업데이트
        </ButtonLink>
        {firstStore && onLogout && (
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="h-[38px] min-w-0 flex-1 rounded-lg justify-center"
            disabled={logoutLoading}
            onClick={() => onLogout(firstStore.id, platform)}
          >
            {logoutLoading ? "해제 중…" : "연동해제"}
          </Button>
        )}
      </div>
      <div
        className="my-4 h-4 w-screen max-w-none relative left-1/2 -translate-x-1/2 bg-gray-08 md:relative md:left-0 md:translate-x-0 md:w-full"
        aria-hidden
      />
      <div className="flex flex-col gap-4">
        {linkedStores.map((store) => {
          const s = store as StoreWithSessionData;
          return (
            <LinkedStoreCard
              key={store.id}
              storeName={s.store_name ?? store.name}
              externalShopId={s.external_shop_id ?? null}
              shopCategory={s.shop_category ?? null}
              businessRegistrationNumber={s.business_registration_number ?? null}
            />
          );
        })}
      </div>
    </>
  );
}

/** 데스크톱: 연동 완료 헤더 + 연동해제 + 카드 그리드 */
export function StoresLinkedCard({
  platform,
  platformLabel,
  linkedStores,
  onLogout,
  logoutLoading,
}: StoresLinkedViewProps) {
  const firstStore = linkedStores[0];
  return (
    <div className="flex flex-row items-end justify-between gap-4 mb-10">
      <div>
        <h2 className="typo-heading-02-bold mb-2 text-gray-01">
          {platformLabel} 매장 연동 완료
        </h2>
        <p className="typo-body-02-regular mb-1 text-gray-04">
          연결된 매장의 리뷰 관리를 시작할 수 있어요.
        </p>
        <p className="typo-body-02-regular text-gray-05">
          다른 매장으로 변경하려면 연동해제 후 해당 플랫폼 로그인 정보를 다시
          입력해 주세요
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <ButtonLink
          href={`/manage/stores?platform=${platform}`}
          variant="secondaryDark"
          size="md"
        >
          업데이트
        </ButtonLink>
        {firstStore && onLogout && (
          <Button
            type="button"
            variant="destructive"
            size="md"
            disabled={logoutLoading}
            onClick={() => onLogout(firstStore.id, platform)}
          >
            {logoutLoading ? "해제 중…" : "연동해제"}
          </Button>
        )}
      </div>
    </div>
  );
}
