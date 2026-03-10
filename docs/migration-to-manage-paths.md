# /manage 경로 전환 체크리스트

**적용 완료.** (protected)/manage/stores, (protected)/manage/reviews 로 이동 후 경로 참조 일괄 수정함.

## 1. 폴더 이동

`(protected)` 하위를 `manage` 아래로 옮긴다.

```
(protected)/
  stores/          →  (protected)/manage/stores/
  reviews/         →  (protected)/manage/reviews/
  AppShell.tsx     →  그대로 (protected) 루트에 유지)
```

- **실제 작업**: `src/app/(protected)/manage/` 폴더를 만든 뒤, `stores`·`reviews` 폴더를 그 안으로 이동.
- **결과 URL**:
  - `/stores` → `/manage/stores`
  - `/stores/new` → `/manage/stores/new`
  - `/stores/[id]` → `/manage/stores/[id]`
  - `/reviews/manage` → `/manage/reviews/manage`
  - `/reviews/[id]` → `/manage/reviews/[id]`

(선택) `reviews/manage` 중복이 어색하면: `reviews/manage/page.tsx` 내용을 `reviews/page.tsx`로 옮기고, 리뷰 메인 URL을 `/manage/reviews`로 쓰면 됨.

---

## 2. 수정할 파일 (페이지 경로만, API 경로 제외)

**참고**: `/api/stores`, `/api/reviews`는 그대로 두고, **브라우저에서 쓰는 경로**(`href`, `router.push`, `redirect` 등)만 `/manage/...`로 바꾼다.

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/supabase/proxy.ts` | `isProtected`: `pathname.startsWith("/stores")` 등 → `pathname.startsWith("/manage")` |
| `src/components/layout/GNB.tsx` | `href="/stores"` → `href="/manage/stores"`, `href="/reviews/manage"` → `href="/manage/reviews/manage"` (또는 `/manage/reviews`), `href="/"` 유지 |
| `src/app/(protected)/AppShell.tsx` | LNB 링크: `/stores` → `/manage/stores`, `/reviews/manage` → `/manage/reviews/manage` (또는 `/manage/reviews`) |
| `src/app/(auth)/page.tsx` | `href="/stores"` → `href="/manage/stores"`, `href="/reviews/manage"` → `href="/manage/reviews/manage"` (또는 `/manage/reviews`) |
| `src/app/api/auth/callback/route.ts` | `next ?? "/stores"` → `next ?? "/manage/stores"` (또는 `"/manage"` 등 원하는 기본값) |

**stores·reviews 내부 페이지 (이동 후 경로: `(protected)/manage/...`)**

| 파일 | 변경 내용 |
|------|-----------|
| `manage/stores/page.tsx` | `href="/stores/new"`, `href={/stores/${id}}`, `href={/stores/${id}/reviews}`, `href={/stores/${id}/accounts...}` → `/manage/stores/...` |
| `manage/stores/new/page.tsx` | `router.push("/stores")`, `href="/stores"` → `/manage/stores` |
| `manage/stores/[id]/page.tsx` | `router.push("/stores")`, `href="/stores"`, `href={/stores/${id}/reviews}` → `/manage/stores/...` |
| `manage/stores/[id]/reviews/page.tsx` | `href={/stores/${storeId}}` → `/manage/stores/${storeId}` |
| `manage/stores/[id]/accounts/page.tsx` | `href="/stores"`, `href={/stores/${storeId}}` → `/manage/stores/...` |
| `manage/reviews/[id]/page.tsx` | `router.replace("/reviews/manage")` → `/manage/reviews/manage` (또는 `/manage/reviews`) |
| `manage/reviews/manage/page.tsx` | `reviews/manage?platform=...`, `reviews/manage` → `manage/reviews/manage?...` 또는 `manage/reviews?...` |
| `manage/reviews/manage/use-reviews-manage-state.ts` | `/stores/...` → `/manage/stores/...` (accounts 링크) |

---

## 3. 작업 순서 제안

1. `(protected)/manage/` 생성.
2. `(protected)/stores` → `(protected)/manage/stores` 이동.
3. `(protected)/reviews` → `(protected)/manage/reviews` 이동.
4. 위 표 기준으로 proxy, GNB, AppShell, (auth)/page, callback 순으로 경로 문자열 수정.
5. `manage/stores/*`, `manage/reviews/*` 내부 링크 수정.
6. 브라우저에서 `/manage/stores`, `/manage/reviews/manage`(또는 `/manage/reviews`) 접속·이동 확인.

---

## 4. API 경로

`/api/stores`, `/api/reviews`는 **그대로** 둔다. 프론트에서 쓰는 건 `src/const/endpoint.ts` 등 기존 API 베이스 경로만 있으면 되고, 페이지 URL과는 별개다.
