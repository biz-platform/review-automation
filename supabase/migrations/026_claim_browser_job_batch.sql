-- 배치 선점: 같은 (store_id, type, user_id) pending job을 한 번에 선점. 한 배치 = 한 계정만 포함.
CREATE OR REPLACE FUNCTION claim_next_browser_job_batch(p_worker_id TEXT, p_limit INT DEFAULT 20)
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
  -- 1) Pending 1건 선점, store_id / type / user_id 저장
  SELECT id, store_id, type, user_id INTO v_id, v_store_id, v_type, v_user_id
  FROM browser_jobs
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  v_ids := ARRAY[v_id];

  -- 2) store_id NULL(연동 등)이면 1건만 반환
  IF v_store_id IS NULL THEN
    UPDATE browser_jobs
    SET status = 'processing', worker_id = p_worker_id, updated_at = now()
    WHERE id = v_id;
    RETURN QUERY SELECT * FROM browser_jobs WHERE id = v_id;
    RETURN;
  END IF;

  -- 3) 같은 (store_id, type, user_id) 추가 선점 (상한 p_limit - 1)
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

  -- 4) 선점한 모든 행을 processing으로 갱신 후 반환
  UPDATE browser_jobs
  SET status = 'processing', worker_id = p_worker_id, updated_at = now()
  WHERE id = ANY(v_ids);

  RETURN QUERY SELECT * FROM browser_jobs WHERE id = ANY(v_ids) ORDER BY created_at ASC;
END;
$$;
