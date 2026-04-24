 
/**
 * 리뷰 답글 파이프라인: Gemini 응답에서 thought/메타 누설이 제거되는지 검증.
 *
 * 1) 픽스처(기본 50+): `extractGeminiReplyVisibleText` + `sanitizeReviewReplyDraft`
 * 2) 선택 `--live`: `pnpm dev` 후 로컬 `POST /api/demo/review-reply` (기본 20회, `--live-count=50` 등으로 변경)
 *
 * @example
 *   pnpm exec tsx --no-cache scripts/test-review-reply-extraction.ts
 *   pnpm exec tsx --no-cache scripts/test-review-reply-extraction.ts --live
 *   pnpm exec tsx --no-cache scripts/test-review-reply-extraction.ts --live --live-count=20
 *   pnpm exec tsx --no-cache scripts/test-review-reply-extraction.ts --live --out=my-run.json
 *
 * 결과 JSON: `--live`만 쓰면 기본 `scripts/output/review-reply-live-latest.json`.
 * `REVIEW_REPLY_TEST_OUT` 또는 `--out=경로` 로 덮어쓸 수 있음.
 *
 * `--live` + 출력 경로가 있을 때: 라이브 케이스마다 같은 JSON 파일을 덮어써서 실시간으로 열어볼 수 있음(중간 실패 시에도 마지막 플러시까지 반영).
 * 출력 경로 없이 `--live`만 하면 디스크에는 안 남김.
 *
 * 라이브 fetch 타임아웃 기본 60s (`REVIEW_REPLY_TEST_TIMEOUT_MS`). 첫 요청은 Gemini+Next 컴파일로 12s를 넘기기 쉬움.
 */
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { extractGeminiReplyVisibleText } from "@/lib/utils/ai/extract-gemini-reply-visible-text";
import { sanitizeReviewReplyDraft } from "@/lib/utils/ai/sanitize-review-reply";

const META_LEAK_RE =
  /Customer Nickname|Star Rating|thoughtful\s*\*|^\s*thoughtful\b/i;

function pipeResponse(response: unknown): string {
  const raw = extractGeminiReplyVisibleText(response).combined;
  return sanitizeReviewReplyDraft(raw);
}

function assertNoMetaLeak(out: string, label: string): void {
  if (META_LEAK_RE.test(out)) {
    throw new Error(
      `[${label}] thought/meta 누설 의심:\n${out.slice(0, 220)}${out.length > 220 ? "…" : ""}`,
    );
  }
}

type Fixture = {
  id: string;
  response: unknown;
  /** 있으면 추가 검증 */
  assert?: (out: string) => void;
};

