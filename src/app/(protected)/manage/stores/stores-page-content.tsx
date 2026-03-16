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
import { SyncOverlay } from "@/components/review/SyncOverlay";
import { AlertModal } from "@/components/shared/AlertModal";
import { useFormattedBusinessRegistration } from "@/lib/hooks/use-formatted-business-registration";
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
        <LinkedPlatformIcon />
      ) : undefined,
  }));
  const tabItemsMobile = STORE_MANAGE_PLATFORM_TABS_MOBILE.map((t) => ({
    value: t.value,
    label: t.label,
    icon:
      (linkedByPlatform[t.value]?.length ?? 0) > 0 ? (
        <LinkedPlatformIcon />
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
                  onLogout={handleLogout}
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
                  onLogout={handleLogout}
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
            allStores={allStores}
            selectedStoreId={selectedStoreId}
            onSelectedStoreIdChange={setSelectedStoreId}
            username={username}
            onUsernameChange={setUsername}
            password={password}
            onPasswordChange={setPassword}
            linkSuccess={linkSuccess}
            linkError={linkError}
            configSuccessMessage={config.successMessage}
            onLink={handleLink}
            linking={linking}
          />
        )}

        {platform === "baemin" && linking ? (
          <StoreLinkProgressModal
            show={linking}
            platformLabel={PLATFORM_LABEL[platform]}
          />
        ) : (
          <SyncOverlay
            show={linking}
            title="매장 연동 중…"
            description="완료될 때까지 다른 페이지로 이동할 수 없습니다."
          />
        )}

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
      </div>
    </div>
  );
}

interface StoresLinkedCardProps {
  platform: string;
  platformLabel: string;
  linkedStores: { id: string; name: string }[];
  onLogout?: (storeId: string, platform: string) => Promise<void>;
  logoutLoading?: boolean;
}

/** 모바일 전용: 연동 완료 + 매장 목록 (Figma P-03) */
function StoresLinkedViewMobile({
  platform,
  platformLabel,
  linkedStores,
  onLogout,
  logoutLoading,
}: StoresLinkedCardProps) {
  const firstStore = linkedStores[0];
  const changeStoreText = `다른 매장으로 변경하려면 
    로그아웃 후 해당 플랫폼 로그인 정보를 다시 입력해 주세요.`;
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
            {logoutLoading ? "해제 중…" : "로그아웃"}
          </Button>
        )}
      </div>
      {/* AppShell·페이지 px-4 무시하고 화면 전체 폭 (뷰포트 기준) */}
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
              businessRegistrationNumber={
                s.business_registration_number ?? null
              }
            />
          );
        })}
      </div>
    </>
  );
}

function StoresLinkedCard({
  platform,
  platformLabel,
  linkedStores,
  onLogout,
  logoutLoading,
}: StoresLinkedCardProps) {
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
          다른 매장으로 변경하려면 로그아웃 후 해당 플랫폼 로그인 정보를 다시
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
            {logoutLoading ? "해제 중…" : "로그아웃"}
          </Button>
        )}
      </div>
    </div>
  );
}

interface LinkedStoreCardProps {
  storeName: string;
  externalShopId: string | null;
  shopCategory: string | null;
  businessRegistrationNumber: string | null;
}

