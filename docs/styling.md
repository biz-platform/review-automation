# 스타일링 가이드

이 프로젝트는 **Tailwind CSS**를 기본 스타일링 방식으로 사용합니다.

## 설정 요약

- **Tailwind**: v4 (`tailwindcss`, `@tailwindcss/postcss`)
- **진입점**: `src/app/globals.css` — `@import "tailwindcss"` 및 `@theme`으로 디자인 토큰 정의
- **루트 레이아웃**: `src/app/layout.tsx`에서 `./globals.css` import
- **PostCSS**: `postcss.config.mjs`에서 `@tailwindcss/postcss` 사용

## 사용 원칙

1. **Tailwind 유틸리티 우선**: 레이아웃·색상·타이포·간격은 Tailwind 클래스로 작성.
2. **디자인 토큰 사용**: 색상·radius는 `globals.css`의 `@theme` 토큰 사용 (`bg-primary`, `text-gray-01`, `rounded-md` 등). 자세한 목록은 `docs/design-tokens-color.md` 참고.
3. **인라인 스타일 지양**: `style={{}}` 대신 Tailwind 또는 `@layer components` 내 클래스 사용.
4. **반복 패턴**: 유틸만 나열하기보다 컴포넌트 또는 CVA로 추상화.

## 브레이크포인트 (레이아웃 가이드 1440 / 1920 기준)

| 이름 | min-width | 용도 |
|------|-----------|------|
| (기본 ~ xl) | 0 ~ 1280px | 모바일·태블릿 (sm/md/lg/xl 기본값 유지) |
| **2xl** | **1281px** | 작은 데스크 (1281~1439) |
| **3xl** | **1440px** | 메인 디자인 기준 (1440~1919) |
| **4xl** | **1920px** | 1920+ 콘텐츠 최대 1550px |

## 레이아웃 (데스크톱 1280~1920)

- **LNB**: 1280px ~ 1920px 구간 동일 **280px 고정** (`w-lnb` 또는 `var(--width-lnb)`).
- **콘텐츠 영역**: 고정이 아닌 **가변 폭**
  - 1440px 뷰포트 시 **1070px**
  - 뷰포트가 커질수록 증가, 1920px에서 **최대 1550px**
  - 수식: `clamp(1070px, 100vw - 370px, 1550px)` (370 = LNB 280 + 좌 50 + 우 40)
- **콘텐츠 패딩**: 1441~1920 동일 — **상 32 / 하 80 / 좌 50 / 우 40** (px).

CSS 변수·클래스:

- `--width-lnb`, `--layout-content-width`, `--layout-content-padding-*` (`globals.css` `:root`)
- `.layout-content`: 가변 폭 + 상하좌우 패딩 적용
- LNB 너비: `w-lnb` (Tailwind `@theme`의 `--width-lnb`)

## 레이아웃 적용 범위 (일괄 적용 구조)

- **스타일 적용**: `app/(protected)/layout.tsx`에서 `AppShell` 사용 → **`/stores`, `/reviews` 등 (protected) 하위 전체**에 GNB + LNB + `.layout-content` 일괄 적용.
- **스타일 미적용**: `(protected)` 밖의 라우트 → **로그인(`/login`)**, 회원가입, 랜딩(`/`) 등은 루트 `layout.tsx`만 적용되어 전체 폭 사용.
- **구조**: `(protected)/layout.tsx` → `AppShell` (GNB + LNB + `<main>` 내부 `div.layout-content`) → `ProtectedLayoutContent`(ErrorBoundary) → `children`. 로그인/회원가입 페이지는 `app/login/page.tsx` 등으로 `(protected)` 그룹 밖에 두면 됨.

## 관련 파일

- `src/app/globals.css` — Tailwind 진입점, `@theme`, `:root`/`.dark`, `@layer base`
- `docs/design-tokens-color.md` — 컬러 시스템 토큰
- `src/lib/utils/cn.ts` — `cn()` (clsx + tailwind-merge) 클래스 병합 유틸
