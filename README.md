# Review Automation

매장 리뷰를 한곳에서 조회·관리하는 웹 앱. 배달의민족 셀프 리뷰 연동 후 동기화하면 DB에 저장되고, 관리 화면에서는 DB만 조회한다.

## 기술 스택

- **Next.js 16** (App Router), **React 19**
- **Supabase** (Auth, DB)
- **Tailwind CSS 4**, **TanStack Query**, **Zod**
- **Playwright** (배민 셀프 리뷰 수집 시 브라우저 자동화)

## 요구 사항

- Node.js 18+
- pnpm
- Supabase 프로젝트
- 배민 리뷰 동기화 사용 시: Playwright Chromium (`npx playwright install chromium`)

## 환경 변수

`.env.local`에 다음을 설정한다.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Supabase 대시보드에서 URL과 anon key를 복사해 넣으면 된다.

## 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 배민 동기화 사용 시 Chromium 설치
npx playwright install chromium

# 개발 서버
pnpm dev
```

`http://localhost:3000`에서 접속한다.

## DB 마이그레이션

Supabase 프로젝트에 `supabase/migrations/` 아래 SQL을 순서대로 적용한다. (Supabase 대시보드 SQL Editor 또는 CLI 사용)

## 주요 기능

- **로그인** – Supabase Auth
- **매장** – 매장 CRUD, 매장별 계정(플랫폼 연동) 관리
- **배달의민족 연동** – 셀프 서비스 로그인·쿠키 저장 후, 리뷰 동기화(Playwright로 전체 스크롤 수집 → DB upsert)
- **리뷰 관리** – 플랫폼별 필터, 배민 연동 매장 선택, 동기화 버튼, DB 리뷰 목록 조회

## 스크립트

| 명령어       | 설명           |
| ------------ | -------------- |
| `pnpm dev`   | 개발 서버 실행 |
| `pnpm build` | 프로덕션 빌드  |
| `pnpm start` | 프로덕션 서버  |
| `pnpm lint`  | ESLint 실행    |
