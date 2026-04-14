# Review Automation (Oliview)

배달·매장 플랫폼 리뷰를 한곳에서 조회·동기화·답글(초안·등록)까지 다루는 웹 앱. **브라우저 자동화(Playwright)는 워커 프로세스에서만** 돌고, Next API는 작업 큐(`browser_jobs`) 적재·결과 반영·비즈니스 로직을 담당한다.

## 기술 스택

- **Next.js 16** (App Router), **React 19**
- **Supabase** — Auth, Postgres, RLS
- **Tailwind CSS 4**, **TanStack Query**, **Zod**
- **Playwright** — 워커 전용(연동·리뷰 수집·일부 플랫폼 답글 등록)
- **AI 답글 초안** — Google GenAI SDK, `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY` (모델은 `ai-draft-service` 등 코드 참고)
- **PM2** — 워커 상시 실행(단일/리뷰·주문 분리)

## 요구 사항

- **Node.js** 18+ (로컬은 20+ 권장)
- **pnpm**
- **Supabase** 프로젝트 + `supabase/migrations` 순서 적용
- 워커 사용 시: `npx playwright install chromium`

## 환경 변수

`.env.local` 예시(값은 실제 키로 교체):

```env
# Supabase (앱 필수)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# 서버·워커 (job 큐·관리 API·회원가입 훅 등)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 워커 ↔ 앱
WORKER_SECRET=shared_secret_between_server_and_worker
SERVER_URL=http://localhost:3000
WORKER_ID=local-1

# 선택: 리뷰/주문 워커 분리 (마이그레이션 066 이후)
# WORKER_JOB_FAMILY=reviews   # 또는 orders
# WORKER_LOCK_FILE=.worker-reviews.lock

# 휴대번호 인증(SMS) — 회원가입 등
COOLSMS_API_KEY=
COOLSMS_API_SECRET=
COOLSMS_SENDER=

# AI 답글 초안
GEMINI_API_KEY=
# 또는 GOOGLE_API_KEY=

# Vercel Cron 등 — /api/cron/* 호출 시
CRON_SECRET=

# 구독·무료체험 정책(선택, billing 로직)
# MEMBER_TRIAL_ELIGIBLE_SINCE_ISO=
# MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO=
```

- **앱**: `NEXT_PUBLIC_*` 필수, Cron 라우트 쓰면 `CRON_SECRET`, AI 초안 쓰면 Gemini 키.
- **워커**: `WORKER_SECRET`, `SERVER_URL`, Supabase 키; 분리 운영 시 `WORKER_JOB_FAMILY`·`WORKER_LOCK_FILE`·고유 `WORKER_ID` 조합 권장.

## 설치 및 실행

```bash
pnpm install
npx playwright install chromium
```

**개발**

```bash
# 터미널 1: Next
pnpm dev

# 터미널 2: 워커 (리뷰·연동·답글 job — 기본)
pnpm run worker

# 선택: 주문 동기화만 담당하는 워커 (066 이후 큐에서 orders family만 선점)
pnpm run worker:orders
```

`http://localhost:3000` — 연동·리뷰·주문 수집 job은 워커가 떠 있어야 처리된다.

**프로덕션**

- Next: `pnpm build` → `pnpm start` (또는 Vercel 등)
- 워커: 동일 레포에서 `pnpm run worker` 또는 PM2. `SERVER_URL`을 배포 URL로 설정.

### PM2 (워커)

**동일 머신에서** `pnpm run worker`와 PM2 워커를 **동시에 실행하지 말 것**. 인스턴스 락 파일(예: `.worker-reviews-pm2.lock`) 기준으로 중복 기동 시 재시작 루프가 날 수 있다.

- **분리 운영**(권장): 마이그레이션 `066_claim_job_family.sql` 적용 후 `reviews` / `orders` 패밀리별 선점.
  - `pnpm worker:pm2:start:split` — `review-worker` + `orders-worker`
  - 주문만: `pnpm worker:pm2:start:orders`
- 설정: `ecosystem.config.cjs`
- 상세: `docs/worker-supervisor.md`

```bash
pnpm worker:pm2:start          # review-worker 만
pnpm worker:pm2:start:split    # 리뷰 + 주문
pnpm worker:pm2:logs           # / logs:orders / logs:split
pnpm worker:pm2:restart        # ecosystem 반영 시 --update-env 경로 사용
pnpm worker:pm2:save
```

