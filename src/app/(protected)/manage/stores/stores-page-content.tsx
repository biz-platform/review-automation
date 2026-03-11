"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useCreateStore } from "@/entities/store/hooks/mutation/use-create-store";
import { useQueryClient } from "@tanstack/react-query";
import { STORE_MANAGE_PLATFORM_TABS, PLATFORM_LABEL } from "@/const/platform";
import {
  PLATFORM_LINK_CONFIG,
  STORE_PAGE_DESCRIPTION_LINES,
} from "@/const/platform-link-config";
import { QUERY_KEY } from "@/const/query-keys";
import { Card } from "@/components/ui/card";
import { TabLine } from "@/components/ui/tab-line";
import { ButtonLink } from "@/components/ui/button";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { NativeSelect } from "@/components/ui/native-select";
import { PlatformLinkForm } from "@/components/store/PlatformLinkForm";
import { StoreLinkProgressModal } from "@/components/store/StoreLinkProgressModal";
import { SyncOverlay } from "@/components/review/SyncOverlay";
import { AlertModal } from "@/components/shared/AlertModal";
import { linkPlatform } from "@/lib/store/link-platform";

const DEFAULT_PLATFORM = "baemin";
const VALID_PLATFORMS: string[] = STORE_MANAGE_PLATFORM_TABS.map(
  (t) => t.value,
);

export function StoresPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const platformParam = searchParams.get("platform") ?? "";
  const platform = VALID_PLATFORMS.includes(platformParam)
    ? platformParam
    : DEFAULT_PLATFORM;

  const { data: allStores = [], isLoading, error } = useStoreList();
  const { data: linkedStores = [] } = useStoreList(platform);
  const { data: linkedBaemin = [] } = useStoreList("baemin");
  const { data: linkedCoupangEats = [] } = useStoreList("coupang_eats");
  const { data: linkedDdangyo = [] } = useStoreList("ddangyo");
  const { data: linkedYogiyo = [] } = useStoreList("yogiyo");
  const createStore = useCreateStore();

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
    setLinking(true);
    linkAbortRef.current = new AbortController();

    try {
      let storeId = selectedStoreId;
      if (allStores.length === 0) {
        const created = await createStore.mutateAsync({ name: "내 매장" });
        storeId = created.id;
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
      }
      await linkPlatform(
        storeId,
        platform,
        username.trim(),
        password,
        linkAbortRef.current.signal,
      );
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEY.store.listLinked(platform),
      });
      setLinkSuccess(true);
      setPassword("");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setLinkError(e instanceof Error ? e.message : "연동에 실패했습니다.");
      }
    } finally {
      setLinking(false);
    }
  }, [
    selectedStoreId,
    platform,
    username,
    password,
    allStores.length,
    createStore,
    queryClient,
  ]);

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

  return (
    <div className="flex flex-col">
      {accountsMode && platformFromQuery && (
        <AccountsModeBanner
          platformLabel={PLATFORM_LABEL[platformFromQuery] ?? platformFromQuery}
        />
      )}

      <div className="mb-6">
        <TabLine
          items={STORE_MANAGE_PLATFORM_TABS.map((t) => ({
            value: t.value,
            label: t.label,
            icon:
              (linkedByPlatform[t.value]?.length ?? 0) > 0 ? (
                <LinkedPlatformIcon />
              ) : undefined,
          }))}
          value={platform}
          onValueChange={setPlatformTab}
          direction="row"
          size="pc"
        />
      </div>

      {!config ? (
        <p className="typo-body-02-regular text-gray-04">
          선택한 플랫폼 연동은 준비 중입니다.
        </p>
      ) : isPlatformLinked ? (
        <>
          <div className="pb-[108px]">
            <StoresLinkedCard
              platform={platform}
              platformLabel={PLATFORM_LABEL[platform]}
              linkedStores={linkedStores}
            />
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              {linkedStores.map((store) => (
                <LinkedStoreCard
                  key={store.id}
                  storeName={store.name}
                  storeId={store.id}
                />
              ))}
            </div>
          </div>
          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-07 bg-white pt-6 pb-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:left-(--width-lnb)">
            <div className="mx-auto flex max-w-full justify-end pl-(--layout-content-padding-left) pr-(--layout-content-padding-right) w-(--layout-content-width)">
              <ButtonLink
                href="/manage/reviews"
                variant="primary"
                size="lg"
                className="rounded-lg outline-main-02 hover:opacity-90"
              >
                리뷰 관리하기
              </ButtonLink>
            </div>
          </div>
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
        title="연동 실패"
        message={
          linkError?.includes("로그인에 실패")
            ? "로그인에 실패했습니다.\n아이디·비밀번호를 확인해 주세요."
            : (linkError ?? "")
        }
        onConfirm={() => setLinkError(null)}
      />
    </div>
  );
}

interface AccountsModeBannerProps {
  platformLabel: string;
}

function AccountsModeBanner({ platformLabel }: AccountsModeBannerProps) {
  return (
    <Card variant="muted" padding="md" className="mb-6">
      <p className="typo-body-02-regular text-gray-02">
        {platformLabel} 계정을 연동할 매장을 선택한 뒤 아래에서 로그인해 주세요.
      </p>
    </Card>
  );
}

interface StoresLinkedCardProps {
  platform: string;
  platformLabel: string;
  linkedStores: { id: string; name: string }[];
}

function StoresLinkedCard({
  platform,
  platformLabel,
  linkedStores,
}: StoresLinkedCardProps) {
  return (
    <Card padding="lg" className="mb-6">
      <div className="flex flex-row items-end justify-between gap-4">
        <div>
          <h2 className="typo-heading-02-bold mb-2 text-gray-01">
            {platformLabel} 매장 연동 완료
          </h2>
          <p className="typo-body-02-regular mb-1 text-gray-04">
            연결된 매장의 리뷰 관리를 시작할 수 있어요
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
          {linkedStores[0] && (
            <ButtonLink
              href={`/manage/stores/${linkedStores[0].id}/accounts?platform=${platform}`}
              variant="destructive"
              size="md"
            >
              로그아웃
            </ButtonLink>
          )}
        </div>
      </div>
    </Card>
  );
}

interface LinkedStoreCardProps {
  storeId: string;
  storeName: string;
}

function LinkedStoreCard({ storeId, storeName }: LinkedStoreCardProps) {
  return (
    <Card padding="lg" variant="default">
      <p className="typo-body-01-bold mb-3 text-gray-01">{storeName}</p>
      <dl className="typo-body-02-regular space-y-1 text-gray-04">
        <div className="flex gap-2">
          <dt className="text-gray-05">가게 아이디</dt>
          <dd>{storeId}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-05">사업자 번호</dt>
          <dd>—</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-gray-05">업종</dt>
          <dd>—</dd>
        </div>
      </dl>
    </Card>
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
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
        {allStores.length > 0 && (
          <NativeSelect
            id="store-select"
            label="매장 선택"
            value={selectedStoreId}
            onChange={(e) => onSelectedStoreIdChange(e.target.value)}
            options={allStores.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
        <PlatformLinkForm
          title=""
          description=""
          extra={null}
          successMessage={linkSuccess ? configSuccessMessage : undefined}
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
          buttonText="로그인"
          variant="storeLink"
        />
      </Card>
    </div>
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
