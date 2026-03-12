"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabLine } from "@/components/ui/tab-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { StoreLinkPrompt } from "@/components/store/StoreLinkPrompt";
import { LinkedStoreSelect } from "@/components/store/LinkedStoreSelect";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useToneSettings } from "@/entities/store/hooks/query/use-tone-settings";
import { useUpdateToneSettings } from "@/entities/store/hooks/mutation/use-update-tone-settings";
import {
  AI_SETTINGS_TABS,
  AI_TONE_OPTIONS,
  AI_LENGTH_OPTIONS,
  type AiSettingsTabValue,
} from "./constants";
import { cn } from "@/lib/utils/cn";

const TAB_PARAM = "tab";

/** 선택된 톤이 legacy(friendly/formal/casual)면 default로 표시/저장 */
function normalizeTone(tone: string): string {
  if (tone === "friendly" || tone === "formal" || tone === "casual")
    return "default";
  return tone;
}

export default function SettingsPageContent() {
  const searchParams = useSearchParams();
  const tab =
    (searchParams.get(TAB_PARAM) as AiSettingsTabValue) ?? "custom-ai";

  const { data: stores, isLoading: storesLoading } = useStoreList();
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const storeId = selectedStoreId || (stores?.[0]?.id ?? "");

  const { data: toneSettings, isLoading: toneLoading } = useToneSettings(
    storeId || null,
  );
  const updateTone = useUpdateToneSettings();

  const [tone, setTone] = useState("");
  const [length, setLength] = useState("");

  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  useEffect(() => {
    if (toneSettings === null) {
      setTone("");
      setLength("");
    } else if (toneSettings) {
      setTone(normalizeTone(toneSettings.tone));
      setLength(toneSettings.comment_length ?? "normal");
    }
  }, [toneSettings]);

  const setTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(TAB_PARAM, value);
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    [searchParams],
  );

  const handleSave = useCallback(() => {
    if (!storeId || !tone || !length) return;
    updateTone.mutate({
      storeId,
      tone,
      comment_length: length,
      extra_instruction: toneSettings?.extra_instruction ?? null,
    });
  }, [storeId, tone, length, toneSettings?.extra_instruction, updateTone]);

  const canSave = Boolean(storeId && tone && length);

  if (storesLoading) {
    return <ContentStateMessage variant="loading" message="로딩 중…" />;
  }

  const storeList = stores ?? [];
  if (storeList.length === 0) {
    return (
      <StoreLinkPrompt
        message="연동된 매장이 없습니다. 매장을 연동한 후 AI 댓글 설정을 이용해 주세요."
        linkHref="/manage/stores"
      />
    );
  }

  const effectiveStoreId = storeId || storeList[0].id;

  return (
    <div className="flex flex-col">
      <TabLine
        items={AI_SETTINGS_TABS.map((t) => ({
          value: t.value,
          label: t.label,
        }))}
        value={tab}
        onValueChange={setTab}
        direction="row"
        size="pc"
        className="mb-8"
      />

      {tab === "custom-ai" && (
        <CustomAiTab
          storeId={effectiveStoreId}
          storeList={storeList}
          selectedStoreId={selectedStoreId}
          onStoreChange={setSelectedStoreId}
          tone={tone}
          length={length}
          onToneChange={setTone}
          onLengthChange={setLength}
          toneLoading={toneLoading}
          onSave={handleSave}
          isSaving={updateTone.isPending}
          canSave={canSave}
        />
      )}

      {tab !== "custom-ai" && (
        <div className="typo-body-02-regular text-gray-04">준비 중입니다.</div>
      )}
    </div>
  );
}

