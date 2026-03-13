"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManageSectionTabLine } from "@/app/(protected)/manage/ManageSectionTabLine";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { AiSettingsFixedBottomBar } from "./AiSettingsFixedBottomBar";
import { StoreLinkPrompt } from "@/components/store/StoreLinkPrompt";
import { Tooltip } from "@/components/ui/tooltip";
import { NativeSelect } from "@/components/ui/native-select";
import { TextField } from "@/components/ui/text-field";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useToneSettings } from "@/entities/store/hooks/query/use-tone-settings";
import { useUpdateToneSettings } from "@/entities/store/hooks/mutation/use-update-tone-settings";
import {
  AI_SETTINGS_TABS,
  AI_TONE_OPTIONS,
  AI_LENGTH_OPTIONS,
  COMMENT_REGISTER_OPTIONS,
  MARKETING_TEXT_MAX_LENGTH,
  MARKETING_MAX_LENGTH_CHARS,
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
  const [marketingText, setMarketingText] = useState("");

  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, selectedStoreId]);

  useEffect(() => {
    if (toneSettings === null) {
      setTone("");
      setLength("");
      setMarketingText("");
    } else if (toneSettings) {
      setTone(normalizeTone(toneSettings.tone));
      setLength(toneSettings.comment_length ?? "normal");
      setMarketingText(toneSettings.extra_instruction ?? "");
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
      extra_instruction: marketingText.trim() || null,
    });
  }, [storeId, tone, length, marketingText, updateTone]);

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

  const tabLineItems = AI_SETTINGS_TABS.map((t) => ({
    value: t.value,
    label: t.label,
  }));
  const tabLineItemsMobile = AI_SETTINGS_TABS.map((t) => ({
    value: t.value,
    label: "mobileLabel" in t && t.mobileLabel ? t.mobileLabel : t.label,
  }));

  const bottomBarDescription = (
    <p className="hidden md:block typo-body-03-regular text-gray-04 sm:max-w-[480px]">
      사장님이 선택한 설정에 맞춰 AI가 댓글을 자동으로 만들어 드려요.
      <br />
      지금 저장하는 설정은 다음에 등록되는 리뷰부터 적용돼요.
    </p>
  );

  return (
    <div className="flex flex-col pb-[80px]">
      {/* AI 댓글 설정: 우리 가게 맞춤 AI | 댓글 등록 | … — 스타일 공통화 */}
      <ManageSectionTabLine
        items={tabLineItems}
        itemsMobile={tabLineItemsMobile}
        value={tab}
        onValueChange={setTab}
      />
      <div className="pt-10">
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
          />
        )}

        {tab === "comment-register" && <CommentRegisterTab />}

        {tab === "store-info" && <StoreInfoTab />}

        {tab === "marketing" && (
          <MarketingTab
            storeId={effectiveStoreId}
            marketingText={marketingText}
            onMarketingTextChange={setMarketingText}
            length={length}
            onLengthChange={setLength}
          />
        )}

        {tab !== "custom-ai" &&
          tab !== "comment-register" &&
          tab !== "store-info" &&
          tab !== "marketing" && (
            <div className="typo-body-02-regular text-gray-04">
              준비 중입니다.
            </div>
          )}

        {/* 모든 탭 공통 하단 고정 바 */}
        <AiSettingsFixedBottomBar>
          {bottomBarDescription}
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={updateTone.isPending || !canSave}
            className="shrink-0 rounded-lg outline-main-02 hover:opacity-90 flex-1 md:flex-none"
          >
            {updateTone.isPending ? "저장 중…" : "저장하기"}
          </Button>
        </AiSettingsFixedBottomBar>
      </div>
    </div>
  );
}

/** 마케팅 탭: 마케팅 설정 텍스트(최대 100자) + 댓글 길이 선택. 마케팅 문구 입력 시 댓글 길이 최대 200자로 제한·자동 전환 (Figma 202-3094, 213-3255). 모바일 툴팁 미노출. 저장은 상단 공통 하단 바 사용 */
function MarketingTab({
  storeId: _storeId,
  marketingText,
  onMarketingTextChange,
  length,
  onLengthChange,
}: {
  storeId: string;
  marketingText: string;
  onMarketingTextChange: (v: string) => void;
  length: string;
  onLengthChange: (v: string) => void;
}) {
  const hasMarketingText = marketingText.trim().length > 0;
  const lengthOptions = hasMarketingText
    ? AI_LENGTH_OPTIONS.filter(
        (o) => o.value === "short" || o.value === "normal",
      )
    : AI_LENGTH_OPTIONS;

  useEffect(() => {
    if (hasMarketingText && length === "long") {
      onLengthChange("normal");
    }
  }, [hasMarketingText, length, onLengthChange]);

  return (
    <>
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h1 className="typo-heading-02-bold text-gray-01">댓글 마케팅</h1>
          <p className="typo-body-03-regular text-gray-04">
            리뷰 마지막에 공통으로 추가되는 문구로, 리뷰를 마케팅 창구처럼
            활용할 수 있어요
            <br />
            신메뉴 출시, 이벤트, 할인 소식 등 고객에게 알리고 싶은 내용을
            적어보세요
          </p>
        </div>
        <TextField
          label="마케팅 문구"
          placeholder="최대 100자까지 입력할 수 있어요. 예) 3월 한 달간 신메뉴 딸기라떼 30% 할인 중이에요"
          value={marketingText}
          onChange={(e) =>
            onMarketingTextChange(
              e.target.value.slice(0, MARKETING_TEXT_MAX_LENGTH),
            )
          }
          maxLength={MARKETING_TEXT_MAX_LENGTH}
          trailingAddon={
            <span
              className={cn(
                "typo-body-02-regular",
                marketingText.length >= MARKETING_TEXT_MAX_LENGTH
                  ? "text-red-600"
                  : "text-gray-05",
              )}
            >
              {marketingText.length}자
            </span>
          }
          className="mb-0"
        />
      </section>
    </>
  );
}

