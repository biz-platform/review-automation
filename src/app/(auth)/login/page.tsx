"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase";
import { TextField } from "@/components/ui/text-field";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => {
    const r = searchParams.get("redirect");
    if (!r || !r.startsWith("/")) return "/";
    return r;
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailPlaceholder, setEmailPlaceholder] =
    useState("입력한 이메일은 아이디로 사용돼요");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const set = () =>
      setEmailPlaceholder(
        mq.matches
          ? "example@example.com"
          : "입력한 이메일은 아이디로 사용돼요",
      );
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      // 세션이 쿠키에 반영될 때까지 대기 (httpOnly면 document.cookie에 안 보이므로 짧은 고정 대기 포함)
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        const hasAuthCookie = document.cookie.includes("sb-");
        if (hasAuthCookie) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      await new Promise((r) => setTimeout(r, 100));
      window.location.href = redirectTo;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Modal
        open={!!error}
        onOpenChange={(open) => !open && setError(null)}
        title="로그인에 실패했어요"
        description={
          <>
            이메일 또는 비밀번호가 올바르지 않습니다.
            <br />
            다시 한번 확인해주세요.
          </>
        }
        footer={
          <Button
            type="button"
            variant="destructive"
            className="h-[38px] w-20 bg-red-02 text-sm outline-red-01"
            onClick={() => setError(null)}
          >
            확인
          </Button>
        }
        className="rounded-lg pb-[30px]"
      />

      <div className="flex flex-1 flex-col bg-white md:bg-gray-08">
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 md:p-8">
          <div
            className={cn(
              "w-full max-w-[320px] py-2",
              "md:max-w-[560px] md:w-[560px] md:min-h-[518px] md:overflow-hidden md:rounded-[20px] md:bg-white md:px-[50px] md:py-14 md:shadow-[0_4px_20px_0_rgba(0,0,0,0.08)]",
            )}
          >
            <h1 className="mb-6 text-center text-2xl font-bold leading-[1.32] tracking-[-0.03em] text-gray-01 md:mb-8 md:text-[32px]">
              로그인
            </h1>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-5 md:gap-6"
            >
              <TextField
                label="이메일"
                type="email"
                placeholder={emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full md:max-w-[460px]"
              />
              <PasswordField
                label="비밀번호"
                placeholder="비밀번호를 입력해주세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full md:max-w-[460px]"
              />
              <Button
                type="submit"
                disabled={loading}
                variant="primary"
                size="lg"
                fullWidth
                className="h-12 max-w-full rounded-lg bg-main-03 outline-main-02 md:h-[52px] md:max-w-[460px]"
              >
                {loading ? "처리 중…" : "로그인"}
              </Button>
            </form>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-gray-03 md:mt-8 md:gap-4 md:text-base">
              <Link href="/find-id" className="hover:text-gray-01">
                아이디 찾기
              </Link>
              <span className="text-gray-07" aria-hidden>
                |
              </span>
              <Link href="/find-password" className="hover:text-gray-01">
                비밀번호 찾기
              </Link>
              <span className="text-gray-07" aria-hidden>
                |
              </span>
              <Link href="/signup" className="hover:text-gray-01">
                회원가입
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function LoginPageFallback() {
  return (
    <div className="flex flex-1 flex-col bg-white md:bg-gray-08">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 md:p-8">
        <div
          className={cn(
            "w-full max-w-[320px] py-2",
            "md:max-w-[560px] md:w-[560px] md:min-h-[518px] md:overflow-hidden md:rounded-[20px] md:bg-white md:px-[50px] md:py-14 md:shadow-[0_4px_20px_0_rgba(0,0,0,0.08)]",
          )}
        >
          <div className="flex min-h-[200px] items-center justify-center text-gray-04">
            로딩 중…
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