/** 우리 가게 맞춤 AI 탭: 톤 카드 + 댓글 길이 + 저장 */
function CustomAiTab({
  storeId,
  storeList,
  selectedStoreId,
  onStoreChange,
  tone: effectiveTone,
  length: effectiveLength,
  onToneChange,
  onLengthChange,
  toneLoading,
  onSave,
  isSaving,
  canSave,
}: {
  storeId: string;
  storeList: { id: string; name: string }[];
  selectedStoreId: string;
  onStoreChange: (id: string) => void;
  tone: string;
  length: string;
  onToneChange: (tone: string) => void;
  onLengthChange: (length: string) => void;
  toneLoading: boolean;
  onSave: () => void;
  isSaving: boolean;
  canSave: boolean;
}) {
  return (
    <>
      {storeList.length > 1 && (
        <LinkedStoreSelect
          stores={storeList}
          value={(selectedStoreId || storeList[0]?.id) ?? ""}
          onChange={onStoreChange}
          label="매장"
          className="mb-6"
        />
      )}

      {/* AI 말투 */}
      <section className="mb-8">
        <h2 className="typo-body-01-bold mb-4 flex items-center gap-1.5 text-gray-01">
          AI 말투
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-01"
            aria-hidden
          />
        </h2>
        {toneLoading ? (
          <p className="typo-body-02-regular text-gray-04">설정 불러오는 중…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {AI_TONE_OPTIONS.map((opt) => {
              const selected = effectiveTone === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToneChange(opt.value)}
                  className={cn(
                    "flex w-full flex-col items-start gap-3 rounded-lg border p-5 text-left transition-colors bg-background",
                    selected
                      ? "border-main-02 bg-main-05"
                      : "border-gray-07 hover:border-gray-06",
                  )}
                >
                  <div className="flex w-full items-center gap-3">
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                        selected
                          ? "border-main-02 bg-main-02"
                          : "border-gray-06 bg-background",
                      )}
                      aria-hidden
                    >
                      {selected && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="typo-body-02-bold text-gray-01">
                      {opt.label}
                    </span>
                  </div>
                  <p className="typo-body-03-regular whitespace-pre-line text-gray-02">
                    {opt.description}
                  </p>
                  <div className="w-full">
                    <div className="rounded-lg border border-gray-07 px-4 py-5">
                      <p className="typo-body-03-bold mb-1.5 text-gray-03">
                        AI 추천 댓글
                      </p>
                      <p className="typo-body-03-regular text-gray-02 line-clamp-3">
                        {opt.example}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* AI 댓글 길이 */}
      <h2 className="typo-body-01-bold mb-4 flex items-center gap-1.5 text-gray-01">
        AI 댓글 길이
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-01"
          aria-hidden
        />
      </h2>
      <Card variant="default" padding="lg" className="mb-[160px]">
        <p className="typo-body-03-regular mb-2 text-gray-04">평균 글자 수</p>
        <p className="typo-body-03-regular mb-4 text-gray-04">
          설정한 글자 수 범위 안에서 자연스럽게 길이를 맞춰 생성해 드려요
        </p>
        <div className="flex flex-wrap gap-0 overflow-hidden rounded-lg border border-gray-07">
          {AI_LENGTH_OPTIONS.map((opt) => {
            const selected = effectiveLength === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onLengthChange(opt.value)}
                className={cn(
                  "flex-1 min-w-0 px-4 py-3 typo-body-03-bold transition-colors first:rounded-l-lg last:rounded-r-lg",
                  selected
                    ? "border-2 border-main-02 bg-main-05 text-gray-01"
                    : "bg-background text-gray-02 hover:bg-gray-08",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Card>

      <PageFixedBottomBar className="justify-between">
        <p className="typo-body-03-regular text-gray-04 sm:max-w-[480px]">
          사장님이 선택한 설정에 맞춰 AI가 댓글을 자동으로 만들어 드려요.
          <br />
          지금 저장하는 설정은 다음에 등록되는 리뷰부터 적용돼요.
        </p>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onSave}
          disabled={isSaving || !canSave}
          className="shrink-0 rounded-lg outline-main-02 hover:opacity-90"
        >
          {isSaving ? "저장 중…" : "저장하기"}
        </Button>
      </PageFixedBottomBar>
    </>
  );
}
