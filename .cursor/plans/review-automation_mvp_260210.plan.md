---
name: review-automation MVP
overview: Next.js 15+ App Router + Supabase(Auth/Postgres) 기반 리뷰 자동화 웹 서비스 MVP를, 제시한 폴더 구조·API·도메인 모델과 frontend/backend 규칙에 맞춰 처음부터 구현하는 계획이다.
todos: []
isProject: false
---

# review-automation MVP 구현 계획

## 0. 전제 및 스택 확정

- **프로젝트 현황**: `src/` 없음. Next.js·TS·Tailwind·Supabase 프로젝트를 새로 생성해야 함.
- **인증**: Supabase Auth만 사용 (JWT+bcrypt 미사용). Route Handler에서 `getUser()`(Supabase `getUser()` 또는 `createServerClient`로 세션 검증).
- **DB 접근**: MVP는 **Supabase JS Client 직접 쿼리** 권장. 테이블/컬럼은 backend-convention(복수 테이블명, snake_case, `_at`) 준수. Prisma 도입은 선택(나중에 `@prisma/adapter-supabase` 등 검토).
- **Route Handler**: frontend-convention에 따라 **withRouteHandler** 래핑 + 성공 시 `NextResponse.json<AppRouteHandlerResponse<T>>({ result })`, 에러는 **AppNextRouteHandlerError** → `error.toObject()` 또는 기존 **handleRouteError**와 통합(한쪽으로 일원화).
- **규칙 파일**: [frontend-convention.md](.cursor/rules/frontend-convention.md), [backend-convention.mdc](.cursor/rules/backend-convention.mdc) 적용. frontend glob은 이 프로젝트에 맞게 `src/**/*.{ts,tsx}` 등으로 조정 권장.

---

## 1. 프로젝트 셋업

- Next.js 16+ (App Router), TypeScript strict, Tailwind 4, shadcn/ui 초기화.
- 절대 경로 `@/` 설정 (`tsconfig.json` paths).
- 패키지: `@supabase/supabase-js`, `zod`, `@tanstack/react-query`, `date-fns` 등 추가.
- 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용). [lib/config/env.ts](src/lib/config/env.ts)에서 Zod로 검증.

---

## 2. Supabase 스키마 및 RLS

**테이블 (복수명, snake_case 컬럼)**

| 테이블            | 주요 컬럼                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **stores**        | id(uuid), name, user_id(uuid, auth.uid()), created_at, updated_at                                                                                   |
| **tone_settings** | store_id(fk), tone(enum 또는 text), extra_instruction(text), updated_at. PK는 store_id 단일 또는 (store_id, id)                                     |
| **reviews**       | id, store_id, platform(enum: naver/baemin/yogiyo/coupang_eats/ddangyo), external_id, rating, content, author_name, written_at(optional), created_at |
| **reply_drafts**  | id, review_id(fk), draft_content, status(pending/approved/rejected), approved_content(nullable), approved_at(nullable), created_at, updated_at      |

- RLS: 모든 테이블에 `user_id`(또는 store 거쳐서) 기준으로 `auth.uid()`와 매칭되는 정책. `stores.user_id`로 소유자 결정, `reviews`/`reply_drafts`는 `store_id` → `stores.user_id`로 JOIN 정책.
- Supabase 대시보드에서 마이그레이션 적용 또는 SQL 파일로 버전 관리.

---

## 3. 공통 인프라 (lib)

- **[lib/db/supabase.ts](src/lib/db/supabase.ts)**: `createBrowserClient`(클라이언트), `createServerClient`(서버·쿠키 기반 세션). 서비스 로직용 admin은 `serviceRoleKey` 클라이언트(RLS 우회 시만).
- **[lib/utils/auth/get-user.ts](src/lib/utils/auth/get-user.ts)**: Route Handler에서 사용할 `getUser(request)` → Supabase 서버 클라이언트로 쿠키에서 세션 조회, 실패 시 `AppUnauthorizedError` throw.
- **[lib/errors/app-error.ts](src/lib/errors/app-error.ts)**: `AppError`, `AppBadRequestError`, `AppNotFoundError`, `AppUnauthorizedError` 등. `AppNextRouteHandlerError`는 RFC 9457 + code/requestMethod/timestamp, `.toObject()` 제공.
- **[lib/utils/route-error-handler.ts](src/lib/utils/route-error-handler.ts)**: `handleRouteError(error)` — Zod / AppError / 기타 → `NextResponse.json(createErrorResponse(...))`.
- **withRouteHandler**: `(handler) => (req, ctx?) => handler(req, ctx).catch(e => handleRouteError(e))` 형태로 래핑. 반환은 `NextResponse.json({ result })`. `AppNextRouteHandlerError`면 `error.toObject()` 사용하도록 handleRouteError와 통일.
- **[lib/types/api/response.ts](src/lib/types/api/response.ts)**: `AppRouteHandlerResponse<T>`, `ApiResponse<T>`, `ApiResponseWithCount<T>`, `ErrorResponse`(RFC 9457).
- **[lib/config/env.ts](src/lib/config/env.ts)**: Zod 스키마로 env 검증.

