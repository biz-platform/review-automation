# 연동 해제 리뷰 스냅샷 (어드민 전용)

## 동작 요약

- **039**: `reviews_unlink_retention` 테이블 생성(초기에는 트리거 포함했으나 아래 040에서 제거).
- **040 / 041**: `store_platform_sessions` DELETE **트리거 제거** → 대신 RPC  
  `unlink_platform_session_with_review_snapshot(store_id, platform)` 한 번에  
  (**041**: RPC 인자 `text` + 내부 `platform_enum` 캐스팅. **`store_platform_sessions.platform` 은 TEXT 컬럼**이라 세션 DELETE 는 `platform = v_platform::text` — 안 하면 `42883`)
- **042**: 동일 매장·플랫폼·`external_id` 가 retention 에 중복 쌓이지 않도록 부분 유니크 인덱스 + `INSERT … ON CONFLICT DO UPDATE`(재연동 후 `reviews.id`만 바뀐 경우 대비).
  - 스냅샷 INSERT → `reviews` / `reviews_archive` DELETE → **세션 행 DELETE**
- **앱**: `deletePlatformSession`, 워커 로그인 실패 시 연동 해제 모두 위 RPC 호출(`platform-unlink-service.ts`).
- **일반 사용자 RLS**: `reviews_unlink_retention`에 대한 SELECT 정책 없음 → **매장 앱/고객 JWT로는 조회 불가**.
- **어드민**: `GET /api/admin/stores/{userId}/unlink-retention` (service role + `is_admin` 검증).

## `purge_expired_reviews_unlink_retention` — 언제 돌아가나?

- DB에 **내장 스케줄 없음**. 자동으로 안 돌아감.
- **권장**: Vercel Cron(또는 유사)으로  
  `GET /api/cron/purge-unlink-retention` 호출 (`CRON_SECRET` 동일 패턴 as `scheduled-auto-register`).
- 또는 Supabase SQL Editor / Studio에서 수동:  
  `SELECT public.purge_expired_reviews_unlink_retention();`  
  (`service_role`만 `EXECUTE` 허용)

## 프론트

- 스냅샷 목록은 **어드민 화면**에서만 `getAdminStoreUnlinkRetention` 등으로 붙이면 됨. 리뷰 관리(매장) 목록 API에는 포함하지 않음.

## 보관 기간 변경

RPC `unlink_platform_session_with_review_snapshot` 내부 `interval '30 days'` 수정 후 배포.
