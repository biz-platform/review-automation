"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ComingSoonModal } from "@/components/ui/coming-soon-modal";
import { TextField } from "@/components/ui/text-field";

const CUSTOMER_SERVICE_ERROR_CODES = [
  "CENTER_MANAGER_NOT_FOUND",
  "PLANNER_NOT_ELIGIBLE",
  "DBTALK_ALREADY_USED",
  "SNS_VERIFY_FAILED",
  "SELLER_UPDATE_FAILED",
] as const;

export type SellerApplyFormData = {
  dbtalk_id: string;
  name: string;
  phone: string;
};

export interface SellerApplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 디비톡 인증 후 호출. 성공 시 내부에서 성공 모달 표시 */
  onSubmit: (data: SellerApplyFormData) => Promise<void>;
  /** 성공 모달에서 확인 클릭 시 호출 (목록 새로고침, 라우트 이동 등) */
  onSuccess?: () => void;
  /** 어드민용: 대상 사용자 표시 (예: "대상: user@email.com") */
  targetUserLabel?: string;
  /** 제출 버튼 라벨 (기본: "신청하기") */
  submitLabel?: string;
}

export function SellerApplyModal({
  open,
  onOpenChange,
  onSubmit,
  onSuccess,
  targetUserLabel,
  submitLabel = "신청하기",
}: SellerApplyModalProps) {
  const [customerServiceModalOpen, setCustomerServiceModalOpen] =
    useState(false);
  const [customerServiceErrorCode, setCustomerServiceErrorCode] = useState<
    string | null
  >(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalName, setSuccessModalName] = useState("");
  const [comingSoonModalOpen, setComingSoonModalOpen] = useState(false);
  const [dbtalkId, setDbtalkId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFormFilled =
    dbtalkId.trim() !== "" && name.trim() !== "" && phone.trim() !== "";

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!isFormFilled) {
      setErrorMessage("디비톡 ID, 이름, 전화번호를 모두 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        dbtalk_id: dbtalkId.trim(),
        name: name.trim(),
        phone: phone.trim(),
      });
      onOpenChange(false);
      setSuccessModalName(name.trim());
      setSuccessModalOpen(true);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (
        err.code &&
        (CUSTOMER_SERVICE_ERROR_CODES as readonly string[]).includes(err.code)
      ) {
        setCustomerServiceErrorCode(err.code);
        setCustomerServiceModalOpen(true);
      } else {
        setErrorMessage(err.message ?? "오류가 발생했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessConfirm = () => {
    setSuccessModalOpen(false);
    onSuccess?.();
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setErrorMessage(null);
            onOpenChange(false);
          }
        }}
        title=""
        size="default"
        footerAlign="center"
        footer={
          <div className="flex w-full flex-col items-center gap-2.5">
            <p className="typo-body-02-regular text-center text-gray-03">
              디비톡 회원이 아닌 경우,{" "}
              <button
                type="button"
                onClick={() => setComingSoonModalOpen(true)}
                className="rounded font-bold underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                고객센터로 문의
              </button>
              해주세요
            </p>
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="secondaryDark"
                size="lg"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="flex-1"
              >
                닫기
              </Button>
              <Button
                type="button"
                variant={isFormFilled ? "primary" : "sellerApplyIncomplete"}
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || !isFormFilled}
                className="flex-1"
              >
                {submitting ? "확인 중…" : submitLabel}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-[30px]">
          <header className="flex flex-col gap-3">
            <h2 id="modal-title" className="typo-heading-01-bold text-gray-01">
              올리뷰 서비스 셀러 등록 신청
            </h2>
            {targetUserLabel && (
              <p className="typo-body-02-regular text-gray-01">
                {targetUserLabel}
              </p>
            )}
            <p className="mt-0 typo-body-02-regular text-gray-03">
              셀러 등록은 CEO포털 디비톡에 등록된 센터장만 가능합니다
            </p>
          </header>
          <div className="flex flex-col gap-6">
            <TextField
              label="아이디"
              value={dbtalkId}
              onChange={(e) => setDbtalkId(e.target.value)}
              placeholder="디비톡 아이디를 입력해주세요"
            />
            <TextField
              label="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="디비톡에 등록된 영업자 이름을 입력해주세요"
            />
            <TextField
              label="휴대전화 번호"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="디비톡에 등록된 휴대전화 번호를 입력해주세요"
            />
            {errorMessage && (
              <p className="typo-body-03-regular text-red-01">{errorMessage}</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={successModalOpen}
        onOpenChange={(o) => !o && handleSuccessConfirm()}
        title="셀러 등록 완료"
        size="sm"
        footer={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSuccessConfirm}
          >
            확인
          </Button>
        }
        description={
          <span>
            안녕하세요,{" "}
            <span className="font-bold">{successModalName || "센터장"}</span>{" "}
            센터장님.
            <br />
            셀러 등록이 정상적으로 완료되었습니다.
          </span>
        }
      />

      <Modal
        open={customerServiceModalOpen}
        onOpenChange={(o) => !o && setCustomerServiceModalOpen(false)}
        title="고객센터 문의 안내"
        size="sm"
        footer={
          <Button
            type="button"
            variant="destructive"
            size="md"
            onClick={() => setCustomerServiceModalOpen(false)}
          >
            확인
          </Button>
        }
        description={
          <span>
            {customerServiceErrorCode === "PLANNER_NOT_ELIGIBLE"
              ? "센터장 혹은 판매 권한을 얻은 플래너만 사용 가능합니다."
              : customerServiceErrorCode === "DBTALK_ALREADY_USED"
                ? "이미 다른 계정에서 인증에 사용된 정보입니다."
                : "디비톡에 등록된 정보가 없습니다."}{" "}
            <br />
            <button
              type="button"
              onClick={() => {
                setCustomerServiceModalOpen(false);
                setComingSoonModalOpen(true);
              }}
              className="rounded font-bold underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              고객센터로 문의
            </button>
            해주세요.
          </span>
        }
      />

      <ComingSoonModal
        open={comingSoonModalOpen}
        onOpenChange={(o) => !o && setComingSoonModalOpen(false)}
      />
    </>
  );
}
