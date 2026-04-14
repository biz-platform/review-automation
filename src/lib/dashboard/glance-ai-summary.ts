import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_DASHBOARD_GLANCE_MAX_OUTPUT_TOKENS,
  GEMINI_DASHBOARD_GLANCE_MODEL,
  GEMINI_DASHBOARD_GLANCE_THINKING_BUDGET,
  getGeminiApiKeyFromEnv,
} from "@/lib/config/gemini-dashboard-glance";
import {
  DASHBOARD_GLANCE_SYSTEM_PROMPT,
  buildDashboardGlanceInsightUserPrompt,
  type DashboardGlanceScenario,
} from "@/lib/prompts/dashboard-glance-insight-prompts";

type PlatformKey = "baemin" | "coupang_eats" | "yogiyo" | "ddangyo";

export type GlanceAiSummaryArgs = {
  range: "7d" | "30d";
  currentStartYmd: string;
  currentEndYmd: string;
  curr: {
    totalReviews: number;
    avgRating: number | null;
    orderCount: number;
  };
  prev: {
    totalReviews: number;
    avgRating: number | null;
    orderCount: number;
  };
  platformBreakdown: {
    platform: PlatformKey;
    avgRating: number | null;
    tastyRatioPercent: number | null;
    reviewCount: number;
  }[];
};

function safePercentDelta(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function classifyScenario(args: {
  reviewDeltaPercent: number | null;
  orderDeltaPercent: number | null;
  ratingDeltaPoints: number | null;
  ddangyoTastyRatioPercent: number | null;
}): DashboardGlanceScenario {
  const pos = (x: number | null) => x != null && x > 5;
  const neg = (x: number | null) => x != null && x < -5;

  // 평점은 %가 아니라 "점" 단위로 들어오므로, 5점 만점 기준 5% = 0.25점으로 해석
  const ratingDeltaPercentLike =
    args.ratingDeltaPoints != null ? (args.ratingDeltaPoints / 5) * 100 : null;

  const scoreSignals = [args.reviewDeltaPercent, args.orderDeltaPercent, ratingDeltaPercentLike];

  const posCount = scoreSignals.filter(pos).length;
  const negCount = scoreSignals.filter(neg).length;

  // 땡겨요는 별점 대신 만족도로 해석
  const ddPos = args.ddangyoTastyRatioPercent != null
    ? args.ddangyoTastyRatioPercent >= 80
    : false;
  const ddNeg = args.ddangyoTastyRatioPercent != null
    ? args.ddangyoTastyRatioPercent < 60
    : false;

  if (posCount >= 2 || (posCount >= 1 && ddPos)) return "positive";
  if (negCount >= 2 || (negCount >= 1 && ddNeg)) return "negative";
  if ((posCount >= 1 || ddPos) && (negCount >= 1 || ddNeg)) return "mixed";
  return "flat";
}

function scenarioToKorean(s: DashboardGlanceScenario): "긍정" | "부정" | "혼재" | "유지" {
  if (s === "positive") return "긍정";
  if (s === "negative") return "부정";
  if (s === "mixed") return "혼재";
  return "유지";
}

function platformCounts(platformBreakdown: GlanceAiSummaryArgs["platformBreakdown"]) {
  const by: Record<PlatformKey, { reviewCount: number; avgRating: number | null; tastyRatioPercent: number | null }> =
    {
      baemin: { reviewCount: 0, avgRating: null, tastyRatioPercent: null },
      coupang_eats: { reviewCount: 0, avgRating: null, tastyRatioPercent: null },
      yogiyo: { reviewCount: 0, avgRating: null, tastyRatioPercent: null },
      ddangyo: { reviewCount: 0, avgRating: null, tastyRatioPercent: null },
    };

  for (const p of platformBreakdown) {
    by[p.platform] = {
      reviewCount: p.reviewCount,
      avgRating: p.avgRating,
      tastyRatioPercent: p.tastyRatioPercent,
    };
  }
  return by;
}

function platformKoName(p: PlatformKey): string {
  if (p === "baemin") return "배달의민족";
  if (p === "coupang_eats") return "쿠팡이츠";
  if (p === "yogiyo") return "요기요";
  return "땡겨요";
}

function formatDeltaPointsKorean(args: {
  periodWord: string;
  deltaPoints: number;
  currentPoints: number;
}): string {
  const { periodWord, deltaPoints, currentPoints } = args;
  if (Math.abs(deltaPoints) < 0.05) {
    return `${periodWord} 비슷하게 ${currentPoints.toFixed(1)}점이에요`;
  }
  const up = deltaPoints > 0;
  return `${periodWord} ${Math.abs(deltaPoints).toFixed(1)}점 ${
    up ? "올라" : "내려"
  } ${currentPoints.toFixed(1)}점이에요`;
}

function formatDeltaPercentKorean(args: {
  periodWord: string;
  deltaPercent: number;
  currentCount: number;
}): string {
  const { periodWord, deltaPercent, currentCount } = args;
  if (Math.abs(deltaPercent) < 0.05) {
    return `${currentCount}건(${periodWord} 비슷한 수준)`;
  }
  return `${currentCount}건(${periodWord} ${deltaPercent > 0 ? "+" : "-"}${Math.abs(deltaPercent).toFixed(1)}%)`;
}

function splitSentencesKorean(text: string): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  const flattened = raw.replace(/\r\n/g, "\n").replace(/\n+/g, " ").trim();
  if (!flattened) return [];
  return flattened
    .split(/(?<=[.!?。！？])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function enforceTwoLines(text: string): string | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  // 1) 이미 2줄 이상이면 앞 2줄만 사용
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) return `${lines[0]}\n${lines[1]}`;

  // 2) 줄바꿈 없이 문장 분리
  const sents = splitSentencesKorean(raw);
  if (sents.length >= 2) return `${sents[0]}\n${sents[1]}`;
  return null;
}

