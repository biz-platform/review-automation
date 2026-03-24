"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import type { StoreWithSessionData } from "@/entities/store/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  STORE_MANAGE_PLATFORM_TABS,
  STORE_MANAGE_PLATFORM_TABS_MOBILE,
  PLATFORM_LABEL,
} from "@/const/platform";
import {
  PLATFORM_LINK_CONFIG,
  STORE_PAGE_DESCRIPTION_LINES,
} from "@/const/platform-link-config";
import { QUERY_KEY } from "@/const/query-keys";
import { Card } from "@/components/ui/card";
import { ManageSectionTabLine } from "@/app/(protected)/manage/ManageSectionTabLine";
import { Button, ButtonLink } from "@/components/ui/button";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { PlatformLinkForm } from "@/components/store/PlatformLinkForm";
import { StoreLinkProgressModal } from "@/components/store/StoreLinkProgressModal";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { AlertModal } from "@/components/shared/AlertModal";
import { LinkedStoreCard } from "@/components/store/LinkedStoreCard";
import {
  StoresLinkedViewMobile,
  StoresLinkedCard,
} from "@/components/store/StoresLinkedView";
import { StoresUnlinkedView } from "@/components/store/StoresUnlinkedView";
import { LinkedPlatformCheckIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { linkPlatform } from "@/lib/store/link-platform";
import { API_ENDPOINT } from "@/const/endpoint";

const DEFAULT_PLATFORM = "baemin";
const VALID_PLATFORMS: string[] = STORE_MANAGE_PLATFORM_TABS.map(
  (t) => t.value,
);

const MOBILE_BREAKPOINT = 1024;

export function StoresPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const platformParam = searchParams.get("platform") ?? "";
  const platform = VALID_PLATFORMS.includes(platformParam)
    ? platformParam
    : DEFAULT_PLATFORM;

  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobileView(mq.matches);
    const onChange = () => setIsMobileView(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const { data: allStores = [], isLoading, error } = useStoreList();
  const { data: linkedStores = [] } = useStoreList(platform);
  const { data: linkedBaemin = [] } = useStoreList("baemin");
  const { data: linkedCoupangEats = [] } = useStoreList("coupang_eats");
  const { data: linkedDdangyo = [] } = useStoreList("ddangyo");
  const { data: linkedYogiyo = [] } = useStoreList("yogiyo");

  const linkedByPlatform: Record<string, unknown[]> = {
    baemin: linkedBaemin,
    coupang_eats: linkedCoupangEats,
    ddangyo: linkedDdangyo,
    yogiyo: linkedYogiyo,
  };

  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [showLinkSuccessModal, setShowLinkSuccessModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<{
    storeId: string;
    platformKey: string;
  } | null>(null);
  const linkAbortRef = useRef<AbortController | null>(null);

  const setPlatformTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("platform", value);
      router.replace(`/manage/stores?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const isPlatformLinked = linkedStores.length > 0;

  useEffect(() => {
    if (allStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(allStores[0].id);
    }
    if (allStores.length === 0) {
      setSelectedStoreId("");
    }
  }, [allStores, selectedStoreId]);

  useEffect(() => {
    if (!linking) linkAbortRef.current = null;
  }, [linking]);

  useEffect(() => {
    if (!linking) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [linking]);

  const handleLink = useCallback(async () => {
    if (!username.trim() || !password) {
      setLinkError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    setLinkError(null);
    setLinkSuccess(false);
    setLinking(true);
    linkAbortRef.current = new AbortController();

    try {
      const storeId =
        allStores.length === 0 ? null : selectedStoreId || allStores[0]?.id;
      await linkPlatform(
        storeId ?? null,
        platform,
        username.trim(),
        password,
        linkAbortRef.current.signal,
      );
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEY.store.listLinked(platform),
      });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEY.me.onboarding,
      });
      setLinkSuccess(true);
      setShowLinkSuccessModal(true);
      setPassword("");
    } catch (e) {
      setLinkSuccess(false);
      if ((e as Error)?.name !== "AbortError") {
        setLinkError(e instanceof Error ? e.message : "연동에 실패했습니다.");
      }
    } finally {
      setLinking(false);
    }
  }, [selectedStoreId, platform, username, password, allStores, queryClient]);

  const handleLogout = useCallback(
    async (storeId: string, platformKey: string) => {
      setLogoutLoading(true);
      setLinkError(null);
      try {
        const res = await fetch(
          API_ENDPOINT.stores.platformSession(storeId, platformKey),
          { method: "DELETE", credentials: "same-origin" },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error ?? "연동 해제에 실패했습니다.",
          );
        }
        setLinkSuccess(false);
        setShowLinkSuccessModal(false);
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
        await queryClient.invalidateQueries({
          queryKey: QUERY_KEY.store.listLinked(platformKey),
        });
        await queryClient.invalidateQueries({
          queryKey: QUERY_KEY.me.onboarding,
        });
      } catch (e) {
        setLinkError(
          e instanceof Error ? e.message : "연동 해제에 실패했습니다.",
        );
      } finally {
        setLogoutLoading(false);
      }
    },
    [queryClient],
  );

  const handleRequestUnlink = useCallback(
    (storeId: string, platformKey: string) => {
      setConfirmUnlink({ storeId, platformKey });
    },
    [],
  );

  const handleConfirmUnlink = useCallback(async () => {
    if (!confirmUnlink) return;
    await handleLogout(confirmUnlink.storeId, confirmUnlink.platformKey);
    setConfirmUnlink(null);
  }, [confirmUnlink, handleLogout]);

  if (isLoading) {
    return <ContentStateMessage variant="loading" />;
  }
  if (error) {
    return (
      <ContentStateMessage variant="error" message={`오류: ${String(error)}`} />
    );
  }

  const config = PLATFORM_LINK_CONFIG[platform];
  const accountsMode = searchParams.get("accounts") === "1";
  const platformFromQuery = searchParams.get("platform") ?? "";
  const descriptionLines = STORE_PAGE_DESCRIPTION_LINES[platform] ?? [
    config?.description ?? "",
    "",
  ];

  const tabItems = STORE_MANAGE_PLATFORM_TABS.map((t) => ({
    value: t.value,
    label: t.label,
    icon:
      (linkedByPlatform[t.value]?.length ?? 0) > 0 ? (
        <LinkedPlatformCheckIcon />
      ) : undefined,
  }));
  const tabItemsMobile = STORE_MANAGE_PLATFORM_TABS_MOBILE.map((t) => ({
    value: t.value,
    label: t.label,
    icon:
      (linkedByPlatform[t.value]?.length ?? 0) > 0 ? (
        <LinkedPlatformCheckIcon />
      ) : undefined,
  }));

  return (
    <div className="flex flex-col">
      {/* 매장 관리: 플랫폼 연동 탭 — 스타일 공통화 */}
      <ManageSectionTabLine
        items={tabItems}
        itemsMobile={tabItemsMobile}
        value={platform}
        onValueChange={setPlatformTab}
      />
      <div className="pt-10">
        {!config ? (
          <p className="typo-body-02-regular text-gray-04">
            선택한 플랫폼 연동은 준비 중입니다.
          </p>
        ) : isPlatformLinked ? (
          <>
            {/* 모바일 전용: 데스크톱에서는 DOM에 넣지 않아 빈 공간 방지 */}
            {isMobileView && (
              <div className="flex flex-col pb-24">
                <StoresLinkedViewMobile
                  platform={platform}
                  platformLabel={PLATFORM_LABEL[platform]}
                  linkedStores={linkedStores}
                  onLogout={handleRequestUnlink}
                  logoutLoading={logoutLoading}
                />
              </div>
            )}
            {/* 데스크톱 전용 */}
            {!isMobileView && (
              <div className="pb-[108px]">
                <StoresLinkedCard
                  platform={platform}
                  platformLabel={PLATFORM_LABEL[platform]}
                  linkedStores={linkedStores}
                  onLogout={handleRequestUnlink}
                  logoutLoading={logoutLoading}
                />
                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  {linkedStores.map((store) => {
                    const s = store as StoreWithSessionData;
                    return (
                      <LinkedStoreCard
                        key={store.id}
                        storeName={s.store_name ?? store.name}
                        externalShopId={s.external_shop_id ?? null}
                        shopCategory={s.shop_category ?? null}
                        businessRegistrationNumber={
                          s.business_registration_number ?? null
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}
            <PageFixedBottomBar className="w-full px-4 md:pr-15 justify-center md:justify-end">
              <ButtonLink
                href="/manage/reviews"
                variant="primary"
                size="lg"
                className="h-[52px] w-full rounded-lg outline-main-02 hover:opacity-90 md:w-auto p-4"
              >
                리뷰 관리하기
              </ButtonLink>
            </PageFixedBottomBar>
          </>
        ) : (
          <StoresUnlinkedView
            platform={platform}
            platformLabel={PLATFORM_LABEL[platform]}
            descriptionLines={descriptionLines}
            username={username}
            onUsernameChange={setUsername}
            password={password}
            onPasswordChange={setPassword}
            linkError={linkError}
            onLink={handleLink}
            linking={linking}
          />
        )}

        {linking ? (
          <StoreLinkProgressModal
            show
            platformLabel={PLATFORM_LABEL[platform] ?? "매장"}
          />
        ) : null}

        <AlertModal
          show={!!linkError}
          title={
            linkError?.includes("이미 다른 계정에 연동된")
              ? "연동 불가"
              : "연동 실패"
          }
          message={linkError ?? ""}
          onConfirm={() => setLinkError(null)}
        />

        <AlertModal
          show={showLinkSuccessModal}
          title="연동 완료"
          message={
            config?.successMessage ??
            "매장이 연동되었습니다. 최근 6개월 리뷰를 불러오는 중입니다. 리뷰 관리 페이지에서 확인하세요."
          }
          confirmLabel="확인"
          onConfirm={() => setShowLinkSuccessModal(false)}
        />

        <Modal
          open={confirmUnlink !== null}
          onOpenChange={() => setConfirmUnlink(null)}
          title="연동해제"
          description="연동을 해제하면 해당 플랫폼 리뷰 관리가 중단됩니다.
정말 연동을 해제하시겠습니까?"
          size="sm"
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setConfirmUnlink(null)}
              >
                취소
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="md"
                disabled={logoutLoading}
                onClick={() => void handleConfirmUnlink()}
              >
                {logoutLoading ? "해제 중…" : "연동해제"}
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}