/** 매장 정보 탭: 댓글 작성 정보 (업종, 주요 고객층) — Figma 202-2694, 213-3142. 모바일에서 툴팁 미노출 */
function StoreInfoTab() {
  const [industry, setIndustry] = useState("");
  const [customerSegment, setCustomerSegment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    // TODO: API 연동 시 저장 로직
    setTimeout(() => setIsSaving(false), 500);
  }, []);

  return (
    <>
      <section className="mb-8">
        <h2 className="typo-body-01-bold mb-2 text-gray-01">댓글 작성 정보</h2>
        <p className="typo-body-02-regular mb-6 text-gray-04">
          입력하면 AI가 더 정확하게 댓글을 작성할 수 있어요
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <TextField
            label="업종"
            placeholder="업종을 입력해주세요 예) 소고기, 해산물, 카페"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mb-0"
          />
          <TextField
            label="주요 고객층"
            placeholder="가게의 특징을 간단하게 적어주세요 예) 직장인 점심, 가성비, 프리미엄"
            value={customerSegment}
            onChange={(e) => setCustomerSegment(e.target.value)}
            className="mb-0"
          />
        </div>
      </section>
    </>
  );
}

/** 댓글 등록 탭: [토글] 댓글 자동 등록 — 직접 등록 / 자동 등록 (Figma 202-2391, 213-2945). 기본값 직접 등록 */
function CommentRegisterTab() {
  const [mode, setMode] = useState<"direct" | "auto">("direct");

  return (
    <div className="rounded-lg border border-gray-07 p-5">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <h3 className="typo-body-01-bold text-gray-01">리뷰 자동 댓글</h3>
          <p className="typo-body-02-regular text-gray-04">
            답변하지 않은 리뷰에 댓글을 자동으로 등록해요
          </p>
        </div>
        <div className="flex">
          {COMMENT_REGISTER_OPTIONS.map((opt, index) => {
            const selected = mode === opt.value;
            const isFirst = index === 0;
            const isLast = index === COMMENT_REGISTER_OPTIONS.length - 1;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value as "direct" | "auto")}
                className={cn(
                  "flex flex-1 items-center justify-center px-4 py-3 typo-body-02-regular text-gray-01 transition-colors",
                  isFirst && "rounded-l-lg border border-gray-07 border-r-0",
                  isLast && "-ml-px rounded-r-lg border border-gray-07",
                  selected && "border-main-02 bg-main-05",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
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
}) {
  const selectedId = (selectedStoreId || storeList[0]?.id) ?? "";
  const selectedStore = storeList.find((s) => s.id === selectedId);

  return (
    <>
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
                    "flex w-full flex-row items-stretch gap-5 rounded-lg border px-4 py-5 text-left transition-colors bg-background",
                    selected
                      ? "border-main-02 bg-main-05"
                      : "border-gray-07 hover:border-gray-06",
                  )}
                >
                  {/* 체크 아이콘: Figma 102-3952 — 왼쪽 고정, 오른쪽 콘텐츠와 20px gap */}
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5",
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
                  {/* 기본 말투와 동일 세로 라인에 설명·AI 카드 들여쓰기 */}
                  <div className="flex min-w-0 flex-1 flex-col items-stretch gap-5">
                    <div className="flex flex-col gap-3">
                      <span className="typo-body-01-bold text-gray-01">
                        {opt.label}
                      </span>
                      <p className="typo-body-02-regular whitespace-pre-line text-gray-02">
                        {opt.description}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-07 bg-white px-4 py-5">
                      <p className="typo-body-03-bold mb-2 text-gray-04">
                        AI 추천 댓글
                      </p>
                      <p className="typo-body-02-regular text-gray-02 line-clamp-3">
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
      <Card variant="default" padding="lg" className="mb-[100px]">
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
    </>
  );
}

function InfoIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.25 13h1.5a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.75 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}
