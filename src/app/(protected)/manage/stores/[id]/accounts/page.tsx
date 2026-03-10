"use client";

import Link from "next/link";
import { useStoreAccountsState } from "./use-store-accounts-state";
import { PlatformLinkForm } from "@/components/store/PlatformLinkForm";
import { SyncOverlay } from "@/components/review/SyncOverlay";
import { AlertModal } from "@/components/shared/AlertModal";
import { PLATFORMS } from "@/const/platform";
import { PLATFORM_LINK_CONFIG } from "./platform-link-config";
import { Button } from "@/components/ui/button";

export default function StoreAccountsPage() {
  const {
    storeId,
    store,
    isLoading,
    error,
    selectedPlatform,
    setSelectedPlatform,
    current,
    username,
    setUsername,
    password,
    setPassword,
    linking,
    linkError,
    linkSuccess,
    baeminMeta,
    handleLink,
    clearLinkError,
  } = useStoreAccountsState();

  if (isLoading) return <p className="p-8">로딩 중…</p>;
  if (error || !store)
    return <p className="p-8 text-red-600">매장을 찾을 수 없습니다.</p>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/manage/stores" className="text-muted-foreground hover:underline">
          ← 매장 목록
        </Link>
        <Link
          href={`/manage/stores/${storeId}`}
          className="text-muted-foreground hover:underline"
        >
          {store.name}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold">계정 설정</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant={selectedPlatform === p.id ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSelectedPlatform(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {current?.id === "baemin" && current.ready && (
        <PlatformLinkForm
          title={PLATFORM_LINK_CONFIG.baemin.title}
          description={PLATFORM_LINK_CONFIG.baemin.description}
          extra={
            baeminMeta?.has_session && baeminMeta.shop_category ? (
              <p className="mb-4 text-sm font-medium text-muted-foreground">
                연동된 매장 카테고리: {baeminMeta.shop_category}
              </p>
            ) : undefined
          }
          successMessage={linkSuccess ? PLATFORM_LINK_CONFIG.baemin.successMessage : undefined}
          errorMessage={linkError}
          username={username}
          onUsernameChange={setUsername}
          password={password}
          onPasswordChange={setPassword}
          placeholderId={PLATFORM_LINK_CONFIG.baemin.placeholderId}
          placeholderPw={PLATFORM_LINK_CONFIG.baemin.placeholderPw}
          onLink={() => handleLink("baemin")}
          linking={linking}
        />
      )}

      {current?.id === "coupang_eats" && current.ready && (
        <PlatformLinkForm
          title={PLATFORM_LINK_CONFIG.coupang_eats.title}
          description={PLATFORM_LINK_CONFIG.coupang_eats.description}
          successMessage={linkSuccess ? PLATFORM_LINK_CONFIG.coupang_eats.successMessage : undefined}
          errorMessage={linkError}
          username={username}
          onUsernameChange={setUsername}
          password={password}
          onPasswordChange={setPassword}
          placeholderId={PLATFORM_LINK_CONFIG.coupang_eats.placeholderId}
          placeholderPw={PLATFORM_LINK_CONFIG.coupang_eats.placeholderPw}
          onLink={() => handleLink("coupang_eats")}
          linking={linking}
        />
      )}

      {current?.id === "yogiyo" && current.ready && (
        <PlatformLinkForm
          title={PLATFORM_LINK_CONFIG.yogiyo.title}
          description={PLATFORM_LINK_CONFIG.yogiyo.description}
          successMessage={linkSuccess ? PLATFORM_LINK_CONFIG.yogiyo.successMessage : undefined}
          errorMessage={linkError}
          username={username}
          onUsernameChange={setUsername}
          password={password}
          onPasswordChange={setPassword}
          placeholderId={PLATFORM_LINK_CONFIG.yogiyo.placeholderId}
          placeholderPw={PLATFORM_LINK_CONFIG.yogiyo.placeholderPw}
          onLink={() => handleLink("yogiyo")}
          linking={linking}
        />
      )}

      {current?.id === "ddangyo" && current.ready && (
        <PlatformLinkForm
          title={PLATFORM_LINK_CONFIG.ddangyo.title}
          description={PLATFORM_LINK_CONFIG.ddangyo.description}
          successMessage={linkSuccess ? PLATFORM_LINK_CONFIG.ddangyo.successMessage : undefined}
          errorMessage={linkError}
          username={username}
          onUsernameChange={setUsername}
          password={password}
          onPasswordChange={setPassword}
          placeholderId={PLATFORM_LINK_CONFIG.ddangyo.placeholderId}
          placeholderPw={PLATFORM_LINK_CONFIG.ddangyo.placeholderPw}
          onLink={() => handleLink("ddangyo")}
          linking={linking}
        />
      )}

      {current && !current.ready && (
        <p className="text-muted-foreground">
          {current.label} 연동은 준비 중입니다.
        </p>
      )}

      <SyncOverlay
        show={linking}
        title="매장 연동 중…"
        description="완료될 때까지 다른 페이지로 이동할 수 없습니다."
      />

      <AlertModal
        show={!!linkError}
        title="연동 실패"
        message={
          linkError?.includes("로그인에 실패")
            ? "로그인에 실패했습니다.\n아이디·비밀번호를 확인해 주세요."
            : linkError ?? ""
        }
        onConfirm={clearLinkError}
      />
    </div>
  );
}
