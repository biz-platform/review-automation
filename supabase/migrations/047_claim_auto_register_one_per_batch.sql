-- auto_register_post_sync 는 job마다 payload.platform 이 다르다.
-- 동일 (store_id, type, user_id) 배치 규칙으로 4플랫폼 job이 한 번에 묶이면
-- 한 슬롯만 수 분간 Gemini·파이프라인을 돌리고, 다른 슬롯은 sync 등만 돌아
-- "슬롯3만 멈춘 것처럼" 보인다. 이 타입만 배치 확장(추가 선점)을 하지 않는다.

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
  SELECT b.id, b.store_id, b.type, b.user_id INTO v_id, v_store_id, v_type, v_user_id
  FROM browser_jobs b
  WHERE b.status = 'pending'
    AND (
      p_platform IS NULL
      OR (
        p_platform = 'internal'
        AND b.type::text IN ('internal_auto_register_draft', 'auto_register_post_sync')
      )
      OR (
        p_platform <> 'internal'
        AND b.type::text LIKE replace(p_platform, '_', '\_') || '\_%' ESCAPE '\'
      )
    )
    AND NOT (
      b.type::text IN (
        'baemin_register_reply',
        'yogiyo_register_reply',
        'ddangyo_register_reply',
        'coupang_eats_register_reply'
      )
      AND COALESCE(b.payload->>'trigger', '') = 'cron'
      AND EXISTS (
        SELECT 1
        FROM browser_jobs p
        WHERE p.status = 'pending'
          AND p.type::text = 'auto_register_post_sync'
          AND p.store_id = b.store_id
          AND p.payload->>'platform' = (
            CASE b.type::text
              WHEN 'baemin_register_reply' THEN 'baemin'
              WHEN 'yogiyo_register_reply' THEN 'yogiyo'
              WHEN 'ddangyo_register_reply' THEN 'ddangyo'
              WHEN 'coupang_eats_register_reply' THEN 'coupang_eats'
              ELSE NULL
            END
          )
      )
    )
  ORDER BY b.created_at ASC
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

  IF v_type::text <> 'auto_register_post_sync' THEN
    FOR v_add_id IN
      SELECT b2.id
      FROM browser_jobs b2
      WHERE b2.status = 'pending'
        AND b2.store_id = v_store_id
        AND b2.type = v_type
        AND b2.user_id = v_user_id
        AND b2.id != v_id
        AND NOT (
          b2.type::text IN (
            'baemin_register_reply',
            'yogiyo_register_reply',
            'ddangyo_register_reply',
            'coupang_eats_register_reply'
          )
          AND COALESCE(b2.payload->>'trigger', '') = 'cron'
          AND EXISTS (
            SELECT 1
            FROM browser_jobs p
            WHERE p.status = 'pending'
              AND p.type::text = 'auto_register_post_sync'
              AND p.store_id = b2.store_id
              AND p.payload->>'platform' = (
                CASE b2.type::text
                  WHEN 'baemin_register_reply' THEN 'baemin'
                  WHEN 'yogiyo_register_reply' THEN 'yogiyo'
                  WHEN 'ddangyo_register_reply' THEN 'ddangyo'
                  WHEN 'coupang_eats_register_reply' THEN 'coupang_eats'
                  ELSE NULL
                END
              )
          )
        )
      ORDER BY b2.created_at ASC
      LIMIT (p_limit - 1)
      FOR UPDATE SKIP LOCKED
    LOOP
      v_ids := array_append(v_ids, v_add_id);
    END LOOP;
  END IF;

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
  SELECT b.id, b.store_id, b.type, b.user_id INTO v_id, v_store_id, v_type, v_user_id
  FROM browser_jobs b
  WHERE b.status = 'pending'
    AND (
      p_platform IS NULL
      OR (
        p_platform = 'internal'
        AND b.type::text IN ('internal_auto_register_draft', 'auto_register_post_sync')
      )
      OR (
        p_platform <> 'internal'
        AND b.type::text LIKE replace(p_platform, '_', '\_') || '\_%' ESCAPE '\'
      )
    )
    AND NOT (
      b.type::text IN (
        'baemin_register_reply',
        'yogiyo_register_reply',
        'ddangyo_register_reply',
        'coupang_eats_register_reply'
      )
      AND COALESCE(b.payload->>'trigger', '') = 'cron'
      AND EXISTS (
        SELECT 1
        FROM browser_jobs p
        WHERE p.status = 'pending'
          AND p.type::text = 'auto_register_post_sync'
          AND p.store_id = b.store_id
          AND p.payload->>'platform' = (
            CASE b.type::text
              WHEN 'baemin_register_reply' THEN 'baemin'
              WHEN 'yogiyo_register_reply' THEN 'yogiyo'
              WHEN 'ddangyo_register_reply' THEN 'ddangyo'
              WHEN 'coupang_eats_register_reply' THEN 'coupang_eats'
              ELSE NULL
            END
          )
      )
    )
  ORDER BY b.created_at ASC
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

  IF v_type::text <> 'auto_register_post_sync' THEN
    FOR v_add_id IN
      SELECT b2.id
      FROM browser_jobs b2
      WHERE b2.status = 'pending'
        AND b2.store_id = v_store_id
        AND b2.type = v_type
        AND b2.user_id = v_user_id
        AND b2.id != v_id
        AND NOT (
          b2.type::text IN (
            'baemin_register_reply',
            'yogiyo_register_reply',
            'ddangyo_register_reply',
            'coupang_eats_register_reply'
          )
          AND COALESCE(b2.payload->>'trigger', '') = 'cron'
          AND EXISTS (
            SELECT 1
            FROM browser_jobs p
            WHERE p.status = 'pending'
              AND p.type::text = 'auto_register_post_sync'
              AND p.store_id = b2.store_id
              AND p.payload->>'platform' = (
                CASE b2.type::text
                  WHEN 'baemin_register_reply' THEN 'baemin'
                  WHEN 'yogiyo_register_reply' THEN 'yogiyo'
                  WHEN 'ddangyo_register_reply' THEN 'ddangyo'
                  WHEN 'coupang_eats_register_reply' THEN 'coupang_eats'
                  ELSE NULL
                END
              )
          )
        )
      ORDER BY b2.created_at ASC
      LIMIT (p_limit - 1)
      FOR UPDATE SKIP LOCKED
    LOOP
      v_ids := array_append(v_ids, v_add_id);
    END LOOP;
  END IF;

  UPDATE browser_jobs
  SET status = 'processing', worker_id = p_worker_id, updated_at = now()
  WHERE id = ANY(v_ids);

  RETURN QUERY
  SELECT * FROM browser_jobs WHERE id = ANY(v_ids) ORDER BY created_at ASC;
END;
$$;
