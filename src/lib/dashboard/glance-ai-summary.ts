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
import type { DashboardGlanceAiInsightFallbackReason } from "@/entities/dashboard/types";

type PlatformKey = "baemin" | "coupang_eats" | "yogiyo" | "ddangyo";

export type GlanceAiSummaryBuildResult = {
  text: string;
  source: "rules" | "gemini";
  fallbackReason: DashboardGlanceAiInsightFallbackReason | null;
  debug?: Record<string, unknown> | null;
};

const GLANCE_GEMINI_FAILURE_TEXT =
  "AI 인사이트 생성에 실패했어요. 새로고침을 시도해주세요.";

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

  const scoreSignals = [
    args.reviewDeltaPercent,
    args.orderDeltaPercent,
    ratingDeltaPercentLike,
  ];

  const posCount = scoreSignals.filter(pos).length;
  const negCount = scoreSignals.filter(neg).length;

  // 땡겨요는 별점 대신 만족도로 해석
  const ddPos =
    args.ddangyoTastyRatioPercent != null
      ? args.ddangyoTastyRatioPercent >= 80
      : false;
  const ddNeg =
    args.ddangyoTastyRatioPercent != null
      ? args.ddangyoTastyRatioPercent < 60
      : false;

  if (posCount >= 2 || (posCount >= 1 && ddPos)) return "positive";
  if (negCount >= 2 || (negCount >= 1 && ddNeg)) return "negative";
  if ((posCount >= 1 || ddPos) && (negCount >= 1 || ddNeg)) return "mixed";
  return "flat";
}

