/**
 * 셀러 영업 링크(?ref=referral_code)로 진입 시 저장하는 키.
 * 회원가입 페이지에서 이 키로 localStorage를 읽어 referred_by_user_id 연결에 사용.
 * 랜딩/진입 페이지에서 ?ref= 있으면 localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, ref) 호출.
 */
export const REFERRAL_CODE_STORAGE_KEY = "oliview_referral_code";
