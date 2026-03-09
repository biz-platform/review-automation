# 디자인 작업 선행 확인 및 작업 목록

본격적인 디자인 작업에 앞서 점검·정리할 사항 목록.

---

## 1. 디자인 토큰 점검

### 현재 상태
- `src/app/globals.css`의 `@theme`에 `--color-background`, `--color-foreground`, `--color-primary` 등만 정의됨.
- `:root` / `.dark`에 HSL 변수 이중 정의되어 있음.

### 할 일
- [x] `@theme`에 **`--color-ring`** 추가 (Button `focus-visible:ring-ring` 사용 중)
- [x] **`--color-destructive`** 추가 (ReplyContentBlock, RetryErrorBoundaryFallback에서 사용)
- [x] 필요 시 **`--color-accent`** 등 실제 사용 색상 토큰 정리 (Main/GRAY/WGRAY/RED/BLUE 팔레트 추가)
- [x] `:root` / `.dark` 변수와 `@theme` 통일 또는 단일 소스로 정리

---

## 2. 타이포·간격 스케일

### 현재 상태
- `--radius-sm/md/lg`만 정의됨. 폰트 크기·줄높이·간격 스케일 없음.
- 페이지별로 `text-2xl`, `text-sm`, `p-8`, `gap-2` 등 하드코딩.

### 할 일
- [x] 타이포 스케일 정의 (Figma 3237-276 기준) 후 `@theme`에 `--text-*` / `--leading-*` 반영, `.typo-*` 클래스 추가
- [ ] 간격 스케일 정의 후 `--spacing-*` 또는 Tailwind 스케일 활용 방식 정리
- [x] 정의한 스케일 문서화 (`docs/styling.md` Typography 섹션)

---

## 3. UI 컴포넌트 부족

### 현재 상태
- Button, Card, Badge만 존재. Input, Select, Tabs, Modal, Toast, Spinner 등 없음.

### 할 일
- [ ] 디자인 작업 전 **필수 컴포넌트 목록** 확정 (Input, Textarea, Select, Tabs, Modal/Dialog, Toast, Spinner, Link 스타일 등)
- [ ] 새 컴포넌트가 동일 토큰(색/radius/타이포)만 참조하도록 설계

---

## 4. Raw 태그 사용 (컨벤션)

### 현재 상태
- 컨벤션: `app/**/page.tsx`, `features/**`, `widgets/**`, `_sections/**`에서 raw `div`/`span`/`button` 지양.
- 실제: `(protected)/layout.tsx` 헤더·네비, `ReviewManageCard` 등에서 raw 태그 사용.

### 할 일
- [ ] Layout(Header/Nav/Container), Text, Link, IconButton 등 공용 컴포넌트로 추출할 범위 결정
- [ ] 최소한 공통 레이아웃(헤더/네비)은 컴포넌트로 분리해 한 곳만 수정 가능하게 정리

---

## 5. 다크모드

### 현재 상태
- `globals.css`에 `.dark` 변수 정의됨. `class="dark"` 토글/설정 로직은 미확인.

### 할 일
- [ ] 다크모드 사용 여부 결정
- [ ] 사용 시: `next-themes` 등으로 `dark` 클래스 적용 방식 및 `@theme`/`:root` 매핑 정리
- [ ] 미사용 시: `.dark` 변수 제거 또는 “미사용” 주석 처리

---

## 6. 임의 값 사용

### 현재 상태
- `min-h-[200px]`, `max-h-[90vh]`, `max-w-[90vw]`, `bg-[hsl(var(--primary))]` 등 arbitrary value 사용.

### 할 일
- [ ] 자주 쓰는 값(모달 max 높이, 에러 영역 min 높이 등)은 토큰 또는 `@theme`으로 추출
- [ ] `bg-[hsl(var(--primary))]` → `bg-primary` 등 기존 토큰으로 교체

---

## 7. 접근성·포커스

### 현재 상태
- Button에 `focus-visible:ring-2 focus-visible:ring-ring` 있음. `--color-ring` 정의 필요.
- 카드 내부 버튼 등 커스텀 인터랙티브 요소 포커스 스타일 누락 가능성.

### 할 일
- [x] 포커스 링 색/두께 디자인 확정 후 `@theme`의 `ring` 토큰 반영
- [ ] 키보드 포커스 대상 요소 전반에 포커스 스타일 적용 여부 점검

---

## 8. 반응형

### 현재 상태
- 컨벤션: mobile-first, `sm:` → `md:` → `lg:` → `xl:`.
- 실제 브레이크포인트 사용량·일관성은 미검토.

### 할 일
- [ ] 주요 페이지(리뷰 관리, 매장/계정 목록 등)를 좁은 뷰포트에서 확인
- [ ] 레이아웃 전환·테이블/카드 처리 등 필요한 브레이크포인트 구간 리스트업

---

## 요약 체크리스트

| 구분 | 확인/작업 |
|------|------------|
| 토큰 | ~~`ring`, `destructive`, `accent` 등 누락 색상 `@theme` 추가~~ ✅ |
| 토큰 | ~~`:root` / `@theme` 이중 정의 정리, HSL/네이밍 통일~~ ✅ |
| 스케일 | 타이포·간격 스케일 정의 및 필요 시 `@theme` 반영 |
| 컴포넌트 | Input, Tabs, Modal, Spinner 등 필수 컴포넌트 목록 확정 |
| 레이아웃 | Header/Nav/Container 등 공용 레이아웃 컴포넌트 분리 |
| 다크모드 | 사용 여부 결정 후 `.dark` 적용 방식 또는 제거 |
| 임의값 | 자주 쓰는 값 토큰/유틸 클래스로 대체 (예: `bg-primary`) |
| a11y | ~~포커스 링 토큰 정의~~ ✅, 인터랙티브 요소 포커스 스타일 점검 |
| 반응형 | 주요 페이지별 브레이크포인트·레이아웃 전환 구간 정리 |

---

*최종 수정: 디자인 작업 선행 단계 정리*
