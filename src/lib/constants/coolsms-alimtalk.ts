/**
 * CoolSMS 알림톡(카카오 비즈메시지 템플릿) — 템플릿 ID·본문·엔드포인트.
 * 본문은 카카오 심사 승인 문구와 글자 단위로 일치해야 함 → 변경 시 CoolSMS 콘솔과 동기화.
 */

/** CoolSMS Messages API v4 발송 엔드포인트 */
export const COOLSMS_MESSAGES_V4_SEND_URL =
  "https://api.coolsms.co.kr/messages/v4/send" as const;

/**
 * 알림톡 버튼·문구에 쓰는 올리뷰 웹 베이스 URL.
 * (실행 환경과 무관하게 프로덕션 도메인 고정 — `oliview-alimtalk` 등)
 */
export const OLIVIEW_ALIMTALK_PUBLIC_WEB_URL = "https://www.oliview.kr/" as const;

/** `https://#{LINK}` 형 버튼용 — scheme 없이 www… 형태 */
export const OLIVIEW_ALIMTALK_LINK_TOKEN_NO_SCHEME =
  OLIVIEW_ALIMTALK_PUBLIC_WEB_URL.replace(/^https?:\/\//i, "").trim();

/** 카카오 채널에 등록된 알림톡 템플릿 ID (CoolSMS 콘솔 KA01TP…) */
export const COOLSMS_ALIMTALK_KAKAO_TEMPLATE_ID = {
  trial_ends_3d: "KA01TP260423014252917RVjCfW45NZz",
  trial_ended_unpaid: "KA01TP2604230149158834xNn2yEcAQx",
  payment_failed: "KA01TP260423015853116YpdgVIK51Hj",
  dissatisfied_review: "KA01TP260422023153461ZNGG49e6Tac",
  /**
   * 주간 리포트 알림톡 — 실제 ID는 `OLIVIEW_WEEKLY_REPORT_ALIMTALK_TEMPLATE_ID` 환경변수로만 사용.
   * (카카오 심사 승인 후 CoolSMS 콘솔의 KA01TP… 값을 넣는다.)
   */
  weekly_store_report: "",
} as const;

export function buildAlimtalkTrialEnds3dBody(): string {
  return `올리뷰 무료 체험 기간이 3일 후 종료됩니다.
체험 기간 종료 후 계속 이용하시려면 결제 수단을 등록해주세요.
등록하지 않으시면 서비스 이용이 자동으로 중단됩니다.`;
}

export function buildAlimtalkTrialEndedUnpaidBody(): string {
  return `올리뷰 무료 체험 기간이 종료되었어요.

아직 결제 수단이 등록되지 않아 현재 서비스 이용이 일시 중단된 상태입니다. 계속 이용하시려면 아래에서 결제 수단을 등록해 주세요.

※ 결제 수단을 90일 이내에 등록하지 않으면, 고객 정보가 삭제되어 매장 연동 등 초기 설정을 다시 진행해야 할 수 있어요.`;
}

export function buildAlimtalkPaymentFailedBody(): string {
  return `올리뷰 결제가 실패하여 서비스 이용이 제한됩니다.

결제 수단을 확인하신 후 재시도해주세요.`;
}

export function buildAlimtalkDissatisfiedReviewBody(
  variables: Record<string, string>,
): string {
  const v = variables;
  return `서비스 올리뷰에서 알려드립니다.

사장님의 가게에 불만족 리뷰가 등록되었습니다. 해당 내용은 사장님 직접 확인이 필요합니다.

${v["플랫폼명"] ?? ""}에 ${v["별점"] ?? ""}리뷰가 달렸습니다. 자동 답글 설정과 관계없이 직접 확인 후 수동으로 답글을 등록해주세요.

리뷰 내용 : ${v["리뷰내용"] ?? ""}
작성자 : ${v["리뷰작성자닉네임"] ?? ""}
등록 일시 : ${v["리뷰등록일시"] ?? ""}`;
}

/** 카카오 심사 문구와 글자 단위 일치 필요 — 변수명·줄바꿈 동기화 */
export function buildAlimtalkWeeklyStoreReportBody(
  variables: Record<string, string>,
): string {
  const 월 = variables["월"] ?? "";
  const 주차 = variables["주차"] ?? "";
  return `${월}월 ${주차}주차 리포트가 도착했어요. 

지난 주 가게 흐름을 한 눈에 확인해보세요. 리포트 내 매장별 정보는 올리뷰 대시보드에서 확인 가능합니다.

사장님, 이번 한 주도 화이팅입니다!`;
}