function buildFixtures(): Fixture[] {
  const clean =
    "맛동산님, 소중한 리뷰 남겨주셔서 감사합니다. 다음에도 찾아뵙겠습니다.";
  const fixtures: Fixture[] = [];

  fixtures.push({
    id: "getter-only-clean",
    response: { text: clean, candidates: [{ content: { parts: [] } }] },
  });

  fixtures.push({
    id: "parts-single-clean",
    response: {
      text: "",
      candidates: [{ content: { parts: [{ text: clean }] } }],
    },
  });

  fixtures.push({
    id: "thought-flag-then-answer",
    response: {
      text: "",
      candidates: [
        {
          content: {
            parts: [
              {
                thought: true,
                text: "thoughtful * Customer Nickname: X * Menu: Y",
              },
              { text: clean },
            ],
          },
        },
      ],
    },
  });

  fixtures.push({
    id: "two-parts-unflagged-leak-last-good",
    response: {
      text: "thoughtful * Customer Nickname: 맛동산 * Menu: 치킨 * Star Rating: 4",
      candidates: [
        {
          content: {
            parts: [
              {
                text: "thoughtful * Customer Nickname: 맛동산 * Menu: 치킨 * Star Rating: 4",
              },
              { text: clean },
            ],
          },
        },
      ],
    },
  });

  fixtures.push({
    id: "getter-concat-leak-parts-longer",
    response: {
      text: "thoughtful * Customer Nickname: A",
      candidates: [
        {
          content: {
            parts: [{ text: clean }],
          },
        },
      ],
    },
  });

  fixtures.push({
    id: "multiline-meta-then-body",
    response: {
      text: "",
      candidates: [
        {
          content: {
            parts: [
              {
                text: [
                  "thoughtful * Customer Nickname: 테스터",
                  "Star Rating: 5",
                  "",
                  clean,
                ].join("\n"),
              },
            ],
          },
        },
      ],
    },
  });

  const singleLineBlob =
    "thoughtful * Customer Nickname: 맛동산맛있어 * Menu: 매콤바삭치킨 (Spicy) * Star Ra";

  fixtures.push({
    id: "single-line-blob-plus-answer",
    response: {
      text: `${singleLineBlob} ${clean}`,
      candidates: [
        {
          content: {
            parts: [{ text: `${singleLineBlob} ${clean}` }],
          },
        },
      ],
    },
    assert: (out) => {
      if (!/[가-힣]{6,}/.test(out)) {
        throw new Error("[single-line-blob-plus-answer] 한글 본문 없음");
      }
    },
  });

  fixtures.push({
    id: "three-parts-middle-thought",
    response: {
      candidates: [
        {
          content: {
            parts: [
              { text: "요약: 긍정 리뷰" },
              { thought: true, text: "내부 검토: 톤 유지" },
              { text: clean },
            ],
          },
        },
      ],
    },
  });

  fixtures.push({
    id: "empty-parts-use-getter",
    response: {
      text: `  ${clean}  `,
      candidates: [{ content: { parts: [{ text: "" }] } }],
    },
  });

  const nick = ["민지", "철수", "OOO", "guest12", "한글닉네임길게"];
  const menus = ["불고기버거", "Americano", "짜장면", "콤보세트 A", "맵당치킨"];
  for (let i = 0; i < 41; i++) {
    const leak = `thoughtful * Customer Nickname: ${nick[i % nick.length]} * Menu: ${menus[i % menus.length]} * Star Rating: ${(i % 5) + 1}`;
    const body = `${i % 3 === 0 ? `${leak}\n\n` : ""}${clean}`;
    fixtures.push({
      id: `synth-thought-${i}`,
      response: {
        text: i % 3 === 1 ? leak + "\n" + clean : "",
        candidates: [
          {
            content: {
              parts:
                i % 3 === 2
                  ? [{ text: leak, thought: i % 4 === 0 }, { text: clean }]
                  : [{ text: body }],
            },
          },
        ],
      },
    });
  }

  return fixtures;
}

type FixtureDump = {
  id: string;
  /** 가짜 Gemini generateContent 형태 */
  simulatedResponse: unknown;
  /** extract + sanitize 후 사용자 노출용 문자열 */
  replyAfterPipeline: string;
};

function runFixtures(fixtures: Fixture[]): FixtureDump[] {
  const dumps: FixtureDump[] = [];
  for (const f of fixtures) {
    const reply = pipeResponse(f.response);
    assertNoMetaLeak(reply, f.id);
    f.assert?.(reply);
    dumps.push({
      id: f.id,
      simulatedResponse: f.response,
      replyAfterPipeline: reply,
    });
  }
  console.log(
    `[fixtures] ${dumps.length}/${fixtures.length} 통과 (extract + sanitize)`,
  );
  return dumps;
}

const LIVE_REVIEW_SNIPPETS = [
  "적당해요",
  "맛있었습니다!",
  "배달이 늦었어요",
  "양이 적어요",
  "다음에 또 시킬게요",
  "별로였음",
  "친절해서 좋았어요",
  "포장 상태 최악",
  "가성비 굿",
  "너무 짜요",
  "따뜻하게 와서 좋았습니다",
  "차가웠어요",
  "메뉴 사진이랑 달라요",
  "직원 응대 불친절",
  "재방문 의사 있음",
  "한 번이면 족합니다",
  "라떼 맛있어요",
  "아메리카노 무난",
  "디저트는 별로",
  "양호합니다",
  "최고예요 ✨",
  "실망",
  "기대 이상",
  "기대 이하",
  "배민 리뷰 테스트 문자열 27",
  "쿠팡이츠 주문 후기 28",
  "요기요 배달 29",
  "땡겨요 맛있어요 표시 30",
  "내용 없음",
  "…",
  "ㅋㅋㅋ 굿",
  "별 다섯 개 드립니다",
  "별 하나도 아깝",
  "가족이랑 먹었어요",
  "혼자 먹기 딱 좋은 양",
  "단체 주문했는데 만족",
  "쿠폰 써서 싸게 먹음",
  "원가 대비 괜찮음",
  "원가 대비 비쌈",
  "포장 밀봉 좋음",
  "소스 누수",
  "냄새가 좀 났어요",
  "신선했어요",
  "재료가 아쉬워요",
  "사장님 답글 기다려요",
  "빠른 배달 감사",
  "주소 착각했는데 친절히 처리",
  "앱 오류로 불편",
  "전반적으로 무난",
  "또 주문할게요 사장님",
  "리뷰 이벤트 참여합니다",
  "솔직 후기: 그저 그램",
];

