"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/entities/store/hooks/query/use-store";
import { useToneSettings } from "@/entities/store/hooks/query/use-tone-settings";
import { useUpdateStore } from "@/entities/store/hooks/mutation/use-update-store";
import { useDeleteStore } from "@/entities/store/hooks/mutation/use-delete-store";
import { useUpdateToneSettings } from "@/entities/store/hooks/mutation/use-update-tone-settings";

export default function StoreDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: store, isLoading, error } = useStore(id);
  const { data: toneSettings } = useToneSettings(id);
  const updateStore = useUpdateStore();
  const deleteStore = useDeleteStore();
  const updateTone = useUpdateToneSettings();

  const [editName, setEditName] = useState("");
  const [tone, setTone] = useState("");
  const [extraInstruction, setExtraInstruction] = useState("");

  if (isLoading) return <p className="p-8">로딩 중…</p>;
  if (error || !store) return <p className="p-8 text-red-600">매장을 찾을 수 없습니다.</p>;

  const currentName = editName || store.name;
  const currentTone = tone || toneSettings?.tone || "friendly";
  const currentExtra = extraInstruction || toneSettings?.extra_instruction || "";

  async function handleUpdateStore(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateStore.mutateAsync({ id, name: currentName });
      setEditName("");
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUpdateTone(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateTone.mutateAsync({
        storeId: id,
        tone: currentTone,
        extra_instruction: currentExtra || null,
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteStore.mutateAsync({ id });
      router.push("/stores");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/stores" className="text-muted-foreground hover:underline">
          ← 목록
        </Link>
        <Link
          href={`/stores/${id}/reviews`}
          className="rounded-md border border-border px-4 py-2"
        >
          리뷰 목록
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold">매장 정보</h2>
        <form onSubmit={handleUpdateStore} className="max-w-md space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">매장명</span>
            <input
              type="text"
              value={currentName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={updateStore.isPending}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            저장
          </button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold">말투 설정</h2>
        <form onSubmit={handleUpdateTone} className="max-w-md space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">말투</span>
            <select
              value={currentTone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2"
            >
              <option value="friendly">친근한</option>
              <option value="formal">정중한</option>
              <option value="casual">캐주얼</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">추가 지침</span>
            <textarea
              value={currentExtra}
              onChange={(e) => setExtraInstruction(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={updateTone.isPending}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            말투 저장
          </button>
        </form>
      </section>

      <button
        type="button"
        onClick={handleDelete}
        className="rounded-md border border-red-600 text-red-600 hover:bg-red-50"
      >
        매장 삭제
      </button>
    </div>
  );
}
