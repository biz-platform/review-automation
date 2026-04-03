"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { PHONE_MAX_LENGTH } from "@/lib/constants/verification";
import { formatMobileInputDigits } from "@/lib/utils/format-phone";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import { useVerificationCodeFlow } from "@/app/(auth)/signup/useVerificationCodeFlow";
import { SignupVerificationModals } from "@/app/(auth)/signup/SignupVerificationModals";
import { useFindIdPhoneFns } from "@/app/(auth)/find/id/useFindIdPhoneFns";
import { FindIdPhoneStep } from "@/app/(auth)/find/id/FindIdPhoneStep";
import { FindIdResultStep } from "@/app/(auth)/find/id/FindIdResultStep";

const KOREAN_MOBILE_010 = /^010\d{8}$/;

export default function FindIdPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [bottomMessage, setBottomMessage] = useState<string | null>(null);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);
  const [codePlaceholder, setCodePlaceholder] = useState(
    "문자로 전송된 인증번호 6자리를 입력해주세요",
  );
  const verifySubmittingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () =>
      setCodePlaceholder(
        mq.matches
          ? "인증번호 6자리를 입력해주세요"
          : "문자로 전송된 인증번호 6자리를 입력해주세요",
      );
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onVerifiedEmail = useCallback((email: string) => {
    setFoundEmail(email);
  }, []);

  const phoneFns = useFindIdPhoneFns({
    setPhoneError,
    setBottomMessage,
    setCodeError,
    onVerifiedEmail,
  });

  const phoneFlow = useVerificationCodeFlow({
    toastMessage: "문자로 인증번호 6자리를 보냈어요",
    sendCodeFn: phoneFns.sendCodeFn,
    verifyCodeFn: phoneFns.verifyCodeFn,
  });

  const phoneDigits = phone.replace(/\D/g, "");

  const validatePhoneBeforeVerify = () => {
    if (!KOREAN_MOBILE_010.test(phoneDigits)) {
      setPhoneError("올바른 휴대전화 번호를 입력해주세요");
      return false;
    }
    setPhoneError(null);
    setCodeError(null);
    setBottomMessage(null);
    return true;
  };

  const handlePhoneVerify = async () => {
    const canVerify = validatePhoneBeforeVerify();
    if (!canVerify) return false;
    if (phoneFlow.codeSent) {
      phoneFlow.openResendConfirm();
      return true;
    }
    const phoneE164 = toE164(phoneDigits);
    return phoneFlow.doSendCode(phoneE164);
  };

  const handlePhoneResendConfirm = async () => {
    const canVerify = validatePhoneBeforeVerify();
    if (!canVerify) return;
    phoneFlow.setResendConfirmModalOpen(false);
    const phoneE164 = toE164(phoneDigits);
    await phoneFlow.doSendCode(phoneE164);
  };

  const handleNext = async () => {
    if (phoneFlow.code.length !== 6) return;
    if (verifySubmittingRef.current) return;
    verifySubmittingRef.current = true;
    setCodeError(null);
    try {
      // 만료 여부는 서버 OTP 저장소 기준으로만 판단 (클라 타이머와 어긋나면 올바른 코드도 막히는 경우 방지)
      const phoneE164 = toE164(phoneDigits);
      const ok = await phoneFlow.verifyCode(phoneE164, phoneFlow.code);
      if (!ok) return;
      setStep(2);
    } finally {
      verifySubmittingRef.current = false;
    }
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PHONE_MAX_LENGTH);
    setPhone(formatMobileInputDigits(digits));
  };

  return (
    <>
      <SignupVerificationModals
        rateLimitModalOpen={phoneFlow.rateLimitModalOpen}
        onRateLimitModalOpenChange={phoneFlow.setRateLimitModalOpen}
        resendConfirmModalOpen={phoneFlow.resendConfirmModalOpen}
        onResendConfirmModalOpenChange={phoneFlow.setResendConfirmModalOpen}
        sending={phoneFlow.sending}
        onResendConfirm={handlePhoneResendConfirm}
      />

      <div className="flex flex-1 flex-col bg-white md:bg-gray-08">
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-x-hidden px-4 py-6 md:p-8">
          <div
            className={cn(
              "flex max-h-[680px] w-full max-w-[320px] flex-col overflow-y-auto py-2",
              "min-h-[calc(100vh-8rem)] flex-1 flex-col md:min-h-[518px]",
              "md:w-[560px] md:max-w-[560px] md:rounded-[20px] md:bg-white md:px-[50px] md:py-14 md:shadow-[0_4px_20px_0_rgba(0,0,0,0.08)]",
            )}
          >
            <h1
              className={cn(
                "shrink-0 font-paperlogy text-left text-xl font-semibold leading-7 text-neutral-800",
                step === 1 ? "mb-6 md:mb-8" : "mb-8 md:mb-10",
              )}
            >
              아이디 찾기
            </h1>

            <div className="flex min-h-0 flex-1 flex-col">
              {step === 1 && (
                <FindIdPhoneStep
                  phone={phone}
                  onPhoneChange={handlePhoneChange}
                  phoneError={phoneError}
                  setPhoneError={setPhoneError}
                  codeError={codeError}
                  setCodeError={setCodeError}
                  phoneFlow={phoneFlow}
                  codeFieldPlaceholder={codePlaceholder}
                  bottomMessage={bottomMessage}
                  onVerify={handlePhoneVerify}
                  onNext={handleNext}
                  onPrev={() => router.push("/login")}
                />
              )}

              {step === 2 && foundEmail && (
                <FindIdResultStep email={foundEmail} className="min-h-0 flex-1" />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
