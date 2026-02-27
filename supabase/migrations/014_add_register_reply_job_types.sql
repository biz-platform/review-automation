-- 요기요/땡겨요/쿠팡이츠 사장님 댓글 등록 브라우저 작업 타입 추가
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'yogiyo_register_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'ddangyo_register_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'coupang_eats_register_reply';
