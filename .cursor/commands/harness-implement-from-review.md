# Harness implement from review (리뷰 → 구현)

**스킬 `implement-from-review`** 를 적용한다. 리뷰 산출물을 읽은 뒤 **① 계획 표 → ② 패치 → ③ `pnpm run ci:local`** 순서만 따른다.

## 입력 (하나만)

- 채팅에 붙여넣은 peer-review 최종 블록 **또는**
- 루트 **`peer-review-result.local.md`** (`@peer-review-result.local.md` 로 참조)

## 사용자가 한 줄로 줄 수 있는 지시 (선택)

- 예: “`blocker`/`major`만 전부 `fix`. `minor`/`nit`은 제안대로 골라 적용, 스킵은 이유 한 줄.”

## 끝난 뒤

- **`request changes`** 였다면: 사용자가 **harness-review** 를 다시 돌려 재리뷰한다 (구현 에이전트가 peer-review 를 대신 돌리지 않음).