function LinkedStoreCard({
  storeName,
  externalShopId,
  shopCategory,
  businessRegistrationNumber,
}: LinkedStoreCardProps) {
  const display = (v: string | null) => (v?.trim() ? v : "—");
  const formattedBusinessNumber = useFormattedBusinessRegistration(
    businessRegistrationNumber,
  );
  return (
    <Card
      padding="none"
      variant="default"
      className="rounded-xl border-gray-07 py-5 px-4"
    >
      <p className="typo-body-01-bold mb-5 text-gray-01">{storeName}</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="typo-body-02-bold text-gray-01">가게 아이디</span>
          <span className="typo-body-02-regular text-right text-gray-02">
            {display(externalShopId)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="typo-body-02-bold text-gray-01">사업자 번호</span>
          <span className="typo-body-02-regular text-right text-gray-02">
            {formattedBusinessNumber}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="typo-body-02-bold text-gray-01">업종</span>
          <span className="typo-body-02-regular text-right text-gray-02">
            {display(shopCategory)}
          </span>
        </div>
      </div>
    </Card>
  );
}

/** 모바일 전용: 아이디/비밀번호 입력 (Figma P-01, 버튼은 하단 고정) */
function StoresUnlinkedFormMobile({
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  linkError,
  placeholderId,
  placeholderPw,
}: {
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  linkError: string | null;
  onLink: () => void;
  linking: boolean;
  placeholderId: string;
  placeholderPw: string;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputClass =
    "h-12 w-full rounded-lg border border-gray-07 bg-white pl-4 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline-none focus:border-gray-03 focus:ring-1 focus:ring-gray-03";
  return (
    <div className="mt-6 flex flex-col gap-5">
      {linkError ? (
        <p className="typo-body-02-regular text-red-01">{linkError}</p>
      ) : null}
      <label className="flex flex-col gap-3">
        <span className="typo-body-01-bold text-gray-01">아이디</span>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder={placeholderId}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-3">
        <span className="typo-body-01-bold text-gray-01">비밀번호</span>
        <div className="relative">
          <input
            type={passwordVisible ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={placeholderPw}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            aria-label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
            onClick={() => setPasswordVisible((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-05 hover:text-gray-03"
          >
            {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </label>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );
}

interface StoresUnlinkedViewProps {
  platform: string;
  platformLabel: string;
  descriptionLines: [string, string];
  allStores: { id: string; name: string }[];
  selectedStoreId: string;
  onSelectedStoreIdChange: (id: string) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  linkSuccess: boolean;
  linkError: string | null;
  configSuccessMessage: string;
  onLink: () => void;
  linking: boolean;
}

function StoresUnlinkedView({
  platform,
  platformLabel,
  descriptionLines,
  allStores,
  selectedStoreId,
  onSelectedStoreIdChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  linkSuccess,
  linkError,
  configSuccessMessage,
  onLink,
  linking,
}: StoresUnlinkedViewProps) {
  return (
    <>
      {/* 모바일: Figma P-01 (배민 매장연동 > 정보 입력) */}
      <div className="flex flex-col px-4 pb-28 md:hidden">
        <div className="flex items-center gap-3 pt-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1DA6A2] bg-white">
            <PlatformIcon platform={platform} />
          </div>
          <h2 className="typo-heading-02-bold text-gray-01">
            {platformLabel} 매장 연동
          </h2>
        </div>
        <p className="typo-body-02-regular mt-4 whitespace-pre-line text-gray-04">
          {descriptionLines[0]}
          {"\n"}
          {descriptionLines[1] ?? ""}
        </p>
        <StoresUnlinkedFormMobile
          username={username}
          onUsernameChange={onUsernameChange}
          password={password}
          onPasswordChange={onPasswordChange}
          linkError={linkError}
          onLink={onLink}
          linking={linking}
          placeholderId="아이디를 입력해주세요"
          placeholderPw="비밀번호를 입력해주세요"
        />
      </div>
      <PageFixedBottomBar className="px-4 md:hidden">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="h-[52px] w-full rounded-lg"
          onClick={onLink}
          disabled={linking || !username.trim() || !password}
        >
          {linking ? "연동 중…" : "매장 연동"}
        </Button>
      </PageFixedBottomBar>

      {/* 데스크톱 */}
      <div className="hidden min-h-[60vh] flex-col items-center justify-center md:flex">
        <Card padding="lg" className="w-full max-w-xl border-none">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-main-02 text-white">
                <PlatformIcon platform={platform} />
              </div>
              <h2 className="typo-heading-02-bold text-gray-01">
                {platformLabel} 매장 연동
              </h2>
            </div>
            <p className="typo-body-02-regular mt-3 text-gray-04">
              {descriptionLines[0]}
            </p>
            {descriptionLines[1] ? (
              <p className="typo-body-02-regular mt-1 text-gray-04">
                {descriptionLines[1]}
              </p>
            ) : null}
          </div>

          <PlatformLinkForm
            title=""
            description=""
            extra={null}
            successMessage={undefined}
            errorMessage={linkError}
            username={username}
            onUsernameChange={onUsernameChange}
            password={password}
            onPasswordChange={onPasswordChange}
            placeholderId="아이디를 입력해주세요"
            placeholderPw="비밀번호를 입력해주세요"
            onLink={onLink}
            linking={linking}
            noCard
            buttonText="매장 연동"
            variant="storeLink"
          />
        </Card>
      </div>
    </>
  );
}

function LinkedPlatformIcon() {
  return (
    <svg
      className="h-5 w-5 text-main-02"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface PlatformIconProps {
  platform: string;
}

function PlatformIcon({ platform }: PlatformIconProps) {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M19 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M7 9l2-4h6l2 4" />
      <path d="M7 9v6M17 9v6" />
      <path d="M9 9h6" />
    </svg>
  );
}