---

## 4. API Route Handlers 구조

모든 핸들러는 **withRouteHandler**로 래핑. 내부에서:

1. (보호 라우트) `getUser(request)`로 user 확인.
2. Query/body는 **Zod 스키마**로 파싱.
3. **Service** 호출 후 `NextResponse.json({ result })` 또는 `{ result, count }`.
4. 예외는 **handleRouteError** 또는 AppNextRouteHandlerError로 일원 처리.

**경로별 책임**

- `GET/POST /api/stores` — 목록(본인), 생성. Service: `StoreService.findAll(userId)`, `create(userId, dto)`.
- `GET/PATCH/DELETE /api/stores/[id]` — 단일 조회/수정/삭제. 소유권은 Service에서 store 조회 후 `user_id` 비교.
- `GET/PATCH /api/stores/[id]/tone-settings` — 말투 조회/수정. Service: `ToneSettingsService.getByStoreId`, `upsert(storeId, dto)`.
- `GET /api/reviews` — 목록. Query: `storeId`, `platform`, pagination. Service: `ReviewService.findAll(filter)`.
- `GET /api/reviews/[id]` — 상세. Service: `findById(id)`, 소유권은 review → store → user_id.
- `POST /api/reviews/[id]/collect` — **MVP: mock**. 더미 리뷰 insert 또는 고정 mock 반환. 이후 플랫폼 API로 교체.
- `POST /api/reviews/[id]/reply/draft` — AI 초안 생성. Service: store의 tone_settings + 리뷰 content로 프롬프트 구성 후 AI 호출(OpenAI 등), `reply_drafts`에 저장 후 반환.
- `POST /api/reviews/[id]/reply/approve` — **MVP: mock**. body에 최종 답글 텍스트. reply_draft 상태를 approved로, approved_content/approved_at 저장. “전송”은 로그/DB만.
- `GET /api/health` — DB 연결 등 간단 체크, `{ result: { status: "ok" } }`.

**인증**: `/api/auth/`, `/api/health` 제외하고 Route Handler 내부에서 `getUser(request)` 호출. 미들웨어에서 Supabase 세션 검증해도 됨(선택).

---

## 5. Service 레이어

- **StoreService**: create, findAll(userId), findById(id), update(id, dto), delete(id). 소유권 검사 후 진행.
- **ToneSettingsService**: getByStoreId(storeId), upsert(storeId, { tone, extra_instruction }).
- **ReviewService**: findAll({ storeId, platform, limit, offset }), findById(id), collectMock(storeId 또는 reviewId) — MVP mock.
- **ReplyDraftService**: createDraft(reviewId, draftContent), getByReviewId(reviewId), approve(reviewId, approvedContent) — MVP 전송 mock.

AI 초안: 별도 **ReplyDraftService.generateDraft(reviewId)** — review + store tone_settings 조회 후 LLM 호출, draft_content 저장 후 반환.

---

## 6. DTO 및 검증

- [lib/types/dto/](src/lib/types/dto/) 또는 도메인별 분리: store-dto, review-dto, reply-dto, tone-settings-dto.
- Zod 스키마 + `z.infer<>` 타입. 목록 쿼리: pagination(limit, offset), storeId, platform 등.
- 공통: paginationSchema, idParamSchema 등.

---

## 7. 프론트엔드 구조 (규칙 준수)