export function buildGlanceInsightByRules(args: GlanceAiSummaryArgs): string {
  const periodWord = args.range === "7d" ? "지난주 대비" : "지난달 대비";
  const rangeWord = args.range === "7d" ? "이번 주" : "이번 달";
  const reviewDeltaCount = args.curr.totalReviews - args.prev.totalReviews;
  const ratingDeltaPoints =
    args.curr.avgRating != null && args.prev.avgRating != null
      ? Math.round((args.curr.avgRating - args.prev.avgRating) * 10) / 10
      : null;

  const orderDeltaPercentRaw = safePercentDelta(
    args.curr.orderCount,
    args.prev.orderCount,
  );
  const orderDeltaPercent =
    orderDeltaPercentRaw != null
      ? Math.round(orderDeltaPercentRaw * 10) / 10
      : null;

  const reviewDeltaPercentRaw = safePercentDelta(
    args.curr.totalReviews,
    args.prev.totalReviews,
  );
  const reviewDeltaPercent =
    reviewDeltaPercentRaw != null
      ? Math.round(reviewDeltaPercentRaw * 10) / 10
      : null;

  const counts = platformCounts(args.platformBreakdown);
  const ddTasty = counts.ddangyo.tastyRatioPercent;

  const scenario = classifyScenario({
    reviewDeltaPercent,
    orderDeltaPercent,
    ratingDeltaPoints,
    ddangyoTastyRatioPercent: ddTasty,
  });

  // "가장 눈에 띄는 변화 1개" 선정: 혼재는 긍정(증가) 수치를 우선
  const ratingScore =
    ratingDeltaPoints != null ? (Math.abs(ratingDeltaPoints) / 5) * 100 : -1;
  const reviewScore =
    reviewDeltaPercent != null ? Math.abs(reviewDeltaPercent) : -1;
  const orderScore = orderDeltaPercent != null ? Math.abs(orderDeltaPercent) : -1;

  type Lead =
    | { kind: "orders"; score: number; sign: -1 | 0 | 1 }
    | { kind: "reviews"; score: number; sign: -1 | 0 | 1 }
    | { kind: "rating"; score: number; sign: -1 | 0 | 1 };

  const leadCandidates = ([
    {
      kind: "orders",
      score: orderScore,
      sign:
        orderDeltaPercent == null ? 0 : orderDeltaPercent > 0 ? 1 : orderDeltaPercent < 0 ? -1 : 0,
    },
    {
      kind: "reviews",
      score: reviewScore,
      sign: reviewDeltaCount > 0 ? 1 : reviewDeltaCount < 0 ? -1 : 0,
    },
    {
      kind: "rating",
      score: ratingScore,
      sign:
        ratingDeltaPoints == null ? 0 : ratingDeltaPoints > 0 ? 1 : ratingDeltaPoints < 0 ? -1 : 0,
    },
  ] satisfies Lead[]).slice();

  const lead =
    scenario === "mixed"
      ? leadCandidates
          .filter((c) => c.sign > 0)
          .sort((a, b) => b.score - a.score)[0] ??
        leadCandidates.sort((a, b) => b.score - a.score)[0]
      : leadCandidates.sort((a, b) => b.score - a.score)[0];

  const first = (() => {
    if (lead.kind === "orders" && orderDeltaPercent != null) {
      if (Math.abs(orderDeltaPercent) < 0.05) {
        return `${rangeWord} 주문 수가 ${periodWord} 비슷하게 ${args.curr.orderCount}건이었어요.`;
      }
      const up = orderDeltaPercent > 0;
      return `${rangeWord} 주문 수가 ${periodWord} ${Math.abs(orderDeltaPercent).toFixed(1)}% ${
        up ? "늘어" : "줄어"
      } ${args.curr.orderCount}건이었어요.`;
    }
    if (
      lead.kind === "rating" &&
      ratingDeltaPoints != null &&
      args.curr.avgRating != null
    ) {
      if (Math.abs(ratingDeltaPoints) < 0.05) {
        return `${rangeWord} 평균 평점이 ${periodWord} 비슷하게 ${args.curr.avgRating.toFixed(1)}점이었어요.`;
      }
      const up = ratingDeltaPoints > 0;
      return `${rangeWord} 평균 평점이 ${periodWord} ${Math.abs(ratingDeltaPoints).toFixed(1)}점 ${
        up ? "올라" : "내려"
      } ${args.curr.avgRating.toFixed(1)}점을 기록했어요.`;
    }
    return `${rangeWord} 리뷰 수가 ${periodWord} ${Math.abs(reviewDeltaCount)}건 ${reviewDeltaCount >= 0 ? "늘어" : "줄어"} ${args.curr.totalReviews}건이었어요.`;
  })();

  const ratingText =
    ratingDeltaPoints != null && args.curr.avgRating != null
      ? `평점은 ${formatDeltaPointsKorean({
          periodWord,
          deltaPoints: ratingDeltaPoints,
          currentPoints: args.curr.avgRating,
        })}`
      : `평점은 ${args.curr.avgRating != null ? `${args.curr.avgRating.toFixed(1)}점` : "집계가 없어"}요`;

  const reviewText = `리뷰는 ${args.curr.totalReviews}건(${periodWord} ${reviewDeltaCount >= 0 ? "+" : "-"}${Math.abs(reviewDeltaCount)}건)`;

  const orderText =
    orderDeltaPercent != null
      ? `주문은 ${formatDeltaPercentKorean({
          periodWord,
          deltaPercent: orderDeltaPercent,
          currentCount: args.curr.orderCount,
        })}`
      : `주문은 ${args.curr.orderCount}건이에요`;

  const platformText = `플랫폼별 리뷰는 배달의민족 ${counts.baemin.reviewCount}건, 쿠팡이츠 ${counts.coupang_eats.reviewCount}건, 요기요 ${counts.yogiyo.reviewCount}건, 땡겨요 ${counts.ddangyo.reviewCount}건이에요`;

  const platformRatingText = `플랫폼별 평점은 배달의민족 ${counts.baemin.avgRating != null ? `${counts.baemin.avgRating.toFixed(1)}점` : "(없음)"}, 쿠팡이츠 ${counts.coupang_eats.avgRating != null ? `${counts.coupang_eats.avgRating.toFixed(1)}점` : "(없음)"}, 요기요 ${counts.yogiyo.avgRating != null ? `${counts.yogiyo.avgRating.toFixed(1)}점` : "(없음)"}이에요`;

  const ddangyoText =
    ddTasty != null
      ? `땡겨요는 맛있어요 ${ddTasty.toFixed(0)}%로 ${ddTasty >= 80 ? "긍정적인 반응이" : ddTasty < 60 ? "개선 여지가" : "무난한 반응이"} 보여요`
      : null;

  const isSinglePlatformScope = args.platformBreakdown.length === 1;
  const singlePlatform = isSinglePlatformScope ? args.platformBreakdown[0] : null;

  const ending =
    scenario === "positive"
      ? "전반적으로 좋은 흐름이 이어지고 있는 것으로 보여요."
      : scenario === "negative"
        ? "전반적으로 최근 리뷰에 어떤 이야기가 담겨 있는지 확인해보시면 개선 여지가 있어 보여요."
        : scenario === "mixed"
          ? "전반적으로 좋아진 부분은 유지하면서 아쉬운 부분만 정리해보면 더 좋아질 것으로 보여요."
          : "전반적으로 큰 변동 없이 안정적으로 이어지고 있는 것으로 보여요.";

  // 2문장 고정: 두 번째 문장은 한 문장으로만 구성
  const secondParts: string[] = [];
  const seen = new Set<string>();
  const add = (key: string, value: string | null) => {
    if (!value) return;
    if (seen.has(key)) return;
    seen.add(key);
    secondParts.push(value);
  };

  // 1문장에서 선택한 리드(orders/reviews/rating)와 겹치지 않게 "나머지 데이터"만 연결
  if (lead.kind !== "orders") add("orders", orderText);
  if (lead.kind !== "reviews") add("reviews", reviewText);
  if (lead.kind !== "rating") add("rating", ratingText);

  // 플랫폼 필터(단일 플랫폼)면: 이미 탭 컨텍스트가 있으므로 다른 플랫폼 정보는 생략.
  // 단, 땡겨요는 별점이 없어서 맛있어요%를 꼭 붙임.
  if (isSinglePlatformScope) {
    if (singlePlatform?.platform === "ddangyo") add("ddangyo", ddangyoText);
  } else {
    add("platform_reviews_all", platformText);
    add("platform_ratings_all", platformRatingText);
    add("ddangyo", ddangyoText);
  }

  // 전체 플랫폼(미필터): 사용자가 원하는 "문장별 줄바꿈" 포맷으로 고정
  if (!isSinglePlatformScope) {
    const line1 = first;
    const line2 = `${orderText}, ${ratingText}.`;
    const line3 = `${platformText}.`;
    const line4 = ddangyoText
      ? `${platformRatingText}, ${ddangyoText}.`
      : `${platformRatingText}.`;
    const line5 = ending;
    return [line1, line2, line3, line4, line5].join("\n");
  }

  // 단일 플랫폼 탭: 3줄 고정 (리뷰 요약 / 주문+평점(or 맛있어요) / 마무리)
  const line1 = first;
  const line2 =
    singlePlatform?.platform === "ddangyo"
      ? ddangyoText
        ? `${orderText}, ${ddangyoText}.`
        : `${orderText}.`
      : `${orderText}, ${ratingText}.`;
  const line3 = ending;
  return [line1, line2, line3].join("\n");
}

