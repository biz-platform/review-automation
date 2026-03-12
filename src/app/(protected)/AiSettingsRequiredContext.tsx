"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const SETTINGS_PATH = "/manage/reviews/settings";

type ContextValue = {
  openModal: () => void;
  closeModal: () => void;
  setOnRestrictedPage: (value: boolean) => void;
  showModal: boolean;
};

const AiSettingsRequiredContext = createContext<ContextValue | null>(null);

export function useAiSettingsRequired() {
  const ctx = useContext(AiSettingsRequiredContext);
  return ctx;
}

export function AiSettingsRequiredProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [linkOpen, setLinkOpen] = useState(false);
  const [onRestrictedPage, setOnRestrictedPage] = useState(false);
  const showModal = linkOpen || onRestrictedPage;

  const closeModal = useCallback(() => {
    setLinkOpen(false);
    setOnRestrictedPage(false);
  }, []);

  const goToSettings = useCallback(() => {
    closeModal();
    router.push(SETTINGS_PATH);
  }, [closeModal, router]);

  const value: ContextValue = {
    openModal: () => setLinkOpen(true),
    closeModal,
    setOnRestrictedPage,
    showModal,
  };

  return (
    <AiSettingsRequiredContext.Provider value={value}>
      {children}
      <Modal
        open={showModal}
        onOpenChange={() => {}}
        title="AI 댓글 설정 필요"
        description="리뷰 관리 및 구매·청구 서비스를 이용하려면 먼저 AI 댓글 설정(말투, 댓글 길이)을 완료해 주세요."
        footer={
          <Button type="button" variant="primary" size="md" onClick={goToSettings}>
            설정하러 가기
          </Button>
        }
      />
    </AiSettingsRequiredContext.Provider>
  );
}
