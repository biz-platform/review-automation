-- 배민: 사장님(CEO) 답글과 별도로, 플랫폼 운영자 등 비가게 답글 본문을 동기화해 둔다.
-- platform_reply_content 는 CEO 전용 유지 → 미답변 필터는 그대로(사장님 미작성).
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS platform_operator_reply_content TEXT;

COMMENT ON COLUMN reviews.platform_operator_reply_content IS
  '배민 등: 가게 사장님(CEO) 외 주체(운영자·CS 등)의 노출 답글 본문. 사장님 미답변이어도 플랫폼에 답이 있으면 채움.';
