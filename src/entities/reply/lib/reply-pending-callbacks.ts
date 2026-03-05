/**
 * 리뷰 수정/삭제/등록 mutation이 settle될 때 해당 reviewId를 pending에서 제거하기 위한 콜백.
 * 페이지에서 설정하고, useModifyReply/useDeleteReply/useRegisterReply 훅의 onSettled에서 호출.
 * (연속 mutate 시 호출당 onSettled는 마지막 것만 호출될 수 있어, 훅 레벨 onSettled + 이 ref로 정리)
 */
export const replyPendingCallbacksRef: {
  current: {
    removePendingModify?: (reviewId: string) => void;
    removePendingDelete?: (reviewId: string) => void;
    removePendingRegister?: (reviewId: string) => void;
  } | null;
} = { current: null };