function endsWithAllowedEnding(sentence: string): boolean {
  const s = sentence.trim();
  return (
    s.endsWith("했어요.") ||
    s.endsWith("있어요.") ||
    s.endsWith("보여요.") ||
    s.endsWith("것으로 보여요.")
  );
}

function normalizeInsightLines(text: string): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  return raw
    .replace(/\\r\\n/g, "\\n")
    .split("\\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function isValidInsightFormat(text: string, range: "7d" | "30d"): boolean {
  const lines = normalizeInsightLines(text);
  if (lines.length < 2) return false;
  if (lines.length > 6) return false;
  if (!lines.every(endsWithAllowedEnding)) return false;

  const all = lines.join("\\n");
  if (range === "7d" && all.includes("지난달 대비")) return false;
  if (range === "30d" && all.includes("지난주 대비")) return false;
  if (!all.includes("지난주 대비") && !all.includes("지난달 대비")) return false;
  if (/답글|댓글\\s*응답률|reply\\s*rate/i.test(all)) return false;
  return true;
}

export async function buildGlanceAiSummary(
  args: GlanceAiSummaryArgs,
): Promise<{ text: string; source: "rules" | "gemini" }> {
  const ruleText = buildGlanceInsightByRules(args);

  const apiKey = getGeminiApiKeyFromEnv();
  if (!apiKey) return { text: ruleText, source: "rules" };

  const periodLabel = args.range === "7d" ? "최근 7일" : "한 달";
  const periodWord = args.range === "7d" ? "지난주 대비" : "지난달 대비";
  const reviewDeltaCount = args.curr.totalReviews - args.prev.totalReviews;
  const ratingDeltaPoints =
    args.curr.avgRating != null && args.prev.avgRating != null
      ? Math.round((args.curr.avgRating - args.prev.avgRating) * 10) / 10
      : null;
  const orderDeltaPercentRaw = safePercentDelta(
    args.curr.orderCount,
    args.prev.orderCount,
  );
  const orderDeltaPercent =
    orderDeltaPercentRaw != null
      ? Math.round(orderDeltaPercentRaw * 10) / 10
      : null;
  const ratingDeltaPercentRaw =
    args.curr.avgRating != null && args.prev.avgRating != null && args.prev.avgRating > 0
      ? ((args.curr.avgRating - args.prev.avgRating) / args.prev.avgRating) * 100
      : null;
  const ratingDeltaPercent =
    ratingDeltaPercentRaw != null
      ? Math.round(ratingDeltaPercentRaw * 10) / 10
      : null;
  const reviewDeltaPercentRaw = safePercentDelta(
    args.curr.totalReviews,
    args.prev.totalReviews,
  );
  const reviewDeltaPercent =
    reviewDeltaPercentRaw != null
      ? Math.round(reviewDeltaPercentRaw * 10) / 10
      : null;

  const counts = platformCounts(args.platformBreakdown);
  const scenario = classifyScenario({
    reviewDeltaPercent,
    orderDeltaPercent,
    ratingDeltaPoints,
    ddangyoTastyRatioPercent: counts.ddangyo.tastyRatioPercent,
  });

  const scenarioKorean = scenarioToKorean(scenario);

  const userPrompt = buildDashboardGlanceInsightUserPrompt({
    startYmd: args.currentStartYmd,
    endYmd: args.currentEndYmd,
    rangeLabel: periodLabel,
    scenarioKorean,
    reviewCount: args.curr.totalReviews,
    reviewDeltaCount,
    avgRating: args.curr.avgRating,
    avgRatingDeltaPoints: ratingDeltaPoints,
    orderCount: args.curr.orderCount,
    orderDeltaPercent,
    platformReviewCounts: {
      baemin: counts.baemin.reviewCount,
      coupang_eats: counts.coupang_eats.reviewCount,
      yogiyo: counts.yogiyo.reviewCount,
      ddangyo: counts.ddangyo.reviewCount,
    },
    platformRatings: {
      baemin: counts.baemin.avgRating,
      coupang_eats: counts.coupang_eats.avgRating,
      yogiyo: counts.yogiyo.avgRating,
    },
    ddangyoTastyRatioPercent: counts.ddangyo.tastyRatioPercent,
  });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_DASHBOARD_GLANCE_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: DASHBOARD_GLANCE_SYSTEM_PROMPT,
        maxOutputTokens: GEMINI_DASHBOARD_GLANCE_MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: GEMINI_DASHBOARD_GLANCE_THINKING_BUDGET },
      },
    });
    const raw = response.text ?? "";
    const text = raw.trim();
    if (!text) return { text: ruleText, source: "rules" };

    // 지시문 준수 강제(어미/기간/금지어/줄수)
    if (!isValidInsightFormat(text, args.range)) {
      return { text: ruleText, source: "rules" };
    }

    return { text, source: "gemini" };
  } catch {
    return { text: ruleText, source: "rules" };
  }
}
