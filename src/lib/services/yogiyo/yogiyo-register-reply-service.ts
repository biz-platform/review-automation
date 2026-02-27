/**
 * 요기요 사장님 댓글 등록 (브라우저 자동화 또는 API).
 * 현재는 스텁: 실제 UI/API 연동 시 구현.
 */
export type RegisterYogiyoReplyParams = {
  reviewExternalId: string;
  content: string;
};

export async function registerYogiyoReplyViaBrowser(
  _storeId: string,
  _userId: string,
  _params: RegisterYogiyoReplyParams,
): Promise<void> {
  throw new Error(
    "요기요 사장님 댓글 등록은 현재 준비 중입니다. 요기요 CEO 앱 또는 웹에서 직접 등록해 주세요.",
  );
}
