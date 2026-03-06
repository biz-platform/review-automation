"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useVerificationCodeFlow } from "./useVerificationCodeFlow";
import { SignupVerificationModals } from "./SignupVerificationModals";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_MIN_LENGTH_FOR_VERIFY = 10;

const SignupStep1 = dynamic(
  () => import("./SignupStep1").then((m) => ({ default: m.SignupStep1 })),
  { ssr: false, loading: () => <div className="mt-10 min-h-[320px]" /> },
);

const SignupStep2 = dynamic(
  () => import("./SignupStep2").then((m) => ({ default: m.SignupStep2 })),
  { ssr: false, loading: () => <div className="mt-10 min-h-[320px]" /> },
);

const SignupStep3 = dynamic(
  () => import("./SignupStep3").then((m) => ({ default: m.SignupStep3 })),
  { ssr: false, loading: () => <div className="mt-10 min-h-[320px]" /> },
);

/** 스텝 인디케이터 — Figma 37:310. 3단계 */
function SignupStepIndicator({ currentStep = 1 }: { currentStep?: number }) {
  const steps = [1, 2, 3];
  return (
    <div className="flex items-center gap-0" aria-label="가입 단계">
      {steps.map((step) => (
        <div key={step} className="flex items-center">
          {step > 1 && (
            <span
              className={cn(
                "h-px w-20 shrink-0",
                step <= currentStep ? "bg-main-02" : "bg-wgray-04",
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              step <= currentStep
                ? "bg-main-03 text-white outline-1 outline-main-02"
                : "bg-wgray-06 text-gray-06 outline-1 outline-wgray-04",
            )}
          >
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  const emailFlow = useVerificationCodeFlow({
    toastMessage: "이메일로 인증번호 6자리를 보냈어요",
  });
  const phoneFlow = useVerificationCodeFlow({
    toastMessage: "휴대전화로 인증번호 6자리를 보냈어요",
  });

  const handleEmailVerify = async () => {
    setEmailError(null);
    setCodeError(null);
    if (!EMAIL_FORMAT.test(email.trim())) {
      setEmailError("이메일 형식이 올바르지 않습니다");
      return;
    }
    await emailFlow.doSendCode();
  };

  const handleEmailResendConfirm = async () => {
    const ok = await emailFlow.doSendCode();
    if (ok) emailFlow.setResendConfirmModalOpen(false);
  };

  const handleNextStep1 = () => {
    if (emailFlow.code.length !== 6) return;
    if (!emailFlow.validateCode()) {
      setCodeError("인증번호가 올바르지 않습니다");
      return;
    }
    setCodeError(null);
    setStep(2);
  };

  const handlePhoneVerify = async () => {
    if (phone.replace(/\D/g, "").length < PHONE_MIN_LENGTH_FOR_VERIFY) return;
    await phoneFlow.doSendCode();
  };

  const handlePhoneResendConfirm = async () => {
    const ok = await phoneFlow.doSendCode();
    if (ok) phoneFlow.setResendConfirmModalOpen(false);
  };

  const handleNextStep2 = () => {
    if (phoneFlow.code.length !== 6) return;
    if (!phoneFlow.validateCode()) {
      setCodeError("인증번호가 올바르지 않습니다");
      return;
    }
    setCodeError(null);
    setStep(3);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, "").slice(0, 11));
  };

  const handleStep3Complete = (_payload: { password: string }) => {
    // TODO: API 연동 후 가입 요청
    router.push("/login");
  };

  return (
    <div className="flex flex-1 flex-col bg-gray-08">
      <SignupVerificationModals
        rateLimitModalOpen={emailFlow.rateLimitModalOpen}
        onRateLimitModalOpenChange={emailFlow.setRateLimitModalOpen}
        resendConfirmModalOpen={emailFlow.resendConfirmModalOpen}
        onResendConfirmModalOpenChange={emailFlow.setResendConfirmModalOpen}
        sending={emailFlow.sending}
        onResendConfirm={handleEmailResendConfirm}
      />
      <SignupVerificationModals
        rateLimitModalOpen={phoneFlow.rateLimitModalOpen}
        onRateLimitModalOpenChange={phoneFlow.setRateLimitModalOpen}
        resendConfirmModalOpen={phoneFlow.resendConfirmModalOpen}
        onResendConfirmModalOpenChange={phoneFlow.setResendConfirmModalOpen}
        sending={phoneFlow.sending}
        onResendConfirm={handlePhoneResendConfirm}
      />

      <main className="flex flex-1 flex-col items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-[560px] overflow-hidden rounded-[20px] bg-white px-[50px] py-10 md:min-h-[680px] md:py-12">
          <h1 className="mb-6 text-xl font-bold leading-[1.32] tracking-[-0.03em] text-gray-01 md:text-[20px]">
            가입에 필요한 정보를 입력해주세요
          </h1>
          <SignupStepIndicator currentStep={step} />

          <Suspense fallback={<div className="mt-10 min-h-[320px]" />}>
            {step === 1 && (
              <SignupStep1
                email={email}
                setEmail={setEmail}
                emailError={emailError}
                setEmailError={setEmailError}
                codeError={codeError}
                setCodeError={setCodeError}
                emailFlow={emailFlow}
                onVerify={handleEmailVerify}
                onNext={handleNextStep1}
              />
            )}
            {step === 2 && (
              <SignupStep2
                phone={phone}
                onPhoneChange={handlePhoneChange}
                codeError={codeError}
                setCodeError={setCodeError}
                phoneFlow={phoneFlow}
                onVerify={handlePhoneVerify}
                onNext={handleNextStep2}
                onPrev={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <SignupStep3
                onPrev={() => setStep(2)}
                onComplete={handleStep3Complete}
              />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