### Vercel Cron (`vercel.json`)

| 스케줄(UTC 기준) | 경로 |
|------------------|------|
| 매시 정각 | `/api/cron/scheduled-auto-register` |
| 매일 15:05 | `/api/cron/baemin-orders-daily`, `yogiyo-orders-daily`, `ddangyo-orders-daily` |
| 매일 16:30 UTC | `/api/cron/purge-store-platform-orders` — `store_platform_orders` 90일(기본) 초과 행 삭제 |

호출부는 `CRON_SECRET`으로 검증한다. 주문 원장 보관 일수는 선택 env `STORE_PLATFORM_ORDERS_RETENTION_DAYS`(30~366)로 조정.

## DB 마이그레이션

`supabase/migrations/` 아래 SQL을 **파일명 순서대로** 원격 DB에 적용한다.

- 초기 스키마·리뷰·세션·암호화 쿠키: `001`~
- **`005_browser_jobs.sql`** — `browser_jobs` 큐, `claim_next_browser_job` 등
- **인증 보조 RPC**: `018_auth_check_exists_functions.sql` 등
- **`019_public_users.sql`** — `public.users` (앱 프로필·역할)
- **체험/연동**: `020`대 — `trial_ends_at`, 첫 플랫폼 연동 트리거 등
- **배치·플랫폼 필터·자동등록 파이프라인**: `026`~`047` 등
- **주문·대시보드 집계**: `062`~`064` — `store_platform_orders`, `store_platform_dashboard_*`
- **주문 job 타입**: `065_browser_job_type_orders_sync.sql`
- **워커 패밀리 선점**: **`066_claim_job_family.sql`** — `claim_next_browser_job_batch*`에 `p_job_family` (`orders` \| `reviews`)

전체 이력은 폴더 목록이 소스 오브 트루스다.

## Supabase — 주요 테이블 (public)

실제 스키마는 MCP `list_tables` 또는 Studio에서 확인. 개발 기준 요약:

| 영역 | 테이블 | 설명 |
|------|--------|------|
| 계정 | `users` | `auth.users` 1:1, 역할·셀러·구독 관련 필드 등 |
| 매장 | `stores`, `store_platform_sessions`, `store_platform_shops` | 매장·플랫폼별 로그인 세션·가게 매핑 |
| 설정 | `tone_settings` | AI 톤·자동등록 스케줄 등 |
| 리뷰 | `reviews`, `reply_drafts`, `reviews_archive`, `reviews_unlink_retention` | 본문·초안·보관·연동 해제 스냅샷 |
| 작업 | `browser_jobs` | 워커 큐(pending → 처리 → 결과) |
| 주문·지표 | `store_platform_orders`, `store_platform_order_daily`, `store_platform_dashboard_daily`, `store_platform_dashboard_menu_daily` | 플랫폼별 주문 원장·일별 CRM식 집계·대시보드용 rollup |
| 인증 보조 | `verification_otp`, `password_recovery_sessions`, `otp_phone_verify_failures` | OTP·비번 찾기·실패 제한 |

## Supabase — 주요 RPC (`public`)

| 함수 | 인자 요약 | 용도 |
|------|-----------|------|
| `claim_next_browser_job` | `p_worker_id` | 단일 job 선점(SKIP LOCKED) |
| `claim_next_browser_job_batch` | `p_worker_id`, `p_limit`, [`p_platform`], [`p_job_family`] | 배치 선점; `p_job_family`로 orders/reviews 분리(066) |
| `claim_next_browser_job_batch_by_platform` | worker, limit, platform, job_family | 플랫폼+패밀리 필터 배치 |
| `check_auth_email_exists` / `check_auth_phone_exists` / `check_auth_phone_matches_email` | email·phone | 가입·로그인 전 중복 검사 |
| `get_auth_email_by_phone_e164` | phone | 휴대폰 → 이메일 조회 |
| `normalize_phone_to_e164` | phone | 번호 정규화 |
| `get_auth_user_id_for_password_recovery` | email, phone | 비번 찾기용 user id |
| `set_store_trial_on_first_platform_link` | (트리거) | 첫 연동 시 체험 만료일 설정 |
| `unlink_platform_session_with_review_snapshot` | store_id, platform | 연동 해제 + 리뷰 retention 스냅샷 |
| `purge_expired_reviews_unlink_retention` | — | retention 만료 분 삭제 |
| `archive_old_reviews` | — | 오래된 리뷰 아카이브 |
| `cascade_delete_on_session_unlink` | — | 세션 unlink 시 연쇄 정리 |
| `admin_list_customers` | limit, offset, keyword, member_type | 관리자 고객 목록 |

