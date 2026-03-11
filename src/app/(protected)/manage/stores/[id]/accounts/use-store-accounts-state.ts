"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/entities/store/hooks/query/use-store";
import { PLATFORMS } from "@/const/platform";
import { linkPlatform } from "@/lib/store/link-platform";

export function useStoreAccountsState() {
  const params = useParams();
  const storeId = params.id as string;
  const searchParams = useSearchParams();
  const platformFromQuery = searchParams.get("platform") ?? "";
  const { data: store, isLoading, error } = useStore(storeId);

  const [selectedPlatform, setSelectedPlatform] = useState("baemin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [baeminMeta, setBaeminMeta] = useState<{
    shop_category?: string | null;
    has_session?: boolean;
  } | null>(null);
  const linkAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (
      platformFromQuery &&
      PLATFORMS.some((p) => p.id === platformFromQuery)
    ) {
      setSelectedPlatform(platformFromQuery);
    }
  }, [platformFromQuery]);

  const current = PLATFORMS.find((p) => p.id === selectedPlatform);

  useEffect(() => {
    if (!linking) linkAbortRef.current = null;
  }, [linking]);

  useEffect(() => {
    if (!linking) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [linking]);

  useEffect(() => {
    if (selectedPlatform !== "baemin" || !storeId) return;
    fetch(`/api/stores/${storeId}/platforms/baemin/session`, {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then(
        (data: {
          result?: {
            shop_category?: string | null;
            has_session?: boolean;
          };
        }) => {
          setBaeminMeta(
            data?.result
              ? {
                  shop_category: data.result.shop_category ?? null,
                  has_session: data.result.has_session,
                }
              : null,
          );
        },
      )
      .catch(() => setBaeminMeta(null));
  }, [storeId, selectedPlatform, linkSuccess]);

  const handleLink = useCallback(
    async (platformId: string) => {
      if (!username.trim() || !password) {
        setLinkError("아이디와 비밀번호를 입력해 주세요.");
        return;
      }
      setLinkError(null);
      setLinking(true);
      linkAbortRef.current = new AbortController();
      try {
        await linkPlatform(
          storeId,
          platformId,
          username.trim(),
          password,
          linkAbortRef.current.signal,
        );
        setLinkSuccess(true);
        setPassword("");
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setLinkError(
            e instanceof Error ? e.message : "연동에 실패했습니다.",
          );
        }
      } finally {
        setLinking(false);
      }
    },
    [storeId, username, password],
  );

  return {
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
    clearLinkError: () => setLinkError(null),
  };
}
