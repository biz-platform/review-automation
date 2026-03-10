# Review Automation

매장 리뷰를 한곳에서 조회·관리하는 웹 앱. 플랫폼 연동(배민·쿠팡이츠·요기요·땡겨요) 후 리뷰 수집은 **작업 큐 + 로컬 워커**로 처리되고, 서버에서는 Playwright를 실행하지 않는다.

## 기술 스택

- **Next.js 16** (App Router, proxy), **React 19**
- **Supabase** (Auth, DB, `auth.users` + `public.users`)
- **Tailwind CSS 4**, **TanStack Query**, **Zod**
- **Playwright** (워커에서만 사용: 연동·리뷰 수집 시 브라우저 자동화)

## 요구 사항

- Node.js 18+
- pnpm
- Supabase 프로젝트
- 리뷰/연동 사용 시: Playwright Chromium (`npx playwright install chromium`)

## 환경 변수

`.env.local` 예시:

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 서버 전용 (워커·job·회원가입 API 적용 시)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 휴대번호 인증(SMS) – 회원가입 시 사용
COOLSMS_API_KEY=your_coolsms_api_key
COOLSMS_API_SECRET=your_coolsms_api_secret
COOLSMS_SENDER=발신번호

# 워커 (별도 프로세스 실행 시)
WORKER_SECRET=shared_secret_between_server_and_worker
SERVER_URL=http://localhost:3000
WORKER_ID=local-1
```

- **앱/서버**: `NEXT_PUBLIC_*`, (선택) `SUPABASE_SERVICE_ROLE_KEY`, (선택) CoolSMS 변수(휴대번호 OTP 발송 시)
- **워커**: 위에 더해 `WORKER_SECRET`, `SERVER_URL`(배포 시에는 배포 도메인), (선택) `WORKER_ID`. `WORKER_MODE=1`과 Supabase 키는 스크립트에서 자동 처리.

## 설치 및 실행

```bash
pnpm install
npx playwright install chromium
```

**개발**

```bash
# 터미널 1: Next 서버
pnpm dev

# 터미널 2: 워커 (연동·리뷰 수집 처리)
pnpm run worker
```

`http://localhost:3000`에서 접속. 연동/리뷰 수집은 워커가 돌아갈 때만 처리된다.

**프로덕션**

- Next: `pnpm build` 후 `pnpm start` (또는 호스팅 배포)
- 워커: 같은 레포의 `pnpm run worker`를 서버/VM에서 상시 실행 (systemd, PM2 등). `SERVER_URL`을 배포 URL로 설정.

## DB 마이그레이션

Supabase에 `supabase/migrations/` 아래 SQL을 **순서대로** 적용한다.

- `005_browser_jobs.sql`: 작업 큐 테이블 및 `claim_next_browser_job` RPC (워커 job 처리에 필요)
- `018_*`: auth.users 이메일/휴대번호 중복 검사 RPC (회원가입·인증 전 검사)
- `019_*`: `public.users` (앱 프로필·역할·셀러 여부)
- `020_*`: `stores.trial_ends_at`, 첫 플랫폼 연동 시 1개월 무료체험 설정

## 아키텍처 요약

- **연동/리뷰 수집**: 클라이언트가 API 호출 → 서버는 `browser_jobs`에 작업만 넣고 `202 + jobId` 반환 → 클라이언트는 job 상태 폴링 → **워커**가 job을 claim 후 Playwright로 실행하고 결과를 서버에 제출 → 서버가 세션/리뷰 DB 반영.
- **인증**: Supabase Auth. API는 `getUser()`로 세션 조회(쿠키 우선, 헤더 폴백). 로그아웃은 `POST/GET /api/auth/signout`으로 세션 정리 후 `/login` 리다이렉트.

## 주요 기능

- **회원가입** – 이메일·휴대번호 OTP 인증(자체 API + CoolSMS), 비밀번호·약관 후 `POST /api/auth/signup`으로 auth.users + public.users 생성
- **로그인** – Supabase Auth (이메일·비밀번호)
- **로그아웃** – `POST /api/auth/signout` 호출 후 `/login` 이동
- **매장** – 매장 CRUD, 매장별 플랫폼 연동(계정) 관리. **무료체험**: 첫 플랫폼 연동 시 1개월 `trial_ends_at` 설정, 만료 시 402 + 유료 전환 안내 모달
- **플랫폼 연동** – 배민·요기요·땡겨요 연동(로그인·쿠키 저장). 쿠팡이츠 연동은 워커 미지원. 플랫폼당 매장 1계정.
- **리뷰 수집** – 연동 후 동기화 시 워커가 Playwright로 수집 → DB upsert
- **리뷰 관리** – 플랫폼별 필터, 동기화, DB 리뷰 목록 조회

## 문서

- `docs/design-public-users-and-auth.md` – public.users·역할·인증 설계
- `docs/design-store-trial-and-platform.md` – 무료체험·플랫폼당 1계정
- `docs/git-split-branches.md` – 변경사항 브랜치·커밋 분리 가이드

## 스크립트

| 명령어          | 설명                     |
| --------------- | ------------------------ |
| `pnpm dev`      | 개발 서버 실행           |
| `pnpm build`    | 프로덕션 빌드            |
| `pnpm start`    | 프로덕션 서버            |
| `pnpm run worker` | 워커 실행 (job 폴링·실행) |
| `pnpm lint`     | ESLint 실행              |

| 스크립트 | 설명 |
| ---------|------ |
| `scripts/split-branches.ps1` | 작업 트리 변경을 공통 분모별 브랜치로 나누기 (PowerShell) |
