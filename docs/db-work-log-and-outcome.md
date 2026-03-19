# 작업 로그 보관 및 성공/실패 기준 — DB 제안

Supabase MCP로 확인한 **review-automation** 프로젝트 DB 기준으로 정리했습니다.

---

## 1. 현재 구조 (browser_jobs)

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid | PK |
| type | browser_job_type | enum (baemin_link, baemin_sync, *_register_reply, *_modify_reply, *_delete_reply 등) |
| store_id | uuid | nullable (첫 연동 시 null) |
| user_id | uuid | |
| status | browser_job_status | **pending \| processing \| completed \| failed \| cancelled** |
| payload | jsonb | |
| result | jsonb | 성공 시 워커가 제출한 결과 |
| error_message | text | 실패 시 메시지 |
| worker_id | text | |
| created_at, updated_at | timestamptz | |

- 작업 로그는 **browser_jobs만** 존재하며, 별도 로그 전용 테이블은 없음.
- 성공/실패는 **status** 로만 구분 가능: `completed` = 성공, `failed` = 실패.

---

## 2. 성공/실패 명확한 기준 (현재 테이블만 사용 시)

browser_jobs만 쓸 때는 아래처럼 규칙을 고정하면 됩니다.

| status | 의미 | UI 표시 |
|--------|------|--------|
| **completed** | 작업 정상 완료 | 성공 |
| **failed** | 작업 실패 (error_message 참고) | 오류 |
| **cancelled** | 사용자/시스템 취소 | 오류 또는 "취소" |
| **pending**, **processing** | 미완료 | "대기 중" / "진행 중" (필터에서 제외하거나 별도 표시) |

- **성공**: `status = 'completed'`
- **실패**: `status IN ('failed', 'cancelled')`  
  (취소를 “실패”와 같이 묶을지, 별도 뱃지로 할지는 정책 선택)

추가 컬럼 없이도 **작업 로그 목록/필터**는 이 기준으로 구현 가능합니다.

---

## 3. 신규 테이블 제안 (작업 로그 전용 — 선택)

“작업 로그를 따로 보관”하고, **성공/실패를 명시적으로** 남기고 싶다면 아래처럼 **work_log_entries** (또는 job_log_entries) 테이블을 두는 방식을 권장합니다.

### 3.1 work_log_entries

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK, default gen_random_uuid() |
| browser_job_id | uuid | FK → browser_jobs(id), nullable (수동 로그용) |
| store_id | uuid | nullable, FK → stores(id) |
| user_id | uuid | FK → auth.users(id) |
| platform | text | baemin, yogiyo, ddangyo, coupang_eats 등 |
| category | text | **sync \| register_reply \| link \| modify_delete \| other** (type에서 파생) |
| **outcome** | text | **success \| failure** (성공/실패 명시) |
| message | text | 사용자용 한글 메시지 (예: "리뷰 12건을 불러왔어요.") |
| error_message | text | 실패 시 상세 (error_message 복사 또는 가공) |
| created_at | timestamptz | default now() |

- **성공/실패 기준**: `outcome = 'success'` / `outcome = 'failure'` 로 명확히 구분.
- 워커가 job을 **completed** 또는 **failed**로 결과 제출할 때, 이 테이블에 1건 INSERT.
- 어드민 “작업 로그” 탭은 이 테이블 기준으로 기간/매장/카테고리/전체·성공·오류 필터 제공.

### 3.2 마이그레이션 예시 (신규 테이블)

```sql
-- 작업 로그 전용 테이블 (성공/실패 명시)
CREATE TABLE public.work_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_job_id UUID REFERENCES public.browser_jobs(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT,
  category TEXT NOT NULL,  -- sync | register_reply | link | modify_delete | other
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  message TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_log_entries_user_created ON public.work_log_entries(user_id, created_at DESC);
CREATE INDEX idx_work_log_entries_store_created ON public.work_log_entries(store_id, created_at DESC) WHERE store_id IS NOT NULL;
CREATE INDEX idx_work_log_entries_outcome ON public.work_log_entries(outcome);
CREATE INDEX idx_work_log_entries_category ON public.work_log_entries(category);

COMMENT ON TABLE public.work_log_entries IS '작업 로그. browser_jobs 완료/실패 시 1건씩 적재. outcome으로 성공/실패 명확 구분.';
COMMENT ON COLUMN public.work_log_entries.outcome IS 'success | failure';
```

- RLS는 어드민/서비스 역할만 조회하도록 두거나, user_id 기준으로 본인 로그만 보게 할 수 있음.

---

## 4. browser_jobs만 쓸 때 (수정 없이)

- **신규 테이블/컬럼 없이** 작업 로그 = browser_jobs 조회.
- 성공: `status = 'completed'`
- 실패: `status IN ('failed', 'cancelled')`
- 카테고리: `type`에서 파생 (sync / register_reply / link / modify_delete / other).

이렇게만 해도 “명확한 기준”은 충족됩니다.  
필요하면 나중에 **work_log_entries**를 추가해, 워커가 완료/실패 시 한 줄씩 넣도록 확장하면 됩니다.

---

## 5. 요약

| 항목 | 현재 | 제안 (선택) |
|------|------|-------------|
| 작업 로그 저장소 | browser_jobs만 | **work_log_entries** 신규 (로그 전용) |
| 성공/실패 기준 | status: completed / failed, cancelled | status 유지 **+** work_log_entries.outcome = success / failure |
| 신규 생성 | — | work_log_entries 테이블 + 인덱스 |
| 수정 | — | browser_jobs는 그대로 두고, 워커에서 완료 시 work_log_entries INSERT 로직 추가 |

필수로 하려면 **4번(browser_jobs만 사용)** 으로 기준을 정하고,  
“로그 전용 보관 + 성공/실패 명시”가 필요하면 **3번(work_log_entries)** 마이그레이션을 적용하면 됩니다.
