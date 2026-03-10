# RESTful API 네이밍 가이드

## 적용 완료: Auth

| 기존 (액션 위주) | RESTful (리소스 + 메서드) |
|------------------|---------------------------|
| POST /api/auth/otp/send | POST /api/auth/verification-codes (body: `{ phone }`) |
| POST /api/auth/otp/send-email | POST /api/auth/verification-codes (body: `{ email }`) |
| POST /api/auth/otp/verify | POST /api/auth/verification-codes/validations (body: `{ phone, code }`) |
| POST /api/auth/otp/verify-email | POST /api/auth/verification-codes/validations (body: `{ email, code }`) |
| POST /api/auth/check-availability | POST /api/auth/availability (body: `{ email?,\ phone? }`) |
| POST /api/auth/signout | (유지) 또는 DELETE /api/auth/session + 클라이언트 redirect |

---

## 추후 적용 제안: Stores / Reviews

리소스는 명사(복수), 행동은 HTTP 메서드로 표현.

| 기존 | RESTful 제안 |
|------|----------------------|
| POST .../platforms/{p}/**link** | POST .../platforms/{p}/**connections** (연결 생성) |
| POST .../reviews/**sync** | POST .../platforms/{p}/**review-syncs** (동기화 요청 생성) |
| GET .../reviews/count | GET .../reviews?countOnly=true 또는 GET .../reviews/count (유지 가능) |
| GET .../reviews/summary | GET .../reviews/summary (유지 가능, 하위 리소스) |
| POST .../jobs/[id]/**cancel** | PATCH .../jobs/[id] (body: `{ status: "cancelled" }`) |
| POST .../collect | POST .../review-collection-requests 또는 POST .../reviews/collections |
| POST .../reviews/[id]/collect | POST .../reviews/[id]/collection-requests |
| POST .../reply/**register** | POST .../reviews/[id]/replies (답글 생성) |
| POST .../reply/**approve** | PATCH .../reviews/[id]/reply-drafts (body: `{ status: "approved" }`) |

적용 시: `src/const/endpoint.ts` 경로 수정 후, 해당 경로의 `route.ts` 이동/통합.