const LIVE_RUN_COUNT_DEFAULT = 50;
const LIVE_RUN_COUNT_MAX = 500;

function getLiveRunCount(): number {
  const eq = process.argv.find((a) => a.startsWith("--live-count="));
  if (eq) {
    const n = Number(eq.slice("--live-count=".length));
    if (Number.isFinite(n) && n >= 1 && n <= LIVE_RUN_COUNT_MAX) {
      return Math.floor(n);
    }
  }
  const idx = process.argv.indexOf("--live-count");
  if (idx !== -1) {
    const next = process.argv[idx + 1];
    if (next && !next.startsWith("--")) {
      const n = Number(next);
      if (Number.isFinite(n) && n >= 1 && n <= LIVE_RUN_COUNT_MAX) {
        return Math.floor(n);
      }
    }
  }
  const fromEnv = process.env.REVIEW_REPLY_TEST_LIVE_COUNT?.trim();
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n >= 1 && n <= LIVE_RUN_COUNT_MAX) {
      return Math.floor(n);
    }
  }
  return LIVE_RUN_COUNT_DEFAULT;
}

const LIVE_FETCH_TIMEOUT_MS = Number(
  process.env.REVIEW_REPLY_TEST_TIMEOUT_MS ?? "60000",
);

type LiveCaseRecord = {
  index: number;
  request: Record<string, unknown>;
  httpStatus: number;
  /** API JSON 전체 (result, 에러 시 detail 등) */
  response: unknown;
  reply: string;
  durationMs: number;
};

type LiveSnapshotState = {
  url: string;
  records: LiveCaseRecord[];
  /** 정상 종료 시 마지막 스냅샷만 true */
  finished: boolean;
};

