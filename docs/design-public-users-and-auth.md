# public.users 설계 및 인증 플로우

## 1. 현재 구조 (Supabase MCP 기준)

### public 스키마
| 테이블 | 설명 | FK |
|--------|------|-----|
| stores | 매장. user_id → auth.users | auth.users(id) |
| tone_settings | 매장별 톤 설정. store_id → stores | stores(id) |
| reviews | 리뷰. store_id → stores | stores(id) |
| reply_drafts | 답글 초안. review_id → reviews | reviews(id) |
| store_platform_sessions | 플랫폼 세션(배민/요기요 등). store_id → stores | stores(id) |
| browser_jobs | 브라우저 작업 큐. store_id, user_id → auth.users | stores(id), auth.users(id) |
| reviews_archive | 아카이브된 리뷰. store_id → stores | stores(id) |

### RLS 요약
- **stores**: `auth.uid() = user_id` → 본인 매장만 ALL
- **tone_settings, reviews, reply_drafts, store_platform_sessions, reviews_archive**: stores 경유로 본인 매장 데이터만 ALL
- **browser_jobs**: 본인 매장에 대해 SELECT·INSERT만 가능, UPDATE/DELETE는 정책 없음(서버/워커만)

### auth.users
- Supabase 관리. id, email, phone, email_confirmed_at, phone_confirmed_at, raw_user_meta_data 등.
- **등급(일반/센터장/플래너), 셀러 여부 등 앱 전용 필드는 없음.**

---

## 2. auth.users만 쓸지, public.users를 둘지

**권장: public.users(프로필·권한 테이블) 추가**

| 구분 | auth.users만 | public.users 추가 |
|------|--------------|-------------------|
| 등급/역할 | raw_user_meta_data에 JSON으로 넣을 수는 있으나, 쿼리·RLS·인덱스 불편 | 컬럼으로 관리 가능, RLS·조인·어드민 쿼리 단순 |
| 셀러 권한 | JWT custom claim 등으로 가능하나, DBtalk·CS 승인 플로우와 연동 시 공급 주체가 나뉨 | public에서 is_seller 등 플래그로 일원화 |
| 스키마 변경 | Supabase Auth 스키마 직접 수정 비권장 | public은 우리가 마이그레이션으로 자유롭게 변경 |
| 가입 후 동기화 | - | 가입/로그인 시 auth.users ↔ public.users 1:1 동기화(트리거 또는 앱에서 처리) |

→ **등급·셀러·DBtalk 인증·CS 승인** 같은 비즈니스 필드는 **public.users**에서 관리하는 쪽이 유지보수와 확장에 유리함.

---

## 3. public.users 스키마 제안

```sql
-- 등급: 일반 회원, 센터장, 플래너
CREATE TYPE public.user_role AS ENUM ('member', 'center_manager', 'planner');

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  role public.user_role NOT NULL DEFAULT 'member',
  is_seller BOOLEAN NOT NULL DEFAULT false,
  dbtalk_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- auth.users와 1:1. 이메일/폰은 조회·표시용으로 동기화
CREATE UNIQUE INDEX idx_users_email ON public.users(lower(trim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_users_phone ON public.users(trim(phone)) WHERE phone IS NOT NULL;

COMMENT ON COLUMN public.users.role IS 'member: 일반 회원, center_manager: 센터장(DBtalk 인증), planner: 플래너(CS 확인 후 권한 부여)';
COMMENT ON COLUMN public.users.is_seller IS '셀러 권한. 센터장 인증 시 true, 플래너는 어드민에서 부여';
COMMENT ON COLUMN public.users.dbtalk_verified_at IS 'DBtalk 인증 완료 시각. 센터장/플래너 구분에 사용';
```

- **role**: 일반 회원(member), 센터장(center_manager), 플래너(planner).
- **is_seller**: 셀러 권한. 센터장이면 DBtalk 인증 시 true, 플래너는 CS 확인 후 어드민에서 true로 변경.
- **dbtalk_verified_at**: DBtalk 인증 완료 시점 기록. 센터장/플래너 구분·감사용.

---

## 4. RLS 제안

- **본인**: 자신의 1행만 SELECT 가능 (프로필 조회).
- **수정**: 본인은 role/is_seller 수정 불가. 서비스 역할 또는 “어드민용” 정책으로만 UPDATE.
- **삽입**: 가입 완료 시 서버(또는 트리거)에서 INSERT.

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 본인 프로필만 조회
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- INSERT/UPDATE/DELETE는 service_role 또는 어드민 전용 함수로만 (정책 없음 = anon/authenticated 불가)
```

→ 앱 클라이언트는 프로필 조회만 하고, 등급/셀러 변경은 백엔드·어드민에서만 수행.

---

## 5. 플로우 정리

1. **가입**
   - 이메일·휴대번호 중복 검사: `auth.users` 기준 (현재 구현: `check_auth_email_exists`, `check_auth_phone_exists`).
   - OTP 발송·검증 후 Supabase `signUp` (또는 기존 자체 OTP + 회원 생성 API).
   - 가입 완료 시 `public.users`에 1행 INSERT (id = auth.uid(), email/phone, role = 'member', is_seller = false). 트리거로 할 수도 있고, 회원가입 API에서 할 수도 있음.

2. **DBtalk 인증**
   - 인증 결과에서 센터장/플래너 구분.
   - **센터장**: `public.users`에서 해당 id에 role = 'center_manager', is_seller = true, dbtalk_verified_at = now() 업데이트 (백엔드/서비스 역할).
   - **플래너**: role = 'planner', is_seller = false, dbtalk_verified_at = now() 업데이트. 셀러 권한은 주지 않음.

3. **플래너 셀러 권한**
   - CS팀 확인 후, 어드민 페이지에서 해당 user의 is_seller를 true로 변경 (서비스 역할 또는 어드민 전용 API).

4. **stores와의 관계**
   - 기존처럼 `stores.user_id` → `auth.users(id)` 유지.
   - “셀러만 매장 생성 가능” 등 제한이 필요하면, 앱/API에서 `public.users`의 role·is_seller를 조회해 검사.

---

## 6. 구현 체크리스트

- [x] 이메일/휴대번호 중복 검사: `auth.users` 기준 RPC + `/api/auth/check-availability`
- [x] OTP 발송 전 signup에서 위 API 호출해 이미 가입된 경우 “이미 가입된 이메일/휴대전화” 표시
- [ ] migration: `public.user_role` enum + `public.users` 테이블 + RLS
- [ ] 가입 완료 시 `public.users` INSERT (트리거 또는 회원가입 API)
- [ ] DBtalk 인증 연동 시 role/is_seller/dbtalk_verified_at 업데이트 로직
- [ ] 어드민: 플래너에게 is_seller 부여 API/UI
