# 인증 로직 정리

## 1. 전체 구조

```
[클라이언트 요청]
       │
       ▼
┌──────────────────┐
│  proxy (Edge)     │  ← src/proxy.ts → lib/supabase/proxy.ts
│  - 세션 갱신       │
│  - /manage 미인증 → /login 리다이렉트
│  - /login 인증됨  → redirect 파라미터 또는 / 로 리다이렉트
│  - user 있으면    → x-supabase-user-id 헤더 부여 + 쿠키 유지
└────────┬─────────┘
         │
    ┌────┴────┐
    │ 페이지   │  │  API Route
    ▼         │  ▼
┌─────────────┐  ┌─────────────────┐
│ (protected) │  │ getUser(request)│
│ layout      │  │ - cookies() 또는│
│ - 헤더 있음 │  │   Cookie 헤더   │
│   → Supabase│  │   로 세션 읽기   │
│   호출 스킵 │  │ - Supabase      │
│ - 없음      │  │   auth.getUser()│
│   → getUser()│  │   로 서버 검증   │
└─────────────┘  └─────────────────┘
```

---

## 2. Proxy (Edge) — `src/proxy.ts` / `src/lib/supabase/proxy.ts`

| 항목 | 내용 |
|------|------|
| **적용 범위** | `config.matcher`: `_next/static`, `_next/image`, favicon, 정적 이미지 제외한 **모든 요청** |
| **역할** | 1) Supabase 세션 갱신 (getUser로 토큰 검증·갱신) 2) 보호 구역/로그인 페이지 리다이렉트 3) 인증 시 `x-supabase-user-id` 부여 |
| **인증 방식** | `request.cookies` → `createServerClient` → `supabase.auth.getUser()` (서버 검증 1회) |
| **보호 구역** | `pathname.startsWith("/manage")` → 비인증 시 `/login?redirect=...` |
| **로그인 페이지** | `/login` 인데 이미 로그인된 경우 → `redirect` 쿼리 또는 `/` 로 리다이렉트 |
| **헤더** | user 있으면 `x-supabase-user-id` 설정 후 `NextResponse.next({ request: modifiedRequest })` 로 전달. 응답에 갱신된 쿠키도 설정. |

---

## 3. Protected Layout — `src/app/(protected)/layout.tsx`

| 분기 | 동작 |
|------|------|
| **`x-supabase-user-id` 있음** | proxy가 이미 검증함 → Supabase 호출 없이 AppShell + children 렌더. (Next.js 16에서 proxy 이후 `cookies()`가 비어 있을 수 있어 이 경로로 처리.) |
| **헤더 없음** | `createServerSupabaseClient()` + `supabase.auth.getUser()` 1회. 없으면 `redirect("/login")`. |

---

## 4. API Route 인증 — `src/lib/utils/auth/get-user.ts`

| 항목 | 내용 |
|------|------|
| **사용처** | `/api/me/*`, `/api/stores/*`, `/api/reviews/*` 등 **대부분의 보호 API** |
| **쿠키 소스** | `cookies()` 우선, 비어 있으면 `request.headers.get("cookie")` 파싱 (proxy 환경 대응) |
| **검증** | `createServerClient` + `supabase.auth.getUser()` **1회만** (getSession 제거로 중복 제거) |
| **실패 시** | `AppUnauthorizedError` → 401 + RFC 9457 스타일 에러 응답 |

---

## 5. Supabase 클라이언트 정리

| 파일 | 용도 | 인증/키 |
|------|------|--------|
| `lib/db/supabase.ts` | 브라우저 (로그인 폼, useAuthSession 등) | `createBrowserClient`, ANON_KEY |
| `lib/db/supabase-server.ts` | 서버 (layout, callback, 일부 API 내부) | `createServerClient`, cookies() / ANON_KEY. `WORKER_MODE=1`이면 Service Role |
| `lib/utils/auth/get-user.ts` | API Route 전용 | request 기준 쿠키 + `createServerClient` + ANON_KEY |
| `lib/supabase/proxy.ts` | Proxy(Edge) | request.cookies + `createServerClient` + ANON_KEY |

