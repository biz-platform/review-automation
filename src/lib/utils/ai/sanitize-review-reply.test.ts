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

  it("메타 라인(리뷰 분석 등) 제거", () => {
    const raw = "리뷰 분석: 요약\n실제 답글 본문";
    expect(sanitizeReviewReplyDraft(raw)).toBe("실제 답글 본문");
  });
});
