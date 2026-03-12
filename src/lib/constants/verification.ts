/**
 * 이메일/휴대전화 인증(OTP) 관련 상수.
 * 서버(otp-store, API 라우트)와 클라이언트(signup, useVerificationCodeFlow)에서 공통 사용.
 */

/** 인증번호 유효 시간 (ms). 5분 */
export const OTP_CODE_VALIDITY_MS = 5 * 60 * 1000;

/** 인증번호 유효 시간 (초). UI 타이머용 */
export const OTP_CODE_VALIDITY_SEC = OTP_CODE_VALIDITY_MS / 1000;

/** 재발송 쿨다운 (ms). 60초 */
export const OTP_COOLDOWN_MS = 60 * 1000;

/** 재발송 쿨다운 (초). UI 타이머용 */
export const OTP_COOLDOWN_SEC = OTP_COOLDOWN_MS / 1000;

/** 1시간당 최대 발송 횟수 (이메일·휴대전화 공통) */
export const OTP_MAX_ATTEMPTS_PER_HOUR = 5;

/** 1시간 (ms) */
export const ONE_HOUR_MS = 60 * 60 * 1000;

/** 이메일 OTP 저장소 키 접두사 */
export const OTP_EMAIL_KEY_PREFIX = "email:";

/** 휴대번호 최소 자릿수 (인증 버튼 활성화 기준) */
export const PHONE_MIN_LENGTH_FOR_VERIFY = 10;

/** 휴대번호 최대 자릿수 (입력 제한) */
export const PHONE_MAX_LENGTH = 11;

/** 이메일 형식 검증 정규식 */
export const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Rate limit 시 사용자 안내 메시지 */
export const RATE_LIMIT_MESSAGE = "잠시 후 다시 시도해주세요";

/** 1시간 N회 초과 시 모달 설명문 (API 에러 메시지는 error-codes.ts 사용) */
export const OTP_MAX_ATTEMPTS_MODAL_MESSAGE =
  "인증번호는 1시간에 최대 5번까지 발송돼요";

/** 개발용: 이 이메일로 인증 시 "이미 가입된 이메일" 에러 표시 (API 연동 후 제거) */
export const DEV_MOCK_ALREADY_REGISTERED_EMAIL = "already@example.com";

/** 개발용: 이 번호로 인증 시 "이미 가입된 휴대전화" 에러 표시 (API 연동 후 제거) */
export const DEV_MOCK_ALREADY_REGISTERED_PHONE = "01056891245";
