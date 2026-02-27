# 댓글 등록 후 DB 반영 흐름 (상세)

## 1. 전체 흐름

```
[프론트] 등록 클릭
  → POST /api/reviews/[id]/reply/register  { content }
  → createBrowserJob("baemin_register_reply", storeId, userId, { reviewId, external_id, content, written_at })
  → 202 + { jobId }
  → pollBrowserJob(storeId, jobId)  (GET /api/stores/[storeId]/jobs/[jobId])

[워커] claim
  → GET /api/worker/jobs?workerId=...  (x-worker-secret 필요)
  → runJob(baemin_register_reply, ...)  → Playwright로 배민에 댓글 등록
  → submitResult(jobId, true, { reviewId, content })
  → POST /api/worker/jobs/[jobId]/result  { success: true, result: { reviewId, content } }

[API] POST .../result
  → getBrowserJobById(jobId)  (Supabase service role)
  → mergedResult = { ...job.payload, ...result, reviewId, content }  (payload로 보강)
  → applyBrowserJobResult(job, mergedResult)
      → getSupabase().from("reviews").update({ platform_reply_content, updated_at }).eq("id", reviewId)
  → completeBrowserJob(jobId, mergedResult)
  → 200 OK
```

**DB에 반영되는 시점**: `applyBrowserJobResult` 내부에서 `reviews.platform_reply_content` update가 성공할 때.

---

## 2. DB가 안 바뀌는 경우 (가능 원인)

### A) 워커 → API 요청 실패 (가장 유력)

- **증상**: 워커 로그에 `[worker] completed`만 보이고, 실제로는 result가 서버에 안 감.
- **원인**:
  - `SERVER_URL`이 잘못됨 (워커와 Next가 다른 호스트/포트)
  - Next 서버가 꺼져 있음 (ECONNREFUSED)
  - `WORKER_SECRET` 불일치 → 401 → `submitResult` throw
- **과거 버그**: `submitResult`가 실패해도 워커가 그대로 `[worker] completed`를 찍고 있었음.  
  → **수정됨**: result 제출 성공 시에만 `completed` 출력, 실패 시 `result NOT submitted` / `result 제출 실패 → DB 미반영` 로그.

**확인 방법**:
- 워커 로그에 `[worker] result submitted OK → 서버에서 reviews.platform_reply_content 갱신 예정` 이 보이면 → API까지 전달된 것.
- `[worker] server unreachable` / `submit result error` / `result 제출 실패 → DB 미반영` 이 보이면 → API에 결과가 안 간 것 → DB 미반영 맞음.

### B) API(Next)에서 apply 실패

- **가능 원인**:
  - `reviewId` / `content`가 mergedResult에 없음 → apply에서 skip (로그: `register_reply skip: reviewId missing` / `content missing`)
  - Supabase update 실패 (RLS, 네트워크, 키 오류 등) → 로그: `register_reply update review failed` + error.message
- **확인**: Next 서버 로그에 다음이 찍히는지 봐야 함.
  - `[result] register_reply apply 예정` { jobId, reviewId, contentLength }
  - `[applyBrowserJobResult] register_reply updated review` <reviewId>
  - 또는 `register_reply skip` / `update review failed`

### C) 환경 분리

- 워커와 Next가 **서로 다른 .env** 를 쓰면 (다른 Supabase 프로젝트/키), 워커가 job을 claim하는 DB와 Next가 apply할 때 쓰는 DB가 다를 수 있음.
- **확인**: 둘 다 같은 `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 를 쓰는지 확인.

---

## 3. 추가된 로그로 확인하는 방법

1. **워커 터미널**
   - `[worker] result submitted OK` → API까지 전달됨.
   - `[worker] server unreachable` / `submit result error` / `result 제출 실패 → DB 미반영` → API 미전달 → DB 미반영.

2. **Next 서버 터미널 (pnpm dev 등)**
   - `[result] register_reply apply 예정` → result 라우트에서 apply 직전까지 도달.
   - `[applyBrowserJobResult] register_reply updated review` → 실제로 `reviews` update 성공.
   - `register_reply skip` / `update review failed` → reviewId·content 부재 또는 Supabase 오류.

3. **정리**
   - 워커에서 "result submitted OK" + Next에서 "register_reply updated review" 나오면 → DB 반영 정상.
   - "result submitted OK" 없음 → `WORKER_SECRET`, `SERVER_URL`, 서버 기동 여부 점검.
   - "apply 예정"은 있는데 "updated review" 없음 → apply 내부에서 skip 또는 Supabase 에러 로그 확인.
