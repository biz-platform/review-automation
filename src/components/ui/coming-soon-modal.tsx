"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export interface ComingSoonModalProps {
  open: boolean;
  onOpenChange: (open: false) => void;
}

/** "준비 중입니다" 안내 모달 (공지사항, 고객센터 등 미오픈 메뉴용) */
export function ComingSoonModal({ open, onOpenChange }: ComingSoonModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="안내"
      size="sm"
      description="준비 중입니다."
      footer={
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => onOpenChange(false)}
        >
          확인
        </Button>
      }
    />
  );
}
