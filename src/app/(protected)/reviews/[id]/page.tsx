"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReviewIdRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reviews/manage");
  }, [router]);

  return <p className="p-8 text-muted-foreground">리뷰 관리로 이동 중…</p>;
}
