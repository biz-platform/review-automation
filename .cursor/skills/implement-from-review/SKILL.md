---
name: implement-from-review
description: >-
  peer-review 산출물(이슈 R1…, 판정)을 입력으로 받아, 먼저 반영 계획을 세운 뒤 코드를 수정하고
  pnpm run ci:local 로 검증한다. 리뷰 스킬과 달리 구현을 담당한다. Use when the user passes
  peer review findings, peer-review-result.local.md, or asks to address review / 리뷰 반영.
---

# Implement from review (메인 구현 에이전트 · 리뷰 반영)

## 전제

- 입력은 **반드시 하나**: (a) 채팅에 붙여넣은 peer-review 최종 블록, 또는 (b) 루트 **`peer-review-result.local.md`** 내용.
- **`AGENTS.md`**, **`.cursor/rules/*.mdc`** 를 구현 시에도 따른다.

## 금지

- 리뷰 이슈를 읽기 전에 코드부터 고친다.
- **`request changes`** 인데 사용자 확인 없이 **모호한 major/blocker** 를 임의 해석으로 밀어붙인다 → **계획에 `needs human` 표시 후 멈춤**.
- 리뷰 재실행( peer-review 스킬 전환)을 **스스로 끝까지 루프**한다. 재리뷰는 사용자가 **harness-review** 를 다시 돌릴 때만.

## 절차 (순서 고정)

### 1) 구현 계획 (코드 손대기 전, 반드시 출력)

Markdown 표 한 개:

| Issue ID | Severity | Action | Note |
|----------|----------|--------|------|
| R1 | blocker | fix | … |
| R2 | major | skip | 사용자 지시 없음 / 의도 불명 → needs human |

**Action** 는 `fix` | `skip` | `defer` 만.

- 기본: **`blocker` / `major` → `fix`** (명확한 것만). 애매하면 **`defer` 또는 `skip` + needs human**.
- **`minor` / `nit`**: 사용자가 “전부 반영”이라고 하지 않았으면 **골라서만 `fix`**, 나머지 `skip` + 이유 한 줄.

### 2) 패치

- 계획표의 `fix` / `defer`(승인된 경우)만 반영한다.
- 한 커밋 단위로 묶기 쉽게, 변경 이유를 커밋 메시지에 쓸 수 있게 요약 한 줄 유지.

### 3) 검증

- **`pnpm run ci:local`** 을 실행하거나, 이미 통과했음을 사용자와 동기화한다. (가능하면 직접 실행.)

### 4) 끝

- **재리뷰 안 함.** 대신:
  - 처리한 Issue ID 목록
  - `skip`/`defer`/`needs human` 남은 것
  - 다음에 사용자가 할 일: **`request changes`였으면 harness-review 한 번 더`**