## 아키텍처 요약

1. 클라이언트가 연동·동기화·답글 등 API 호출 → 서버가 `browser_jobs`에 `pending`으로 넣고 **202 + jobId** 등으로 응답.
2. **워커**가 RPC로 job을 claim → Playwright/API로 플랫폼 작업 수행 → `/api/worker/jobs/[id]/result`로 결과 제출 → 서버가 세션·`reviews`·주문 테이블 등 갱신.
3. **주문 동기화**(`baemin_orders_sync`, `yogiyo_orders_sync`, `ddangyo_orders_sync`)는 별도 job 패밀리; 쿠팡이츠는 **주문 동기화 job 없음**(리뷰·연동·답글 쪽은 워커 지원).
4. **인증**: Supabase Auth + proxy에서 세션 갱신 후 `x-supabase-user-id` 헤더 전달, `(protected)` 레이아웃에서 헤더 우선·없으면 `getUser()` 폴백(Next 16에서 동일 요청 `cookies()` 공백 이슈 완화 패턴). 자세한 설명은 기존 README 논지와 `docs/auth-flow.md` 참고.

## 주요 기능 (관리자 UI 기준)

- **온보딩** — `/manage` → 매장 없음·미연동 시 매장 관리, AI 설정 미완료 시 `/manage/reviews/settings`
- **매장** — CRUD, 플랫폼별 계정·연동(배민·쿠팡이츠·요기요·땡겨요), 첫 연동 무료체험(`trial_ends_at`)·만료 시 유료 안내
- **리뷰 관리** — 플랫폼/매장 필터, 동기화, 목록·상세, AI 초안(`reply_drafts`), 승인·플랫폼 등록·수정/삭제 job
- **대시보드** — `/manage/dashboard` — 한눈에 요약(AI 요약 카피), KPI, 리뷰/매출/메뉴 등 서브 경로
- **구매·이용** — `/manage/billing/*`
- **셀러/소개** — `/manage/sellers/*` (고객·정산·링크 등)
- **관리자** — `/manage/admin/*` — 고객·매장·결제·정산·스토어별 대시보드·실시간 job 등

## 문서

| 문서 | 내용 |
|------|------|
| `docs/design-public-users-and-auth.md` | public.users·역할·인증 |
| `docs/design-store-trial-and-platform.md` | 체험·플랫폼당 계정 |
| `docs/worker-supervisor.md` | PM2·systemd |
| `docs/worker-batch-multi-account.md` | 배치 job |
| `docs/register-reply-db-flow.md` | 답글 등록 흐름 |
| `docs/unlink-retention.md` | 연동 해제 retention |
| `docs/auth-flow.md` | 로그인·세션 |
| `docs/git-split-branches.md` | 브랜치 분리 |

## 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` / `build` / `start` | Next |
| `pnpm run worker` | 워커(기본 패밀리) |
| `pnpm run worker:reviews` / `worker:orders` | 패밀리 고정 + 전용 락 파일 |
| `pnpm worker:pm2:*` | PM2 시작·재시작·로그·저장 (`:orders`, `:split` 변형 포함) |
| `pnpm lint` | ESLint |
| `pnpm archive-reviews` | 오래된 리뷰 아카이브 스크립트 |
| `scripts/dev-*-orders-fetch*.ts` | 주문 수집 로컬 실험용 |

| 스크립트 | 설명 |
|----------|------|
| `scripts/split-branches.ps1` | 작업 트리를 주제별 브랜치로 분리 (PowerShell) |

---

Supabase 프로젝트 ID·테이블 row 수 등은 환경마다 다르다. 최신 정의는 **Supabase MCP**(`list_tables`, `execute_sql`) 또는 **Dashboard → SQL**에서 확인하는 것을 권장한다.
