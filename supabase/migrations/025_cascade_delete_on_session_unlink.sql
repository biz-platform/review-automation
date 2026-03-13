-- store_platform_sessions 행 삭제(연동 해제) 시 해당 store_id + platform의
-- reviews, reviews_archive 삭제. reply_drafts는 reviews(id) ON DELETE CASCADE로 자동 삭제.

CREATE OR REPLACE FUNCTION cascade_delete_on_session_unlink()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- reviews 삭제 → reply_drafts는 FK ON DELETE CASCADE로 자동 삭제
  DELETE FROM reviews
  WHERE store_id = OLD.store_id
    AND platform = OLD.platform::platform_enum;

  DELETE FROM reviews_archive
  WHERE store_id = OLD.store_id
    AND platform = OLD.platform::platform_enum;

  RETURN OLD;
END;
$$;

CREATE TRIGGER after_store_platform_sessions_delete
  AFTER DELETE ON store_platform_sessions
  FOR EACH ROW
  EXECUTE PROCEDURE cascade_delete_on_session_unlink();

COMMENT ON FUNCTION cascade_delete_on_session_unlink() IS '연동 해제 시 해당 매장·플랫폼의 리뷰/아카이브/초안 함께 삭제';
