/**
 * 쿠팡이츠 답글 등록 실패 시 브라우저 작업 error_message로 저장되어
 * 앱 토스트·작업 로그에 그대로 노출되는 문구.
 */
export const COUPANG_EATS_REPLY_REGISTER_RESTRICTED_USER_MESSAGE =
  "쿠팡이츠에서 이 리뷰에 대한 사장님 댓글 작성이 제한된 상태입니다. " +
  "리뷰 관리 화면에 「사장님 댓글 등록하기」가 보이지 않는 경우, 플랫폼 측 제한일 수 있습니다.\n\n" +
  "제한 사유 확인 및 해제는 쿠팡이츠 사장님 고객센터(사장님광장 앱·웹)로 문의해 주세요.";

/** 리뷰 작성일 기준 2주(14일) 초과 등 — 재로그인으로 해결되지 않는 경우 */
export const COUPANG_EATS_REPLY_DEADLINE_EXPIRED_USER_MESSAGE =
  "쿠팡이츠는 리뷰 작성일 기준 14일(2주) 이내에만 사장님 답글을 등록·수정할 수 있습니다. " +
  "이 리뷰는 답글 가능 기한이 지났습니다.";
