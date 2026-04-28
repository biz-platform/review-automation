import { describe, expect, it } from "vitest";
import { sanitizeBaeminReplyProhibitedTerms } from "@/lib/utils/baemin/sanitize-baemin-reply-prohibited";

describe("sanitizeBaeminReplyProhibitedTerms", () => {
  it("닉네임에 금칙어가 있으면 줄 시작 호칭을 고객님으로 바꾼 뒤 잔여 요기요를 치환한다", () => {
    const raw =
      "요기요로시킬껄님, 만족스러운 식사가 되셨다니 감사합니다. 또 찾아 주세요.";
    expect(
      sanitizeBaeminReplyProhibitedTerms(raw, "요기요로시킬껄"),
    ).toMatch(/고객님,\s*만족스러운/);
    expect(sanitizeBaeminReplyProhibitedTerms(raw, "요기요로시킬껄")).not.toMatch(
      /요기요/,
    );
  });

  it("닉네임 없이 본문에만 요기요가 있으면 치환한다", () => {
    expect(sanitizeBaeminReplyProhibitedTerms("요기요에서 시켜봤는데 맛있네요")).toBe(
      "타배달앱에서 시켜봤는데 맛있네요",
    );
  });

  it("쿠팡/쿠팡이츠/땡겨요도 본문에 있으면 치환한다", () => {
    expect(sanitizeBaeminReplyProhibitedTerms("쿠팡이츠로 시켰는데 여기 더 맛있어요")).toBe(
      "타배달앱로 시켰는데 여기 더 맛있어요",
    );
    expect(sanitizeBaeminReplyProhibitedTerms("쿠팡으로 시켰는데도 괜찮네요")).toBe(
      "타배달앱으로 시켰는데도 괜찮네요",
    );
    expect(sanitizeBaeminReplyProhibitedTerms("땡겨요에서 봤던 집인데 여기서도 좋네요")).toBe(
      "타배달앱에서 봤던 집인데 여기서도 좋네요",
    );
  });

  it("다음 줄 시작 닉네임 호칭도 치환한다", () => {
    const raw = "먼저 줄\n요기요유저님, 감사합니다.";
    expect(sanitizeBaeminReplyProhibitedTerms(raw, "요기요유저")).toContain(
      "고객님, 감사합니다.",
    );
  });
});
