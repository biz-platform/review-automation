"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ManageSectionTabLine } from "@/app/(protected)/manage/ManageSectionTabLine";
import { Button } from "@/components/ui/button";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { AiSettingsFixedBottomBar } from "./AiSettingsFixedBottomBar";
import { StoreLinkPrompt } from "@/components/store/StoreLinkPrompt";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useToneSettings } from "@/entities/store/hooks/query/use-tone-settings";
import { useUpdateToneSettings } from "@/entities/store/hooks/mutation/use-update-tone-settings";
import { AI_SETTINGS_TABS, type AiSettingsTabValue } from "./constants";
import { CustomAiTab } from "./CustomAiTab";
import { CommentRegisterTab } from "./CommentRegisterTab";
import { StoreInfoTab } from "./StoreInfoTab";
import { MarketingTab } from "./MarketingTab";

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
  const [commentRegisterMode, setCommentRegisterMode] = useState<
    "direct" | "auto"
  >("direct");
  const [autoRegisterScheduledHour, setAutoRegisterScheduledHour] =
    useState<number>(18);
  const [industry, setIndustry] = useState("");
  const [customerSegment, setCustomerSegment] = useState("");

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
      setCommentRegisterMode("direct");
      setAutoRegisterScheduledHour(18);
      setIndustry("");
      setCustomerSegment("");
    } else if (toneSettings) {
      setTone(normalizeTone(toneSettings.tone));
      const hasExtra = (toneSettings.extra_instruction ?? "").trim().length > 0;
      const lengthValue = toneSettings.comment_length ?? "normal";
      setLength(hasExtra && lengthValue === "long" ? "normal" : lengthValue);
      setMarketingText(toneSettings.extra_instruction ?? "");
      setCommentRegisterMode(
        toneSettings.comment_register_mode === "auto" ? "auto" : "direct",
      );
      setAutoRegisterScheduledHour(
        toneSettings.auto_register_scheduled_hour ?? 18,
      );
      setIndustry(toneSettings.industry ?? "");
      setCustomerSegment(toneSettings.customer_segment ?? "");
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
    const hasMarketing = marketingText.trim().length > 0;
    updateTone.mutate({
      storeId,
      tone,
      comment_length: hasMarketing && length === "long" ? "normal" : length,
      extra_instruction: marketingText.trim() || null,
      comment_register_mode: commentRegisterMode,
      auto_register_scheduled_hour:
        commentRegisterMode === "auto" ? autoRegisterScheduledHour : null,
      industry: industry.trim() || null,
      customer_segment: customerSegment.trim() || null,
    });
  }, [
    storeId,
    tone,
    length,
    marketingText,
    commentRegisterMode,
    autoRegisterScheduledHour,
    industry,
    customerSegment,
    updateTone,
  ]);

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
            hasMarketingText={marketingText.trim().length > 0}
          />
        )}

        {tab === "comment-register" && (
          <CommentRegisterTab
            mode={commentRegisterMode}
            onModeChange={setCommentRegisterMode}
            scheduledHour={autoRegisterScheduledHour}
            onScheduledHourChange={setAutoRegisterScheduledHour}
          />
        )}

        {tab === "store-info" && (
          <StoreInfoTab
            industry={industry}
            customerSegment={customerSegment}
            onIndustryChange={setIndustry}
            onCustomerSegmentChange={setCustomerSegment}
          />
        )}

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
