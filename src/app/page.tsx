import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Review Automation</h1>
      <Link
        href="/login"
        className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-[hsl(var(--primary-foreground))]"
      >
        로그인
      </Link>
      <Link
        href="/stores"
        className="rounded-md border px-4 py-2"
      >
        매장 목록 (보호)
      </Link>
    </main>
  );
}
