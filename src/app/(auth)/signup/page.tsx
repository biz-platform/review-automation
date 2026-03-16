"use client";

import { useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { REFERRAL_CODE_STORAGE_KEY } from "@/const/referral";
import { cn } from "@/lib/utils/cn";
import {
  EMAIL_FORMAT_REGEX,
  PHONE_MIN_LENGTH_FOR_VERIFY,
  PHONE_MAX_LENGTH,
  DEV_MOCK_ALREADY_REGISTERED_EMAIL,
  DEV_MOCK_ALREADY_REGISTERED_PHONE,
} from "@/lib/constants/verification";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import { signup, checkAvailability } from "@/entities/auth/api/signup-api";
import { useVerificationCodeFlow } from "@/app/(auth)/signup/useVerificationCodeFlow";
import {
  useSignupEmailFns,
  useSignupPhoneFns,
} from "@/app/(auth)/signup/useSignupVerificationFns";
import { SignupVerificationModals } from "@/app/(auth)/signup/SignupVerificationModals";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const SignupStep1 = dynamic(
  () =>
    import("@/app/(auth)/signup/SignupStep1").then((m) => ({
      default: m.SignupStep1,
    })),
  { ssr: false, loading: () => <div className="mt-10 min-h-[320px]" /> },
);

const SignupStep2 = dynamic(
  () =>
    import("@/app/(auth)/signup/SignupStep2").then((m) => ({
      default: m.SignupStep2,
    })),
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
                "h-px w-8 shrink-0",
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
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [signupSuccessModalOpen, setSignupSuccessModalOpen] = useState(false);
  /** Step1에서 이미 다음으로 진행한 적 있으면 타이머 만료 시에도 재인증 불필요 */
  const [step1VerifiedOnce, setStep1VerifiedOnce] = useState(false);
  /** Step2에서 이미 다음으로 진행한 적 있으면 타이머 만료 시에도 재인증 불필요 */
  const [step2VerifiedOnce, setStep2VerifiedOnce] = useState(false);
  /** Step1 rate limit 등 필드와 분리된 하단 메시지 */
  const [step1BottomMessage, setStep1BottomMessage] = useState<string | null>(
    null,
  );
  /** Step2 rate limit 등 필드와 분리된 하단 메시지 */
  const [step2BottomMessage, setStep2BottomMessage] = useState<string | null>(
    null,
  );
  /** Step3 가입 요청 실패 메시지 */
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [signupSubmitting, setSignupSubmitting] = useState(false);

  const emailFns = useSignupEmailFns({
    setEmailError,
    setStep1BottomMessage,
    setCodeError,
  });
  const emailFlow = useVerificationCodeFlow({
    toastMessage: "이메일로 인증번호를 보냈어요",
    sendCodeFn: emailFns.sendCodeFn,
    verifyCodeFn: emailFns.verifyCodeFn,
  });
  const phoneFns = useSignupPhoneFns({
    setPhoneError,
    setStep2BottomMessage,
    setCodeError,
  });
  const phoneFlow = useVerificationCodeFlow({
    toastMessage: "휴대전화로 인증번호를 보냈어요",
    sendCodeFn: phoneFns.sendCodeFn,
    verifyCodeFn: phoneFns.verifyCodeFn,
  });

  const validateEmailBeforeVerify = () => {
    setEmailError(null);
    setCodeError(null);
    setStep1BottomMessage(null);
    if (!EMAIL_FORMAT_REGEX.test(email.trim())) {
      setEmailError("이메일 형식이 올바르지 않습니다");
      return false;
    }
    if (
      process.env.NODE_ENV === "development" &&
      email.trim().toLowerCase() === DEV_MOCK_ALREADY_REGISTERED_EMAIL
    ) {
      setEmailError("이미 가입된 이메일입니다");
      return false;
    }
    return true;
  };

  const handleEmailVerify = async () => {
    const canVerify = validateEmailBeforeVerify();
    if (!canVerify) return false;
    if (emailFlow.codeSent) {
      emailFlow.openResendConfirm();
      return true;
    }
    const sent = await emailFlow.doSendCode(email);
    return sent;
  };

  const handleEmailResendConfirm = async () => {
    const canVerify = validateEmailBeforeVerify();
    if (!canVerify) return;
    emailFlow.setResendConfirmModalOpen(false);
    await emailFlow.doSendCode(email);
  };

  const handleNextStep1 = async () => {
    if (emailFlow.code.length !== 6) return;
    setCodeError(null);
    if (step1VerifiedOnce) {
      setStep(2);
      return;
    }
    if (emailFlow.codeSent && emailFlow.codeValidityRemainingSeconds === 0) {
      setCodeError("인증번호가 만료되어 다시 요청해주세요");
      return;
    }
    const ok = await emailFlow.verifyCode(email, emailFlow.code);
    if (!ok) return;
    setStep1VerifiedOnce(true);
    setStep(2);
  };

  const validatePhoneBeforeVerify = () => {
    if (phone.replace(/\D/g, "").length < PHONE_MIN_LENGTH_FOR_VERIFY) {
      return false;
    }
    setPhoneError(null);
    setCodeError(null);
    setStep2BottomMessage(null);
    const digits = phone.replace(/\D/g, "");
    if (
      process.env.NODE_ENV === "development" &&
      digits === DEV_MOCK_ALREADY_REGISTERED_PHONE
    ) {
      setPhoneError("이미 가입된 휴대전화 번호입니다");
      return false;
    }
    return true;
  };

  const handlePhoneVerify = async () => {
    const canVerify = validatePhoneBeforeVerify();
    if (!canVerify) return false;
    if (phoneFlow.codeSent) {
      phoneFlow.openResendConfirm();
      return true;
    }
    const phoneE164 = toE164(phone.replace(/\D/g, ""));
    const sent = await phoneFlow.doSendCode(phoneE164);
    return sent;
  };

  const handlePhoneResendConfirm = async () => {
    const canVerify = validatePhoneBeforeVerify();
    if (!canVerify) return;
    phoneFlow.setResendConfirmModalOpen(false);
    const phoneE164 = toE164(phone.replace(/\D/g, ""));
    await phoneFlow.doSendCode(phoneE164);
  };

  const handleNextStep2 = async () => {
    if (phoneFlow.code.length !== 6) return;
    setCodeError(null);
    if (step2VerifiedOnce) {
      setStep(3);
      return;
    }
    if (phoneFlow.codeSent && phoneFlow.codeValidityRemainingSeconds === 0) {
      setCodeError("인증번호가 만료되어 다시 요청해주세요");
      return;
    }
    const phoneE164 = toE164(phone.replace(/\D/g, ""));
    const ok = await phoneFlow.verifyCode(phoneE164, phoneFlow.code);
    if (!ok) return;
    setStep2VerifiedOnce(true);
    setStep(3);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, "").slice(0, PHONE_MAX_LENGTH));
  };

  const handleStep3Complete = async (payload: { password: string }) => {
    setStep3Error(null);
    setSignupSubmitting(true);
    const emailVal = email.trim().toLowerCase();
    const phoneVal = toE164(phone.replace(/\D/g, ""));
    try {
      const availability = await checkAvailability({
        email: emailVal,
        phone: phoneVal,
      });
      const emailTaken = availability.emailAvailable === false;
      const phoneTaken = availability.phoneAvailable === false;
      if (emailTaken || phoneTaken) {
        const messages: string[] = [];
        if (emailTaken) messages.push("이미 가입된 이메일입니다");
        if (phoneTaken) messages.push("이미 가입된 휴대전화 번호입니다");
        setStep3Error(messages.join(" "));
        return;
      }
      // 셀러 영업 링크(/?ref=) 진입 시 localStorage에 저장된 referral_code 사용 (영업 링크 페이지 링크 형식 기준)
      const referralCode =
        typeof window !== "undefined"
          ? localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)?.trim()
          : undefined;
      await signup({
        email: emailVal,
        phone: phoneVal,
        password: payload.password,
        ...(referralCode && { referralCode }),
      });
      if (referralCode && typeof window !== "undefined") {
        localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
      }
      setSignupSuccessModalOpen(true);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "회원가입에 실패했어요. 잠시 후 다시 시도해주세요.";
      setStep3Error(message);
    } finally {
      setSignupSubmitting(false);
    }
  };

  const handleSignupSuccessLogin = () => {
    setSignupSuccessModalOpen(false);
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

      <Modal
        open={signupSuccessModalOpen}
        onOpenChange={(open) => !open && setSignupSuccessModalOpen(false)}
        title="가입이 완료됐어요"
        description={
          <div className="space-y-1">
            <p>이제 매장을 연동하고 리뷰를 관리할 수 있어요</p>
            <p>먼저 로그인을 진행해주세요</p>
          </div>
        }
        footer={
          <div className="flex w-full justify-center">
            <Button
              variant="primary"
              className="h-[38px] w-20 typo-body-02-bold"
              onClick={handleSignupSuccessLogin}
            >
              로그인
            </Button>
          </div>
        }
      />

      <main className="flex min-h-0 flex-1 flex-col justify-start overflow-auto p-4 md:justify-center md:items-center md:p-8">
        <div className="flex min-h-0 w-full max-w-[560px] flex-1 flex-col overflow-y-auto rounded-xl bg-gray-08 py-6 md:min-h-[680px] md:flex-none md:rounded-[20px] md:bg-white md:px-[50px] md:py-12">
          <h1 className="mb-5 typo-heading-01-bold text-gray-01 md:mb-6 md:text-[20px] md:leading-[1.32] md:tracking-[-0.03em]">
            가입에 필요한 정보를 입력해주세요
          </h1>
          <SignupStepIndicator currentStep={step} />

          <div className="flex min-h-0 flex-1 flex-col">
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
                  codeFieldLocked={step1VerifiedOnce}
                  bottomMessage={step1BottomMessage}
                  onVerify={handleEmailVerify}
                  onNext={handleNextStep1}
                />
              )}
              {step === 2 && (
                <SignupStep2
                  phone={phone}
                  onPhoneChange={handlePhoneChange}
                  phoneError={phoneError}
                  setPhoneError={setPhoneError}
                  codeError={codeError}
                  setCodeError={setCodeError}
                  phoneFlow={phoneFlow}
                  codeFieldLocked={step2VerifiedOnce}
                  bottomMessage={step2BottomMessage}
                  onVerify={handlePhoneVerify}
                  onNext={handleNextStep2}
                  onPrev={() => setStep(1)}
                />
              )}
              {step === 3 && (
                <SignupStep3
                  onPrev={() => setStep(2)}
                  onComplete={handleStep3Complete}
                  errorMessage={step3Error}
                  submitting={signupSubmitting}
                />
              )}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
