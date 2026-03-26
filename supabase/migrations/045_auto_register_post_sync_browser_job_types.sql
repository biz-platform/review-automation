-- TS에는 있었으나 DB enum에 없어 insert 실패하던 타입 + 동기화 후 일괄 초안·등록용 타입
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'internal_auto_register_draft';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'auto_register_post_sync';

-- internal 슬롯에서 초안-only job과 동기화 후 파이프라인 job 모두 선점
CREATE OR REPLACE FUNCTION claim_next_browser_job_batch(
  p_worker_id TEXT,
  p_limit INT DEFAULT 20,
  p_platform TEXT DEFAULT NULL
)
RETURNS SETOF browser_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_store_id UUID;
  v_type browser_job_type;
  v_user_id UUID;
  v_ids UUID[] := '{}';
  v_add_id UUID;
BEGIN
  SELECT id, store_id, type, user_id INTO v_id, v_store_id, v_type, v_user_id
  FROM browser_jobs
  WHERE status = 'pending'
    AND (
      p_platform IS NULL
      OR (
        p_platform = 'internal'
        AND type::text IN ('internal_auto_register_draft', 'auto_register_post_sync')
      )
      OR (
        p_platform <> 'internal'
        AND type::text LIKE replace(p_platform, '_', '\_') || '\_%' ESCAPE '\'
      )
    )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  v_ids := ARRAY[v_id];

  IF v_store_id IS NULL THEN
    UPDATE browser_jobs
    SET status = 'processing', worker_id = p_worker_id, updated_at = now()
    WHERE id = v_id;
    RETURN QUERY SELECT * FROM browser_jobs WHERE id = v_id;
    RETURN;
  END IF;

  FOR v_add_id IN
    SELECT id FROM browser_jobs
    WHERE status = 'pending'
      AND store_id = v_store_id
      AND type = v_type
      AND user_id = v_user_id
      AND id != v_id
    ORDER BY created_at ASC
    LIMIT (p_limit - 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    v_ids := array_append(v_ids, v_add_id);
  END LOOP;

  UPDATE browser_jobs
  SET status = 'processing', worker_id = p_worker_id, updated_at = now()
  WHERE id = ANY(v_ids);

  RETURN QUERY
  SELECT * FROM browser_jobs WHERE id = ANY(v_ids) ORDER BY created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION claim_next_browser_job_batch_by_platform(
  p_worker_id TEXT,
  p_limit INT DEFAULT 20,
  p_platform TEXT DEFAULT NULL
)
RETURNS SETOF browser_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_store_id UUID;
  v_type browser_job_type;
  v_user_id UUID;
  v_ids UUID[] := '{}';
  v_add_id UUID;
BEGIN
  SELECT id, store_id, type, user_id INTO v_id, v_store_id, v_type, v_user_id
  FROM browser_jobs
  WHERE status = 'pending'
    AND (
      p_platform IS NULL
      OR (
        p_platform = 'internal'
        AND type::text IN ('internal_auto_register_draft', 'auto_register_post_sync')
      )
      OR (
        p_platform <> 'internal'
        AND type::text LIKE replace(p_platform, '_', '\_') || '\_%' ESCAPE '\'
      )
    )
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  v_ids := ARRAY[v_id];

  IF v_store_id IS NULL THEN
    UPDATE browser_jobs
    SET status = 'processing', worker_id = p_worker_id, updated_at = now()
    WHERE id = v_id;
    RETURN QUERY SELECT * FROM browser_jobs WHERE id = v_id;
    RETURN;
  END IF;

  FOR v_add_id IN
    SELECT id FROM browser_jobs
    WHERE status = 'pending'
      AND store_id = v_store_id
      AND type = v_type
      AND user_id = v_user_id
      AND id != v_id
    ORDER BY created_at ASC
    LIMIT (p_limit - 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    v_ids := array_append(v_ids, v_add_id);
  END LOOP;

  UPDATE browser_jobs
  SET status = 'processing', worker_id = p_worker_id, updated_at = now()
  WHERE id = ANY(v_ids);

  RETURN QUERY
  SELECT * FROM browser_jobs WHERE id = ANY(v_ids) ORDER BY created_at ASC;
END;
$$;
