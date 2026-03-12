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

const STORES_PATH = "/manage/stores";

type StoreLinkRequiredContextValue = {
  openModal: () => void;
  closeModal: () => void;
  setOnRestrictedPage: (value: boolean) => void;
  showModal: boolean;
};

const StoreLinkRequiredContext =
  createContext<StoreLinkRequiredContextValue | null>(null);

export function useStoreLinkRequired() {
  return useContext(StoreLinkRequiredContext);
}

export function StoreLinkRequiredProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [linkOpen, setLinkOpen] = useState(false);
  const [onRestrictedPage, setOnRestrictedPage] = useState(false);
  const showModal = linkOpen || onRestrictedPage;

  const closeModal = useCallback(() => {
    setLinkOpen(false);
    setOnRestrictedPage(false);
  }, []);

  const goToStores = useCallback(() => {
    closeModal();
    router.push(STORES_PATH);
  }, [closeModal, router]);

  const value: StoreLinkRequiredContextValue = {
    openModal: () => setLinkOpen(true),
    closeModal,
    setOnRestrictedPage,
    showModal,
  };

  return (
    <StoreLinkRequiredContext.Provider value={value}>
      {children}
      <Modal
        open={showModal}
        onOpenChange={() => {}}
        title="매장 연동이 필요해요"
        description="리뷰관리 및 구매·청구 서비스를 이용하려면 매장을 연동해 주세요."
        footer={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={goToStores}
          >
            매장 연동
          </Button>
        }
      />
    </StoreLinkRequiredContext.Provider>
  );
}