function platformCounts(
  platformBreakdown: GlanceAiSummaryArgs["platformBreakdown"],
) {
  const by: Record<
    PlatformKey,
    {
      reviewCount: number;
      avgRating: number | null;
      tastyRatioPercent: number | null;
    }
  > = {
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

/** 전체 플랫폼 스코프: 2번째 줄(한 문장). 플랫폼 건수/별점 나열 금지. */
function buildAllPlatformsSecondSentence(args: {
  scenario: DashboardGlanceScenario;
  periodWord: string;
  curr: GlanceAiSummaryArgs["curr"];
  counts: ReturnType<typeof platformCounts>;
  orderDeltaPercent: number | null;
  ratingDeltaPoints: number | null;
  reviewDeltaCount: number;
  reviewDeltaPercent: number | null;
  orderUp: boolean;
  orderDown: boolean;
  ratingUp: boolean;
  ratingDown: boolean;
  ddTasty: number | null;
}): string {
  const {
    scenario,
    periodWord,
    curr,
    counts,
    orderDeltaPercent,
    ratingDeltaPoints,
    reviewDeltaCount,
    reviewDeltaPercent,
    orderUp,
    orderDown,
    ratingUp,
    ratingDown,
    ddTasty,
  } = args;

  const starRs = [
    counts.baemin.avgRating,
    counts.coupang_eats.avgRating,
    counts.yogiyo.avgRating,
  ].filter((x): x is number => x != null && Number.isFinite(x));
  const minStar = starRs.length ? Math.min(...starRs) : null;
  const maxStar = starRs.length ? Math.max(...starRs) : null;
  const allHigh = starRs.length >= 2 && starRs.every((r) => r >= 4.5);

  const reviewSurge =
    reviewDeltaPercent != null &&
    reviewDeltaPercent > 15 &&
    reviewDeltaCount > 0;

  if (
    scenario === "mixed" &&
    orderUp &&
    ratingDown &&
    curr.avgRating != null &&
    ratingDeltaPoints != null
  ) {
    return `다만 평균 평점이 ${Math.abs(ratingDeltaPoints).toFixed(1)}점 낮아진 ${curr.avgRating.toFixed(1)}점을 기록한 만큼, 점수가 상대적으로 낮은 플랫폼의 리뷰를 중심으로 보완할 점을 확인해 보시면 좋을 것으로 보여요.`;
  }

  if (
    scenario === "mixed" &&
    orderDown &&
    ratingUp &&
    curr.avgRating != null &&
    ratingDeltaPoints != null
  ) {
    const ddPart =
      ddTasty != null && ddTasty >= 75
        ? `땡겨요의 맛 만족도도 ${ddTasty.toFixed(0)}%로 높은 만큼, `
        : "";
    return `하지만 평균 평점이 ${curr.avgRating.toFixed(1)}점으로 ${ratingDeltaPoints.toFixed(1)}점 오르고 ${ddPart}지금의 품질을 유지하며 고객을 다시 모을 방법을 고민해 보시면 좋을 것으로 보여요.`;
  }

  if (
    scenario === "mixed" &&
    reviewSurge &&
    orderDown &&
    ratingDown &&
    curr.avgRating != null &&
    orderDeltaPercent != null &&
    ratingDeltaPoints != null
  ) {
    return `다만 주문 수는 ${Math.abs(orderDeltaPercent).toFixed(1)}% 줄어들고 평균 평점도 ${Math.abs(ratingDeltaPoints).toFixed(1)}점 낮아진 ${curr.avgRating.toFixed(1)}점을 기록한 만큼, 활발해진 리뷰 속에서 고객들이 아쉬워하는 점을 꼼꼼히 찾아보시면 좋을 것으로 보여요.`;
  }

  if (scenario === "flat") {
    const ddPart =
      ddTasty != null && ddTasty >= 75
        ? `땡겨요의 맛 만족도가 ${ddTasty.toFixed(0)}%로 높고 `
        : "";
    const floor =
      minStar != null ? (Math.floor(minStar * 10) / 10).toFixed(1) : null;
    const floorPhrase =
      floor != null
        ? `배달의민족·쿠팡이츠·요기요 기준 평점도 ${floor}점 이상으로 무난한 만큼, `
        : "";
    return `${periodWord} 리뷰 수·주문 수·평점이 모두 큰 변동 없이 안정적인 흐름을 유지하고 있어요, ${ddPart}${floorPhrase}지금의 운영이 손님들에게 변함없는 신뢰를 얻고 있는 것으로 보여요.`;
  }

  if (scenario === "negative") {
    return `평점·주문·리뷰 흐름을 함께 보면 부담이 커 보일 수 있지만, 최근 리뷰에 담긴 이야기를 살펴보면 개선 여지가 있어 보여요.`;
  }

  const ratingClause =
    curr.avgRating != null && ratingDeltaPoints != null
      ? Math.abs(ratingDeltaPoints) < 0.05
        ? `평균 평점은 ${periodWord} 비슷하게 ${curr.avgRating.toFixed(1)}점이에요`
        : ratingDeltaPoints > 0
          ? `평균 평점도 ${ratingDeltaPoints.toFixed(1)}점 오른 ${curr.avgRating.toFixed(1)}점에 도달했는데`
          : `평균 평점은 ${curr.avgRating.toFixed(1)}점으로 ${periodWord} ${Math.abs(ratingDeltaPoints).toFixed(1)}점 내려갔지만`
      : curr.avgRating != null
        ? `평균 평점은 ${curr.avgRating.toFixed(1)}점으로 집계되었는데`
        : "평균 평점 집계는 없지만";

  if (scenario === "positive" && allHigh && maxStar != null) {
    const ddMid =
      ddTasty != null && ddTasty >= 80
        ? `땡겨요 맛있어요 비율도 ${ddTasty.toFixed(0)}%로 긍정적이며 `
        : "";
    return `${ratingClause}, ${ddMid}모든 배달 플랫폼에서 ${maxStar.toFixed(1)}점 안팎의 만족도를 유지한 덕분에 고객 선택이 이어지고 있는 것으로 보여요.`;
  }

  if (scenario === "positive" && minStar != null && maxStar != null) {
    const spread = maxStar - minStar;
    if (spread <= 0.35) {
      return `${ratingClause}, 플랫폼별 평점도 ${minStar.toFixed(1)}~${maxStar.toFixed(1)}점으로 고른 편이라 매장 신뢰가 이어지고 있는 것으로 보여요.`;
    }
    return `${ratingClause}, 플랫폼 간 평점 격차는 있으나 ${minStar.toFixed(1)}점 이상을 유지하는 흐름이라 고객 반응을 가볍게 점검해 보면 좋을 것으로 보여요.`;
  }

  if (scenario === "mixed") {
    return `${ratingClause}, 좋아진 부분은 유지하면서 아쉬운 부분만 정리보면 더 좋아질 것으로 보여요.`;
  }

  return `${ratingClause}, 전반적으로 큰 변동 없이 안정적으로 이어지고 있는 것으로 보여요.`;
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
  const orderScore =
    orderDeltaPercent != null ? Math.abs(orderDeltaPercent) : -1;

  type Lead =
    | { kind: "orders"; score: number; sign: -1 | 0 | 1 }
    | { kind: "reviews"; score: number; sign: -1 | 0 | 1 }
    | { kind: "rating"; score: number; sign: -1 | 0 | 1 };

  const leadCandidates = (
    [
      {
        kind: "orders",
        score: orderScore,
        sign:
          orderDeltaPercent == null
            ? 0
            : orderDeltaPercent > 0
              ? 1
              : orderDeltaPercent < 0
                ? -1
                : 0,
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
          ratingDeltaPoints == null
            ? 0
            : ratingDeltaPoints > 0
              ? 1
              : ratingDeltaPoints < 0
                ? -1
                : 0,
      },
    ] satisfies Lead[]
  ).slice();

  const lead =
    scenario === "mixed"
      ? (leadCandidates
          .filter((c) => c.sign > 0)
          .sort((a, b) => b.score - a.score)[0] ??
        leadCandidates.sort((a, b) => b.score - a.score)[0])
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

  const orderUp = orderDeltaPercent != null && orderDeltaPercent > 0.05;
  const orderDown = orderDeltaPercent != null && orderDeltaPercent < -0.05;
  const ratingUp = ratingDeltaPoints != null && ratingDeltaPoints > 0.05;
  const ratingDown = ratingDeltaPoints != null && ratingDeltaPoints < -0.05;

  const line2All = buildAllPlatformsSecondSentence({
    scenario,
    periodWord,
    curr: args.curr,
    counts,
    orderDeltaPercent,
    ratingDeltaPoints,
    reviewDeltaCount,
    reviewDeltaPercent,
    orderUp,
    orderDown,
    ratingUp,
    ratingDown,
    ddTasty,
  });

  return `${first}\n${line2All}`;
}

/** Gemini 출력 검증: 자연 문장 어미(폴백으로 룰 문구가 나가지 않게 넉넉히) */
function endsWithAllowedEnding(sentence: string): boolean {
  const s = sentence.trim();
  const ok = [
    "했어요.",
    "였어요.",
    "었어요.",
    "있어요.",
    "없어요.",
    "됐어요.",
    "났어요.",
    "졌어요.",
    "봤어요.",
    "봐요.",
    "아요.",
    "어요.",
    "대요.",
    "네요.",
    "죠.",
    "지요.",
    "보여요.",
    "것으로 보여요.",
    "같아요.",
    "이었어요.",
    "였죠.",
  ];
  return ok.some((e) => s.endsWith(e));
}

function normalizeInsightLines(text: string): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function isValidInsightFormat(
  text: string,
  range: "7d" | "30d",
  scopePlatform: PlatformKey | null,
): boolean {
  const lines = normalizeInsightLines(text);
  if (lines.length !== 2) return false;
  if (!lines.every(endsWithAllowedEnding)) return false;

  const all = lines.join("\n");
  if (range === "7d" && all.includes("지난달 대비")) return false;
  if (range === "30d" && all.includes("지난주 대비")) return false;
  if (!all.includes("지난주 대비") && !all.includes("지난달 대비"))
    return false;
  if (/플랫폼별\s*리뷰/i.test(all)) return false;
  if (/플랫폼별\s*평점/i.test(all)) return false;
  if (scopePlatform) {
    if (/모든\s*배달\s*플랫폼/i.test(all)) return false;
    // 개별 플랫폼 탭에서 다른 플랫폼 언급 금지
    const others = (
      ["baemin", "coupang_eats", "yogiyo", "ddangyo"] as const
    ).filter((p) => p !== scopePlatform);
    const otherKorean = [
      scopePlatform !== "baemin" ? "배달의민족" : null,
      scopePlatform !== "coupang_eats" ? "쿠팡이츠" : null,
      scopePlatform !== "yogiyo" ? "요기요" : null,
      scopePlatform !== "ddangyo" ? "땡겨요" : null,
    ].filter((x): x is string => Boolean(x));
    if (otherKorean.some((k) => all.includes(k))) return false;
    if (others.some((p) => all.includes(p))) return false;
  }
  return true;
}

export async function buildGlanceAiSummary(
  args: GlanceAiSummaryArgs,
): Promise<GlanceAiSummaryBuildResult> {
  const apiKey = getGeminiApiKeyFromEnv();
  if (!apiKey)
    return {
      text: GLANCE_GEMINI_FAILURE_TEXT,
      source: "rules",
      fallbackReason: "missing_gemini_api_key",
      debug: {
        model: GEMINI_DASHBOARD_GLANCE_MODEL,
      },
    };

  const periodLabel = args.range === "7d" ? "최근 7일" : "한 달";
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
  const counts = platformCounts(args.platformBreakdown);
  const scopePlatform: PlatformKey | null =
    args.platformBreakdown.length === 1
      ? args.platformBreakdown[0].platform
      : null;
  const scopePlatformKorean =
    scopePlatform === "baemin"
      ? "배달의민족"
      : scopePlatform === "coupang_eats"
        ? "쿠팡이츠"
        : scopePlatform === "yogiyo"
          ? "요기요"
          : scopePlatform === "ddangyo"
            ? "땡겨요"
            : null;

  const userPrompt = buildDashboardGlanceInsightUserPrompt({
    startYmd: args.currentStartYmd,
    endYmd: args.currentEndYmd,
    rangeLabel: periodLabel,
    scopePlatform,
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
    const baseSystemInstruction =
      scopePlatform == null
        ? DASHBOARD_GLANCE_SYSTEM_PROMPT
        : `${DASHBOARD_GLANCE_SYSTEM_PROMPT}\n\n[개별 플랫폼 탭 추가 규칙]\n- 현재 탭은 ${scopePlatformKorean ?? scopePlatform} 단일 플랫폼이다.\n- \"플랫폼별\", \"모든 배달 플랫폼\" 같은 표현을 쓰지 말고, 선택된 플랫폼 1개만 언급할 것.\n- 다른 플랫폼(배달의민족/쿠팡이츠/요기요/땡겨요) 이름을 섞어 쓰지 말 것.`;

    const runOnce = async (systemInstruction: string) => {
      const response = await ai.models.generateContent({
        model: GEMINI_DASHBOARD_GLANCE_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction,
          maxOutputTokens: GEMINI_DASHBOARD_GLANCE_MAX_OUTPUT_TOKENS,
          thinkingConfig: {
            thinkingBudget: GEMINI_DASHBOARD_GLANCE_THINKING_BUDGET,
          },
        },
      });
      let text = (response.text ?? "").trim();
      text = text
        .replace(/^```[a-zA-Z]*\s*/m, "")
        .replace(/\s*```$/m, "")
        .trim();
      return text;
    };

    // 1차 시도
    let text = await runOnce(baseSystemInstruction);
    if (!text) {
      return {
        text: GLANCE_GEMINI_FAILURE_TEXT,
        source: "rules",
        fallbackReason: "gemini_empty_response",
        debug: {
          model: GEMINI_DASHBOARD_GLANCE_MODEL,
          scopePlatform,
        },
      };
    }

    let candidate = (enforceTwoLines(text) ?? text).trim();

    // 검증 실패 시 1회 재시도(리뷰 답글처럼)
    if (!isValidInsightFormat(candidate, args.range, scopePlatform)) {
      const retrySystemInstruction = `${baseSystemInstruction}\n\n[재시도 지시]\n- 출력은 반드시 2줄(각 줄 1문장)로 작성.\n- \"플랫폼별\"이라는 단어를 절대 쓰지 말 것.\n- 개별 플랫폼 탭이면 선택된 플랫폼(${scopePlatformKorean ?? scopePlatform})만 언급하고, 다른 플랫폼 이름을 쓰지 말 것.\n- 쉼표(,)로 문장을 이어붙이지 말고, 1줄에 1문장으로 끝낼 것.`;
      const retryText = await runOnce(retrySystemInstruction);
      if (!retryText) {
        return {
          text: GLANCE_GEMINI_FAILURE_TEXT,
          source: "rules",
          fallbackReason: "gemini_empty_response",
          debug: {
            model: GEMINI_DASHBOARD_GLANCE_MODEL,
            scopePlatform,
          },
        };
      }
      candidate = (enforceTwoLines(retryText) ?? retryText).trim();
      if (!isValidInsightFormat(candidate, args.range, scopePlatform)) {
        return {
          text: GLANCE_GEMINI_FAILURE_TEXT,
          source: "rules",
          fallbackReason: "validation_failed",
          debug: {
            model: GEMINI_DASHBOARD_GLANCE_MODEL,
            scopePlatform,
            candidate,
          },
        };
      }
    }

    return {
      text: candidate,
      source: "gemini",
      fallbackReason: null,
      debug: null,
    };
  } catch (err) {
    const e = err as any;
    return {
      text: GLANCE_GEMINI_FAILURE_TEXT,
      source: "rules",
      fallbackReason: "gemini_error",
      debug: {
        model: GEMINI_DASHBOARD_GLANCE_MODEL,
        scopePlatform,
        errorString:
          typeof e?.toString === "function" ? e.toString() : String(e),
        errorName: e?.name,
        errorMessage: e?.message,
        errorStack: e?.stack,
        status: e?.status ?? e?.response?.status ?? e?.code,
        details: e?.details ?? e?.response?.data,
      },
    };
  }
}
