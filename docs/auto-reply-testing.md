# 자동 답글 동작 테스트

## 사전 조건

1. **매장 톤 설정**
   - `tone_settings.comment_register_mode` = `'auto'`
   - (cron 전체 플로우 테스트 시) `auto_register_scheduled_hour` = 테스트할 KST 시각(0~23)

2. **테스트할 리뷰**
   - 해당 매장·플랫폼에 **미답변 리뷰**(`platform_reply_content`가 null)가 있어야 함
   - **별점 4~5점**만 자동 답글 대상 (3점 이하는 제외)

3. **환경 변수** (워커/크론 호출 시)
   - `WORKER_SECRET`: 워커 API 인증 (execute-internal-draft, result 제출 등)
   - `CRON_SECRET`: 크론 API 인증 (전체 플로우 테스트 시)

---

## 방법 1: Dev API로 job만 생성 후 워커 실행 (가장 간단)

sync 없이 **이미 DB에 있는 미답변 리뷰**에 대해 자동 답글 job만 만들고, 워커가 처리하는 흐름.

1. **Next.js 서버 실행**
   ```bash
   pnpm dev
   ```

2. **자동 답글 job 생성** (development에서만 동작)
   ```bash
   curl -X POST http://localhost:3000/api/dev/trigger-auto-register-jobs \
     -H "Content-Type: application/json" \
     -d '{"storeId":"<매장UUID>"}'
   ```
   - 해당 매장에 **연동된 모든 플랫폼**(store_platform_sessions 기준)에 대해 job 생성. `userId`는 매장 소유자로 자동 조회.
   - 응답 `ok: true`, `platforms: ["baemin", ...]` 후 `browser_jobs` 테이블에 각 플랫폼별 `register_reply` 또는 `internal_auto_register_draft` job이 생성됨

3. **워커 실행**
   ```bash
   pnpm worker
   ```
   - 생성된 job을 가져가서 실행
   - **초안 있는 리뷰** → `*_register_reply` 실행 → 플랫폼에 댓글 등록
   - **초안 없는 리뷰** → `internal_auto_register_draft` 실행 → AI 초안 생성 후 `register_reply` job 생성 → 다음 배치에서 플랫폼 등록

4. **결과 확인**
   - `browser_jobs`에서 해당 job의 `status`, `result`, `error_message` 확인
   - 리뷰 목록에서 해당 리뷰의 `platform_reply_content` 등 반영 여부 확인

---

## 방법 2: Cron 호출 → Sync job 생성 → 워커가 sync 후 자동 답글 (전체 플로우)

실제 자동 답글과 동일하게 **cron이 sync job을 만들고**, 워커가 sync 실행 → 결과 제출 → 서버가 `createRegisterReplyJobsForUnansweredAfterSync` 호출 → 워커가 답글 job 실행하는 흐름.

1. **톤 설정**
   - 테스트할 매장의 `tone_settings`에서 `comment_register_mode = 'auto'`, `auto_register_scheduled_hour` = 현재 KST 시각(0~23)으로 설정

2. **Cron API 호출** (sync job 생성, payload에 `trigger: "cron"` 포함)
   ```bash
   curl -X GET "http://localhost:3000/api/cron/scheduled-auto-register" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
   - 이 시각에 `auto_register_scheduled_hour`가 같은 매장에 대해 플랫폼별 sync job이 생성됨

3. **워커 실행**
   ```bash
   pnpm worker
   ```
   - sync job 수주 → sync 실행 → 결과 제출
   - 서버의 `applyBrowserJobResult`에서 `trigger === "cron"`이므로 `createRegisterReplyJobsForUnansweredAfterSync` 호출
   - 새로 생성된 `register_reply` / `internal_auto_register_draft` job을 워커가 다음 배치에서 처리

4. **결과 확인**
   - sync로 새 리뷰가 들어왔는지, 그 리뷰들에 대해 자동 답글 job이 생성·실행됐는지 `browser_jobs`와 리뷰 테이블에서 확인

---

## 참고

- **실시간 리뷰 불러오기**(수동 sync)는 `trigger: "cron"`이 없어서, sync 후 자동 답글 job이 생성되지 않음 (의도된 동작).
- `createRegisterReplyJobsForUnansweredAfterSync`는 해당 매장의 `comment_register_mode === 'auto'`일 때만 job을 생성함.
