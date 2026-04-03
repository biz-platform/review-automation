"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  EMAIL_FORMAT_REGEX,
  PHONE_MAX_LENGTH,
} from "@/lib/constants/verification";
import { formatMobileInputDigits } from "@/lib/utils/format-phone";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import { checkAvailability } from "@/entities/auth/api/signup-api";
import { findPasswordReset } from "@/entities/auth/api/find-password-api";
import { useVerificationCodeFlow } from "@/app/(auth)/signup/useVerificationCodeFlow";
import { SignupVerificationModals } from "@/app/(auth)/signup/SignupVerificationModals";
import { useFindPasswordPhoneFns } from "@/app/(auth)/find/password/useFindPasswordPhoneFns";
import { FindIdPhoneStep } from "@/app/(auth)/find/id/FindIdPhoneStep";
import { FindPasswordResetStep } from "@/app/(auth)/find/password/FindPasswordResetStep";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const KOREAN_MOBILE_010 = /^010\d{8}$/;

export default function FindPasswordPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [step1Submitting, setStep1Submitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [bottomMessage, setBottomMessage] = useState<string | null>(null);
  const [recoverySessionId, setRecoverySessionId] = useState<string | null>(
    null,
  );
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
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

  const onVerified = useCallback((id: string) => {
    setRecoverySessionId(id);
  }, []);

  const phoneFns = useFindPasswordPhoneFns({
    email,
    setPhoneError,
    setBottomMessage,
    setCodeError,
    onVerified,
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

  const handlePhoneNext = async () => {
    if (phoneFlow.code.length !== 6) return;
    if (verifySubmittingRef.current) return;
    verifySubmittingRef.current = true;
    setCodeError(null);
    try {
      const phoneE164 = toE164(phoneDigits);
      const ok = await phoneFlow.verifyCode(phoneE164, phoneFlow.code);
      if (!ok) return;
      setStep(3);
    } finally {
      verifySubmittingRef.current = false;
    }
  };

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PHONE_MAX_LENGTH);
    setPhone(formatMobileInputDigits(digits));
  };

  const handleEmailNext = async () => {
    setEmailError(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_FORMAT_REGEX.test(trimmed)) {
      setEmailError("이메일 형식이 올바르지 않습니다");
      return;
    }
    setStep1Submitting(true);
    try {
      const avail = await checkAvailability({ email: trimmed });
      if (avail.emailAvailable !== false) {
        setEmailError("가입된 이메일이 아니에요");
        return;
      }
      setStep(2);
    } catch (e) {
      setEmailError(
        e instanceof Error
          ? e.message
          : "가입 여부 확인에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setStep1Submitting(false);
    }
  };

  const handleResetComplete = async (payload: { password: string }) => {
    if (!recoverySessionId) {
      setResetError("세션이 없어요. 처음부터 다시 시도해주세요");
      return;
    }
    setResetSubmitting(true);
    setResetError(null);
    try {
      await findPasswordReset({
        recoverySessionId,
        password: payload.password,
      });
      addToast("비밀번호가 변경되었어요");
      router.push("/login");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "FIND_PASSWORD_SESSION_INVALID") {
        setResetError("세션이 만료되었어요. 처음부터 다시 시도해주세요");
      } else {
        setResetError(err.message ?? "비밀번호 변경에 실패했어요");
      }
    } finally {
      setResetSubmitting(false);
    }
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
              {step === 3 ? "비밀번호 재설정" : "비밀번호 찾기"}
            </h1>

            <div className="flex min-h-0 flex-1 flex-col">
              {step === 1 && (
                <form
                  className="mt-6 flex min-h-0 flex-1 flex-col gap-4 md:mt-8 md:gap-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleEmailNext();
                  }}
                >
                  <TextField
                    label="이메일"
                    type="email"
                    autoComplete="email"
                    placeholder="가입 시 사용한 이메일을 입력해주세요"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                    }}
                    errorMessage={emailError ?? undefined}
                    className="w-full shrink-0"
                  />
                  <div className="min-h-4 flex-1 md:min-h-0" />
                  <div className="sticky bottom-0 bg-white pb-6 pt-4 md:static md:bg-transparent md:p-0">
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="secondaryDark"
                        className="h-[52px] flex-1 rounded-lg typo-body-01-bold outline-1 outline-wgray-01 md:max-w-[224px]"
                        onClick={() => router.push("/login")}
                      >
                        이전
                      </Button>
                      <Button
                        type="submit"
                        disabled={step1Submitting || !email.trim()}
                        variant="primary"
                        className={cn(
                          "h-[52px] flex-1 rounded-lg typo-body-01-bold outline-1 md:max-w-[224px]",
                          (step1Submitting || !email.trim()) &&
                            "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
                          !step1Submitting &&
                            email.trim() &&
                            "bg-main-03 outline-main-02",
                        )}
                      >
                        {step1Submitting ? "확인 중…" : "다음"}
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {step === 2 && (
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
                  onNext={handlePhoneNext}
                  onPrev={() => setStep(1)}
                  nextPrimaryLabelMobile="비밀번호 재설정"
                  nextPrimaryLabelDesktop="비밀번호 재설정"
                />
              )}

              {step === 3 && (
                <FindPasswordResetStep
                  onPrev={() => setStep(2)}
                  onComplete={handleResetComplete}
                  errorMessage={resetError}
                  submitting={resetSubmitting}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
