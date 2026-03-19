# 작업 로그 탭 개선 방향

어드민 매장 상세 > 작업 로그 탭의 UI/데이터 개선 방향을 정리한 문서입니다.

---

## 1. 현재 상태 (초안)

- **매장** 드롭다운, **기간** 날짜 범위, **검색** 버튼만 존재
- 테이블 컬럼이 중복(로그 기록 일시가 두 번)되어 있고, 로그 메시지만 나열
- 카테고리/성공·실패 구분 없음

---

## 2. 개선 목표

1. **카테고리 필터**: 로그 유형별로 필터링 (예: 동기화, AI 생성, 플랫폼 등록, 계정 등)
2. **상태 필터**: 전체 / 성공 / 오류 중 선택
3. **각 로그 행에 표시**: 카테고리 라벨 + 성공/오류 상태 뱃지

---

## 3. 데이터 소스 (browser_jobs)

작업 로그는 `browser_jobs` 테이블을 기반으로 합니다.

| 필드 | 설명 |
|------|------|
| `id` | job UUID |
| `type` | job 유형 (예: `baemin_sync`, `baemin_register_reply`, `yogiyo_link` 등) |
| `store_id` | 매장 ID (nullable) |
| `user_id` | 사용자 ID |
| `status` | `pending` \| `processing` \| `completed` \| `failed` \| `cancelled` |
| `error_message` | 실패 시 에러 메시지 |
| `payload` | 입력 파라미터 (reviewId, platform 등) |
| `result` | 결과 (성공 시 메시지 등) |
| `created_at` | 생성 시각 |

- **카테고리**: `type`을 그룹화해 사용  
  - 동기화: `*_sync`  
  - 플랫폼 등록: `*_register_reply`  
  - 연동: `*_link`  
  - 수정/삭제: `*_modify_reply`, `*_delete_reply`  
  - 기타: `internal_auto_register_draft` 등
- **성공/오류**: `status === 'completed'` → 성공, `status === 'failed'` → 오류

---

## 4. UI 스펙

### 4.1 필터 영역

| 필터 | 타입 | 옵션/동작 |
|------|------|-----------|
| **매장** | 드롭다운 | 전체 + 해당 고객의 매장 목록 (store_id 기준) |
| **기간** | 날짜 범위 | 시작일–종료일 (created_at 기준) |
| **카테고리** | 드롭다운 | 전체 / 동기화 / 플랫폼 등록 / 연동 / 수정·삭제 / 기타 |
| **상태** | 드롭다운 또는 필터 pill | 전체 / 성공 / 오류 |
| **검색** | 버튼 | 위 조건으로 목록 재조회 |

- 필터 pill 사용 시: **전체** | **오류** (매장 목록 페이지와 동일한 톤으로 통일 가능)

### 4.2 테이블 컬럼

| 컬럼명 | 설명 |
|--------|------|
| **로그 기록 일시** | `created_at` 포맷 (예: 2026.03.18 12:13:11) |
| **카테고리** | type → 한글 라벨 (동기화, 답글 등록, 연동, 수정·삭제, 기타) + 필요 시 배지 스타일 |
| **상태** | 성공(정상) / 오류 뱃지 (매장 정보 탭의 작업 상태와 동일한 색: 정상=파랑, 오류=빨강) |
| **내용** | 사용자에게 보여줄 메시지 (아래 4.3 참고) |

- 초안에서 중복되던 “로그 기록 일시” 컬럼은 하나만 두고, 두 번째 컬럼은 **내용**으로 사용.

### 4.3 로그 메시지 (내용) 규칙

- **성공(completed)**  
  - `result` 또는 `type` 기반으로 메시지 생성  
  - 예: "리뷰 12건을 불러왔어요.", "배달의민족에 답글 등록을 완료했어요."
- **실패(failed)**  
  - `error_message` 우선 사용  
  - 없으면 type 기반 기본 문구 (예: "답글 등록에 실패했어요. 로그인 상태를 확인해주세요.")
- 서버에서 **메시지 매핑 테이블** 또는 **type + status별 기본 문구**를 두고, API에서 `message` 필드로 내려주면 프론트는 그대로 표시.

---

## 5. API 제안

### 5.1 엔드포인트

- `GET /api/admin/stores/[userId]/work-logs`
- Query: `storeId` (optional), `dateFrom`, `dateTo`, `category`, `status`, `limit`, `offset`

### 5.2 응답 예시

```ts
{
  result: {
    list: {
      id: string;
      type: string;
      category: "sync" | "register_reply" | "link" | "modify_delete" | "other";
      categoryLabel: string;  // "동기화", "답글 등록" 등
      status: "completed" | "failed" | "pending" | "processing" | "cancelled";
      message: string;        // 표시용 한글 메시지
      storeId: string | null;
      platform: string | null;
      createdAt: string;      // ISO
    }[];
    count: number;
  }
}
```

- **category**: `type`에서 파생 (예: `*_sync` → `sync`, `*_register_reply` → `register_reply`).
- **message**: 서버에서 `type`, `status`, `error_message`, `result`를 조합해 생성.

---

## 6. 구현 순서 제안

1. **백엔드**  
   - `GET /api/admin/stores/[userId]/work-logs` 구현  
   - `browser_jobs` 조회 (해당 user_id의 store_id 목록으로 필터), `type` → category/라벨, status → 성공/오류, message 생성 로직 추가  
2. **프론트**  
   - 작업 로그 탭에 기간/매장/카테고리/상태 필터 연동  
   - 테이블: 로그 기록 일시 | 카테고리 | 상태 | 내용  
   - 상태는 기존 작업 상태와 동일한 뱃지 스타일(정상=파랑, 오류=빨강) 적용  
3. **메시지 다국어/추가**  
   - type별 기본 메시지 표를 두고, 필요 시 확장

---

## 7. 정리

- **카테고리 필터**: `browser_jobs.type` 그룹(동기화, 답글 등록, 연동 등)으로 제공.
- **전체/성공/오류 필터**: `status` 기준 (전체 / completed / failed).
- **로그별 표시**: 각 행에 **카테고리 라벨** + **성공/오류 뱃지** + **일시** + **내용**을 두어, 현재 초안의 중복 컬럼을 제거하고 가독성을 높이는 방향으로 개선하면 됩니다.
