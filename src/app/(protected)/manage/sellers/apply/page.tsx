"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { applySeller } from "@/entities/sellers/api";
import { QUERY_KEY } from "@/const/query-keys";

const CUSTOMER_SERVICE_ERROR_CODES = [
  "CENTER_MANAGER_NOT_FOUND",
  "PLANNER_NOT_ELIGIBLE",
  "DBTALK_ALREADY_USED",
  "SNS_VERIFY_FAILED",
  "SELLER_UPDATE_FAILED",
] as const;

export default function SellerApplyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [customerServiceModalOpen, setCustomerServiceModalOpen] =
    useState(false);
  const [customerServiceErrorCode, setCustomerServiceErrorCode] = useState<
    string | null
  >(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalName, setSuccessModalName] = useState("");
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
      await applySeller({
        dbtalk_id: dbtalkId.trim(),
        name: name.trim(),
        phone: phone.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.profile });
      setModalOpen(false);
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
          onClick={() => {
            setErrorMessage(null);
            setModalOpen(true);
          }}
        >
          셀러 등록 신청
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onOpenChange={(open) => !open && setModalOpen(false)}
        title=""
        size="default"
        footerAlign="center"
        footer={
          <div className="w-full flex flex-col items-center gap-2.5">
            <p className="typo-body-02-regular text-gray-03 text-center">
              디비톡 회원이 아닌 경우,{" "}
              <Link
                href="/support"
                className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              >
                <span className="underline font-bold">고객센터로 문의</span>
                해주세요
              </Link>
            </p>
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="secondaryDark"
                size="lg"
                onClick={() => setModalOpen(false)}
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
                {submitting ? "확인 중…" : "신청하기"}
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
        onOpenChange={(open) => {
          if (!open) {
            setSuccessModalOpen(false);
            router.refresh();
            router.push("/manage/sellers/link");
          }
        }}
        title="셀러 등록 완료"
        size="sm"
        footer={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              setSuccessModalOpen(false);
              router.refresh();
              router.push("/manage/sellers/link");
            }}
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
        onOpenChange={(open) => !open && setCustomerServiceModalOpen(false)}
        title="고객센터 문의 안내"
        size="sm"
        footer={
          <Button
            type="button"
            variant="primary"
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
            <Link
              href="/support"
              className="outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              <span className="underline font-bold">고객센터로 문의</span>
              해주세요
            </Link>
            .
          </span>
        }
      />
    </div>
  );
}
