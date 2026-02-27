/**
 * 쿠팡이츠 사장님 댓글 등록 (브라우저 자동화 또는 API).
 * 현재는 스텁: 실제 UI/API 연동 시 구현.
 */
export type RegisterCoupangEatsReplyParams = {
  reviewExternalId: string;
  content: string;
};

export async function registerCoupangEatsReplyViaBrowser(
  _storeId: string,
  _userId: string,
  _params: RegisterCoupangEatsReplyParams,
): Promise<void> {
  throw new Error(
    "쿠팡이츠 사장님 댓글 등록은 현재 준비 중입니다. 쿠팡이츠 스토어에서 직접 등록해 주세요.",
  );
}
