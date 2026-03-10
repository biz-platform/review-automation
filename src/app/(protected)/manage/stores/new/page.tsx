"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateStore } from "@/entities/store/hooks/mutation/use-create-store";
import { Button } from "@/components/ui/button";

export default function NewStorePage() {
  const [name, setName] = useState("");
  const router = useRouter();
  const createStore = useCreateStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createStore.mutateAsync({ name });
      router.push("/manage/stores");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">매장 등록</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">매장명</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-border px-3 py-2"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={createStore.isPending}>
            {createStore.isPending ? "저장 중…" : "저장"}
          </Button>
          <Link
            href="/manage/stores"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm hover:bg-muted"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
