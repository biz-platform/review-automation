"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SellerApplyModal } from "@/components/sellers/SellerApplyModal";
import { applySeller } from "@/entities/sellers/api";
import { QUERY_KEY } from "@/const/query-keys";

export default function SellerApplyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="p-8">
      <h1 className="typo-heading-01-bold text-gray-01">셀러 등록 신청</h1>
      <p className="mt-4 typo-body-02-regular text-gray-03">
        셀러 기능을 사용하려면 디비톡 센터장 인증이 필요합니다. 아래 버튼을 눌러
        디비톡 ID, 이름, 전화번호를 입력해 주세요.
      </p>
      <div className="mt-6">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={() => setModalOpen(true)}
        >
          셀러 등록 신청
        </Button>
      </div>

      <SellerApplyModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={async (data) => {
          await applySeller(data);
          await queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.profile });
        }}
        onSuccess={() => {
          router.refresh();
          router.push("/manage/sellers/link");
        }}
        submitLabel="신청하기"
      />
    </div>
  );
}
