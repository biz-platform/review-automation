"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useStore } from "@/entities/store/hooks/query/use-store";
import { pollBrowserJob } from "@/lib/poll-browser-job";

const PLATFORMS = [
  { id: "baemin", label: "배달의민족", ready: true },
  { id: "coupang_eats", label: "쿠팡이츠", ready: true },
  { id: "yogiyo", label: "요기요", ready: true },
  { id: "ddangyo", label: "땡겨요", ready: true },
  { id: "naver", label: "네이버", ready: false },
];

export default function StoreAccountsPage() {
  const params = useParams();
  const storeId = params.id as string;
  const searchParams = useSearchParams();
  const platformFromQuery = searchParams.get("platform") ?? "";
  const { data: store, isLoading, error } = useStore(storeId);

  const [selectedPlatform, setSelectedPlatform] = useState("baemin");
  useEffect(() => {
    if (
      platformFromQuery &&
      PLATFORMS.some((p) => p.id === platformFromQuery)
    ) {
      setSelectedPlatform(platformFromQuery);
    }
  }, [platformFromQuery]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const current = PLATFORMS.find((p) => p.id === selectedPlatform);

  async function handleLinkBaemin() {
    if (!username.trim() || !password) {
      setLinkError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    setLinkError(null);
    setLinking(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/platforms/baemin/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { jobId?: string; detail?: string; message?: string };
      if (res.status === 202 && data.jobId) {
        const job = await pollBrowserJob(storeId, data.jobId);
        if (job.status === "failed") throw new Error(job.error_message ?? "연동 실패");
        setLinkSuccess(true);
        setPassword("");
        fetch(`/api/stores/${storeId}/platforms/baemin/reviews/sync`, { method: "POST", credentials: "same-origin" }).catch(() => {});
        return;
      }
      if (!res.ok) throw new Error(data.detail ?? data.message ?? "연동 실패");
      setLinkSuccess(true);
      setPassword("");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "연동에 실패했습니다.");
    } finally {
      setLinking(false);
    }
  }

  async function handleLinkCoupangEats() {
    if (!username.trim() || !password) {
      setLinkError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    setLinkError(null);
    setLinking(true);
    try {
      const res = await fetch(
        `/api/stores/${storeId}/platforms/coupang-eats/link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ username: username.trim(), password }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { jobId?: string; detail?: string; message?: string };
      if (res.status === 202 && data.jobId) {
        const job = await pollBrowserJob(storeId, data.jobId);
        if (job.status === "failed") throw new Error(job.error_message ?? "연동 실패");
        setLinkSuccess(true);
        setPassword("");
        fetch(`/api/stores/${storeId}/platforms/coupang-eats/reviews/sync`, { method: "POST", credentials: "same-origin" }).catch(() => {});
        return;
      }
      if (!res.ok) throw new Error(data.detail ?? data.message ?? "연동 실패");
      setLinkSuccess(true);
      setPassword("");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "연동에 실패했습니다.");
    } finally {
      setLinking(false);
    }
  }

  async function handleLinkYogiyo() {
    if (!username.trim() || !password) {
      setLinkError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    setLinkError(null);
    setLinking(true);
    try {
      const res = await fetch(
        `/api/stores/${storeId}/platforms/yogiyo/link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ username: username.trim(), password }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { jobId?: string; detail?: string; message?: string };
      if (res.status === 202 && data.jobId) {
        const job = await pollBrowserJob(storeId, data.jobId);
        if (job.status === "failed") throw new Error(job.error_message ?? "연동 실패");
        setLinkSuccess(true);
        setPassword("");
        fetch(`/api/stores/${storeId}/platforms/yogiyo/reviews/sync`, { method: "POST", credentials: "same-origin" }).catch(() => {});
        return;
      }
      if (!res.ok) throw new Error(data.detail ?? data.message ?? "연동 실패");
      setLinkSuccess(true);
      setPassword("");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "연동에 실패했습니다.");
    } finally {
      setLinking(false);
    }
  }

  async function handleLinkDdangyo() {
    if (!username.trim() || !password) {
      setLinkError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    setLinkError(null);
    setLinking(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/platforms/ddangyo/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { jobId?: string; detail?: string; message?: string };
      if (res.status === 202 && data.jobId) {
        const job = await pollBrowserJob(storeId, data.jobId);
        if (job.status === "failed") throw new Error(job.error_message ?? "연동 실패");
        setLinkSuccess(true);
        setPassword("");
        fetch(`/api/stores/${storeId}/platforms/ddangyo/reviews/sync`, { method: "POST", credentials: "same-origin" }).catch(() => {});
        return;
      }
      if (!res.ok) throw new Error(data.detail ?? data.message ?? "연동 실패");
      setLinkSuccess(true);
      setPassword("");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "연동에 실패했습니다.");
    } finally {
      setLinking(false);
    }
  }

  if (isLoading) return <p className="p-8">로딩 중…</p>;
  if (error || !store)
    return <p className="p-8 text-red-600">매장을 찾을 수 없습니다.</p>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/stores" className="text-muted-foreground hover:underline">
          ← 매장 목록
        </Link>
        <Link
          href={`/stores/${storeId}`}
          className="text-muted-foreground hover:underline"
        >
          {store.name}
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold">계정 설정</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedPlatform(p.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              selectedPlatform === p.id
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {current?.id === "baemin" && current.ready && (
        <section className="max-w-md rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-bold">
            배달의민족 (self.baemin.com) 연동
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            사장님 계정으로 로그인하면 리뷰 수집·관리에 사용할 세션을
            저장합니다.
          </p>
          {linkSuccess && (
            <p className="mb-4 text-sm text-green-600">
              연동되었습니다. 리뷰를 백그라운드에서 불러오는 중입니다 (1~2분
              소요). 리뷰 관리에서 확인하세요.
            </p>
          )}
          {linkError && (
            <p className="mb-4 text-sm text-red-600">{linkError}</p>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">아이디</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="배민 사장님 아이디"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={handleLinkBaemin}
              disabled={linking}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {linking ? "연동 중…" : "연동하기(로그인)"}
            </button>
          </div>
        </section>
      )}

      {current?.id === "coupang_eats" && current.ready && (
        <section className="max-w-md rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-bold">
            쿠팡이츠 (store.coupangeats.com) 연동
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            쿠팡이츠 스토어 계정으로 로그인하면 리뷰 수집·관리에 사용할 세션을
            저장합니다.
          </p>
          {linkSuccess && (
            <p className="mb-4 text-sm text-green-600">
              연동되었습니다. 리뷰를 불러오는 중입니다. 리뷰 관리에서
              확인하세요.
            </p>
          )}
          {linkError && (
            <p className="mb-4 text-sm text-red-600">{linkError}</p>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">아이디</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="쿠팡이츠 스토어 아이디"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 (영문+숫자+특수문자, 8~15자)"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={handleLinkCoupangEats}
              disabled={linking}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {linking ? "연동 중…" : "연동하기(로그인)"}
            </button>
          </div>
        </section>
      )}

      {current?.id === "yogiyo" && current.ready && (
        <section className="max-w-md rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-bold">
            요기요 (ceo.yogiyo.co.kr) 연동
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            요기요 사장님 사이트 계정으로 로그인하면 리뷰 수집·관리에 사용할
            세션(vendor id·토큰)을 저장합니다.
          </p>
          {linkSuccess && (
            <p className="mb-4 text-sm text-green-600">
              연동되었습니다. 리뷰를 불러오는 중입니다. 리뷰 관리에서
              확인하세요.
            </p>
          )}
          {linkError && (
            <p className="mb-4 text-sm text-red-600">{linkError}</p>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">아이디</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="원아이디 (예: yogiyo99)"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={handleLinkYogiyo}
              disabled={linking}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {linking ? "연동 중…" : "연동하기(로그인)"}
            </button>
          </div>
        </section>
      )}

      {current?.id === "ddangyo" && current.ready && (
        <section className="max-w-md rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-bold">
            땡겨요 (boss.ddangyo.com) 연동
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            땡겨요 사장님라운지 계정으로 로그인하면 리뷰 수집·관리에 사용할
            세션(patsto_no)을 저장합니다.
          </p>
          {linkSuccess && (
            <p className="mb-4 text-sm text-green-600">
              연동되었습니다. 리뷰를 불러오는 중입니다. 리뷰 관리에서
              확인하세요.
            </p>
          )}
          {linkError && (
            <p className="mb-4 text-sm text-red-600">{linkError}</p>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">아이디</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디 또는 사업자등록번호"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-md border border-border px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={handleLinkDdangyo}
              disabled={linking}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {linking ? "연동 중…" : "연동하기(로그인)"}
            </button>
          </div>
        </section>
      )}

      {current && !current.ready && (
        <p className="text-muted-foreground">
          {current.label} 연동은 준비 중입니다.
        </p>
      )}
    </div>
  );
}