async function runLive(options?: {
  onSnapshot?: (state: LiveSnapshotState) => Promise<void>;
}): Promise<{ url: string; records: LiveCaseRecord[] }> {
  const onSnapshot = options?.onSnapshot;
  const liveRunCount = getLiveRunCount();
  const base =
    process.env.REVIEW_REPLY_TEST_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const url = `${base}/api/demo/review-reply`;
  const tones = ["default", "female_2030", "male_2030", "senior_4050"] as const;
  const lengths = ["short", "normal", "long"] as const;

  console.log(
    `[live] ${url} 로 ${liveRunCount}회 POST (요청당 ${LIVE_FETCH_TIMEOUT_MS}ms, env REVIEW_REPLY_TEST_TIMEOUT_MS). 다른 터미널에서 pnpm dev 가 떠 있어야 함.`,
  );

  const records: LiveCaseRecord[] = [];
  if (onSnapshot) {
    await onSnapshot({ url, records, finished: false });
  }

  let ok = 0;
  for (let i = 0; i < liveRunCount; i++) {
    const reviewText = LIVE_REVIEW_SNIPPETS[i % LIVE_REVIEW_SNIPPETS.length]!;
    const rating = (i % 5) + 1;
    const request: Record<string, unknown> = {
      storeName: `테스트가게${i % 7}`,
      industry: i % 2 === 0 ? "한식" : "카페",
      rating,
      nickname: `손님${i % 11}`,
      menu: i % 3 === 0 ? "대표메뉴" : undefined,
      reviewText: `${reviewText} (case ${i})`,
      tone: tones[i % tones.length],
      commentLength: lengths[i % lengths.length],
    };
    let res: Response;
    const t0 = Date.now();
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(LIVE_FETCH_TIMEOUT_MS),
        body: JSON.stringify(request),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const durationMs = Date.now() - t0;
      records.push({
        index: i,
        request,
        httpStatus: 0,
        response: { error: "FETCH_FAILED", message: msg },
        reply: "",
        durationMs,
      });
      if (onSnapshot) {
        await onSnapshot({ url, records, finished: false });
      }
      const timeoutHint =
        /timeout|aborted/i.test(msg) && Number.isFinite(LIVE_FETCH_TIMEOUT_MS)
          ? ` 늘리려면 REVIEW_REPLY_TEST_TIMEOUT_MS (현재 ${LIVE_FETCH_TIMEOUT_MS}).`
          : "";
      throw new Error(
        `[live-${i}] fetch 실패 (${msg}). ${url} 연결·pnpm dev 확인, 필요 시 REVIEW_REPLY_TEST_BASE_URL.${timeoutHint}`,
      );
    }
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      const t = await res.text();
      let body: unknown = t;
      try {
        body = JSON.parse(t) as unknown;
      } catch {
        /* text */
      }
      records.push({
        index: i,
        request,
        httpStatus: res.status,
        response: body,
        reply: "",
        durationMs,
      });
      if (onSnapshot) {
        await onSnapshot({ url, records, finished: false });
      }
      throw new Error(`[live-${i}] HTTP ${res.status}: ${t.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      result?: { reply?: string };
      detail?: string;
    };
    const reply = data.result?.reply ?? "";
    if (!reply.trim()) {
      records.push({
        index: i,
        request,
        httpStatus: res.status,
        response: data,
        reply: "",
        durationMs,
      });
      if (onSnapshot) {
        await onSnapshot({ url, records, finished: false });
      }
      throw new Error(
        `[live-${i}] 빈 reply: ${JSON.stringify(data).slice(0, 300)}`,
      );
    }
    assertNoMetaLeak(reply, `live-${i}`);
    records.push({
      index: i,
      request,
      httpStatus: res.status,
      response: data,
      reply,
      durationMs,
    });
    if (onSnapshot) {
      await onSnapshot({
        url,
        records,
        finished: i === liveRunCount - 1,
      });
    }
    ok += 1;
    if (i === 0) {
      console.log("[live] 첫 요청 OK (서버 연결됨)");
    }
    if (i % 10 === 9) {
      console.log(`[live] … ${ok}/${liveRunCount}`);
    }
  }
  console.log(`[live] ${ok}/${liveRunCount} 통과 (${url})`);
  return { url, records };
}

function getOutputPath(): string | null {
  const eq = process.argv.find((a) => a.startsWith("--out="));
  if (eq) {
    const p = eq.slice("--out=".length).trim();
    if (p) return p;
  }
  const idx = process.argv.indexOf("--out");
  if (idx !== -1) {
    const next = process.argv[idx + 1];
    if (next && !next.startsWith("--")) return next;
  }
  if (process.env.REVIEW_REPLY_TEST_OUT?.trim()) {
    return process.env.REVIEW_REPLY_TEST_OUT.trim();
  }
  if (process.argv.includes("--live")) {
    return "scripts/output/review-reply-live-latest.json";
  }
  return null;
}

async function writeReportFile(
  outPath: string,
  body: Record<string, unknown>,
): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(body, null, 2), "utf8");
  console.log(`[out] JSON 저장: ${outPath}`);
}

async function main(): Promise<void> {
  const fixtures = buildFixtures();
  if (fixtures.length < 50) {
    throw new Error(`픽스처 수 ${fixtures.length} — 최소 50 필요`);
  }
  const fixtureDumps = runFixtures(fixtures);

  const outPath = getOutputPath();
  const generatedAt = new Date().toISOString();

  if (process.argv.includes("--live")) {
    if (outPath) {
      let announcedRealtime = false;
      const { records } = await runLive({
        onSnapshot: async ({
          url: liveUrl,
          records: liveRecords,
          finished,
        }) => {
          await mkdir(dirname(outPath), { recursive: true });
          const report: Record<string, unknown> = {
            generatedAt,
            fixtures: fixtureDumps,
            live: {
              endpoint: liveUrl,
              cases: liveRecords,
              progress: {
                completed: liveRecords.length,
                total: getLiveRunCount(),
              },
              finished,
            },
          };
          await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
          if (!announcedRealtime) {
            console.log(`[out] 실시간 갱신(케이스마다 덮어쓰기): ${outPath}`);
            announcedRealtime = true;
          }
        },
      });
      console.log(
        `[out] 라이브 기록 완료 ${records.length}/${getLiveRunCount()}건 → ${outPath}`,
      );
    } else {
      await runLive();
    }
  } else {
    console.log(
      `라이브(기본 ${LIVE_RUN_COUNT_DEFAULT}회, \`--live-count=\`)는 생략됨. \`pnpm dev\` 실행 후:\n  pnpm exec tsx --no-cache scripts/test-review-reply-extraction.ts --live`,
    );
  }

  if (outPath && !process.argv.includes("--live")) {
    const report: Record<string, unknown> = {
      generatedAt,
      fixtures: fixtureDumps,
    };
    await writeReportFile(outPath, report);
  } else if (!outPath && !process.argv.includes("--live")) {
    console.log(
      "픽스처만 JSON으로 남기려면: pnpm exec tsx --no-cache scripts/test-review-reply-extraction.ts --out=scripts/output/fixtures-only.json",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
