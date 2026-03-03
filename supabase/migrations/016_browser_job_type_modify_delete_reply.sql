-- 배민/요기요/땡겨요/쿠팡이츠 댓글 수정·삭제 브라우저 작업 타입 추가
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'baemin_modify_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'baemin_delete_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'yogiyo_modify_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'yogiyo_delete_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'ddangyo_modify_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'ddangyo_delete_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'coupang_eats_modify_reply';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'coupang_eats_delete_reply';
