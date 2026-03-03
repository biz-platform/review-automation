-- 배민/요기요/땡겨요/쿠팡이츠 공통: 댓글 수정·삭제 시 필요한 플랫폼 답글 ID
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS platform_reply_id TEXT;

COMMENT ON COLUMN reviews.platform_reply_id IS '플랫폼에서 부여한 답글 ID. 수정/삭제 API 호출 시 사용. (배민·요기요·땡겨요·쿠팡이츠 공통)';
