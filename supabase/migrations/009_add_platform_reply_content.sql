-- 플랫폼에 이미 달린 답글 내용 (배민 comments[0].contents 등). null이면 미답변.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS platform_reply_content TEXT;

COMMENT ON COLUMN reviews.platform_reply_content IS '플랫폼에 등록된 답글 내용. null = 미답변';
