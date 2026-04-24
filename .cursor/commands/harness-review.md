# Harness review (리뷰 전용)

구현·수정은 하지 않는다. **프로젝트 스킬 `peer-review`** 를 따른다.

## 사용 전

- Cursor에서 이 워크플로를 쓸 때 **스킬 `peer-review` 적용**을 요청하거나, `.cursor/skills/peer-review/SKILL.md` 를 열어 같은 원칙을 따른다.

## 넘겨줄 맥락

- PR URL 또는 브랜치명
- 또는 `git diff main...HEAD` / 변경 파일 목록
- (선택) 이번 변경의 의도 한 줄

## 끝나면

- PR 본문 또는 코멘트에 **스킬이 정한 형식**(요약 → **R1… 이슈** 목록 → 체크리스트)으로 붙여넣기.
- 구현 에이전트로 넘길 때: **`.cursor/templates/peer-review-result.template.md`** 를 쓰거나, 동일 내용을 루트 **`peer-review-result.local.md`** 로 저장 (gitignore) → **harness-implement-from-review** 커맨드로 이어가기.