---

## 6. 인증이 없는/다른 방식의 경로

| 경로 | 비고 |
|------|------|
| `/api/auth/signup` | 회원가입. `createServiceRoleClient()`로 `admin.createUser` (서버 전용, 인증 없음) |
| `/api/auth/callback` | OAuth 코드 교환. `createServerSupabaseClient()`로 `exchangeCodeForSession` (코드로 세션 생성) |
| `/api/auth/signout` | 로그아웃. `request.cookies`로 Supabase 클라이언트 생성 후 `signOut` → 리다이렉트 응답에 쿠키 반영 |
| `/api/auth/availability`, `verification-codes`, `verification-codes/validations` | 인증 없음 (공개 또는 별도 검증) |
| `/api/health` | 헬스체크, 인증 없음 |
| `/api/worker/jobs*` | **WORKER_SECRET** (`x-worker-secret` 또는 `Authorization: Bearer <secret>`) 으로 인증. Supabase 사용자 아님 |
| `/api/demo/review-reply` | 데모용, 인증 여부는 구현 확인 필요 |

---

## 7. 로그인 / 로그아웃 흐름

- **로그인 (이메일/비밀번호)**  
  - 클라이언트: `(auth)/login/page.tsx` → `createClient().auth.signInWithPassword()`  
  - 세션은 Supabase가 쿠키에 설정. 이후 `window.location.href = redirectTo` 로 이동.  
  - 해당 요청부터 proxy → layout에서 인증 처리.

- **OAuth (있을 경우)**  
  - `/api/auth/callback` 에서 `exchangeCodeForSession(code)` 후 `origin + next` 로 리다이렉트.

- **로그아웃**  
  - GET/POST `/api/auth/signout` → `createServerClient`(request.cookies) → `signOut()` → 로그아웃 응답에 Set-Cookie로 세션 제거 후 `/login` 리다이렉트.

---

## 8. 보안 요약

- **페이지 접근**: proxy가 `/manage` 비인증 시 `/login`으로 리다이렉트. layout은 헤더 있으면 검증 생략, 없으면 `getUser()`로 한 번 더 검증.
- **API 접근**: proxy는 API에 대해 리다이렉트하지 않고 통과. 각 보호 API가 `getUser(request)`로 **반드시 서버 검증**.
- **x-supabase-user-id**: proxy가 **검증 후에만** 설정. 클라이언트가 임의로 넣어도, proxy가 덮어쓰지 않고 “검증 실패 시 헤더 없음”이므로, layout/API는 검증된 요청만 헤더로 받음. (API는 어차피 `getUser(request)`로 쿠키 검증.)
- **getUser()만 사용**: 서버 검증은 Supabase `getUser()` 1회로 통일. getSession 제거로 “쿠키만 믿는” 경로 없음.

---

## 9. 주의/확인 사항

1. **Next.js 16 + cookies()**  
   proxy 이후 layout에서 `cookies()`가 비어 있을 수 있어, **헤더(`x-supabase-user-id`) 있는 경우 Supabase 호출 스킵**으로 대응. API Route의 `getUser(request)`는 `request.headers.get("cookie")` 폴백으로 동작.

2. **onboarding 등 API에서의 createServerSupabaseClient()**  
   `/api/me/onboarding` 등은 `getUser(request)`로 user 확보 후, `storeService`/DB 조회에 `createServerSupabaseClient()` 사용. 이때 **Route Handler 컨텍스트에서 `cookies()`**가 채워져 있어야 함. (보통 클라이언트 fetch 시 Cookie가 전달되므로 문제 없으나, proxy/Next 버전에 따라 빈 경우만 한 번 확인 권장.)

3. **worker**  
   워커 전용 API는 Supabase 사용자 인증이 아니라 **WORKER_SECRET**만 검사. 서버 환경 변수 노출되지 않도록 유지.
