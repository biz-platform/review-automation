import { describe, expect, it } from "vitest";

import { sanitizeReviewReplyDraft } from "@/lib/utils/ai/sanitize-review-reply";

describe("sanitizeReviewReplyDraft", () => {
  it("빈 입력은 빈 문자열", () => {
    expect(sanitizeReviewReplyDraft("")).toBe("");
    expect(sanitizeReviewReplyDraft("   ")).toBe("");
  });

  it("리터럴 \\n 을 개행으로 복구", () => {
    expect(sanitizeReviewReplyDraft("a\\nb")).toBe("a\nb");
  });

  it("코드펜스 제거", () => {
    expect(sanitizeReviewReplyDraft("```\n안녕하세요\n```").trim()).toBe(
      "안녕하세요",
    );
  });

  it("thinking 블록 제거", () => {
    const raw = `<thinking>내부</thinking>\n고객님 감사합니다.`;
    expect(sanitizeReviewReplyDraft(raw)).toBe("고객님 감사합니다.");
  });

  it("연속 동일 문단 축소", () => {
    const raw = "같음\n\n같음\n\n다름";
    expect(sanitizeReviewReplyDraft(raw)).toBe("같음\n\n다름");
  });

  it("줄바꿈이 이미 있으면 문장 collapse로 재포맷하지 않음", () => {
    const raw = "감사합니다.\n또 이용 부탁드려요.";
    expect(sanitizeReviewReplyDraft(raw)).toBe("감사합니다.\n또 이용 부탁드려요.");
  });

  it("줄바꿈이 없고 문장 구분이 가능하면 문장 단위 줄바꿈 적용", () => {
    const raw = "감사합니다. 또 이용 부탁드려요.";
    expect(sanitizeReviewReplyDraft(raw)).toBe("감사합니다.\n또 이용 부탁드려요.");
  });

  it("이모지 단독 줄은 바로 위 문장 끝에 붙임", () => {
    const raw = "다음에도 편하게 불러주세요!\n👍";
    expect(sanitizeReviewReplyDraft(raw)).toBe("다음에도 편하게 불러주세요! 👍");
  });

  it('JSON wrapper({ "reply": "..." })는 reply만 추출', () => {
    const raw = '{\n  "reply": "안녕하세요.\\n\\n감사합니다! 👍"\n}';
    expect(sanitizeReviewReplyDraft(raw)).toBe("안녕하세요.\n\n감사합니다! 👍");
  });

  it("문단 구분이 전혀 없으면 최소 1회 문단 구분을 만든다", () => {
    const raw = "a\nb\nc";
    expect(sanitizeReviewReplyDraft(raw)).toBe("a\n\nb\nc");
  });

  it("메타 라인(리뷰 분석 등) 제거", () => {
    const raw = "리뷰 분석: 요약\n실제 답글 본문";
    expect(sanitizeReviewReplyDraft(raw)).toBe("실제 답글 본문");
  });

  it("1~3점: 스파클·별 이모지는 제거(🙏 등은 유지)", () => {
    expect(
      sanitizeReviewReplyDraft("불편 드려 죄송합니다! 🙏✨", { starRating: 2 }),
    ).toBe("불편 드려 죄송합니다! 🙏");
    expect(sanitizeReviewReplyDraft("감사해요 ✨", { starRating: 5 })).toBe(
      "감사해요 ✨",
    );
  });
});