- **API 호출**: [entities/domain/api/](src/entities/)에 `AsyncApiRequestFn<R, P>` 형태. 응답은 `{ result }` 또는 `{ result, count }` 가정. URL은 [const/endpoint.ts](src/const/endpoint.ts) 상수만 사용.
- **타입**: 응답 `*Data`, 요청 `*ApiRequestData`, 목록 `*ListApiRequestData`, Create/Update/Delete DTO 대응 타입.
- **React Query**: [const/query-keys.ts](src/const/query-keys.ts)에 QUERY_KEY, createQueryKey. **컴포넌트에서는 useQuery/useMutation 직접 사용 금지** — [entities/domain/hooks/query](src/entities/store/hooks/query/) 또는 hooks/mutation에 useBaseQuery/useBaseMutation 기반 커스텀 훅만 노출.
- **엔티티**: store, review, reply. 각각 api, hooks/query(또는 mutation), types.
- **페이지/위젯**: [app/(protected)/](<src/app/(protected)/>) 아래 stores, reviews. raw div/span/button 지양, [components/ui](src/components/ui)(shadcn), [components/shared](src/components/shared) 사용. CVA로 variant 컴포넌트.
- **인증**: Supabase Auth 로그인/회원가입 화면. `(protected)` 레이아웃에서 세션 체크 후 미로그인 시 리다이렉트.

---

## 8. 프론트 플로우 (MVP)

- **매장**: 목록 → 등록/수정/삭제. 상세에서 tone_settings 편집.
- **리뷰**: 매장 선택 → 리뷰 목록(플랫폼 필터) → 상세. 상세에서 「수집」(mock), 「AI 초안 생성」 → 초안 표시 → 사용자 수정 → 「승인 후 전송」(mock).
- **보호 라우트**: `(protected)` 레이아웃에서 Supabase `getSession()` 후 없으면 로그인 페이지로.

---

## 9. API 수집 경로 보완

명세상 `POST /api/reviews/[id]/collect`는 “리뷰 상세에서 수집”으로 해석. MVP에서는 **해당 리뷰의 store_id에 대해 수집 트리거**로 처리 가능(한 건 리뷰 id로 store를 찾아 mock 수집 실행). 또는 “해당 스토어의 리뷰 수집”을 `POST /api/stores/[id]/collect`로 두고, 리뷰 상세 페이지에서는 “스토어 수집” 버튼으로 연결할 수 있음. 계획에서는 명세대로 `POST /api/reviews/[id]/collect` 유지하고, 내부에서 store_id 기준 mock 수집으로 구현.

---

## 10. 체크리스트 요약

| 항목        | 내용                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| Next/TS     | App Router, strict, `@/`                                                 |
| Supabase    | 프로젝트 생성, 테이블(stores, tone_settings, reviews, reply_drafts), RLS |
| Auth        | Supabase Auth, 보호 라우트·Route Handler에서 세션 검증                   |
| Route       | withRouteHandler, `{ result }` / handleRouteError · AppError 일관        |
| DTO         | Zod 스키마 + infer, Service에서 사용                                     |
| FE API      | entities/domain/api, AsyncApiRequestFn, *Data/*ApiRequestData            |
| React Query | QUERY_KEY, createQueryKey, 커스텀 훅만 사용                              |
| UI          | Tailwind 4 + shadcn, CVA, 공용 컴포넌트                                  |
| MVP mock    | 수집·전송 mock 후 추후 교체                                              |

---

## 11. 구현 순서 제안

1. **프로젝트 초기화** — Next.js, Tailwind, shadcn, Supabase 클라이언트, env 검증.
2. **공통 lib** — errors, route-error-handler, withRouteHandler, getuser, api/response 타입.
3. **Supabase 스키마·RLS** — 테이블 생성, 정책 적용.
4. **Store API + Service + DTO** — stores CRUD, tone-settings.
5. **Review API + Service** — 목록/상세, collect mock.
6. **Reply API + Service** — draft 생성(AI), approve(mock).
7. **health** — GET /api/health.
8. **Auth** — Supabase Auth 연동, (protected) 레이아웃, 로그인/회원가입 페이지.
9. **FE entities** — store, review, reply (api, hooks, types).
10. **FE 페이지** — 매장 목록/상세/등록/수정, 리뷰 목록/상세, 수집·초안·승인 플로우.
11. **AI 초안** — tone_settings + 리뷰 content로 LLM 호출(GEMINI 등), 환경 변수로 API 키 관리.

이 순서로 진행하면 백엔드 규칙·프론트 규칙·명세를 한 번에 만족하는 MVP를 구현할 수 있다.
