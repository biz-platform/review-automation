# Harness ship (푸시까지 표준 절차)

에이전트는 **아래 순서를 위에서부터** 진행한다. Git 머지·충돌·원격 상태는 매번 다르므로, **막히면 사용자에게 한 가지만** 묻고 계속한다.

## 0. 근거 문서

- **`AGENTS.md`** — 규약, `ci:local`, 리뷰 ↔ 구현 사이클
- **`.cursor/rules/git-split-branches.mdc`** — 브랜치 전략(dev/main), 방식 A/B, stash, PR base
- 커맨드: **harness-review**, **harness-implement-from-review**, **harness-task**

## 1. (선택) 리뷰 사이클

- 사용자가 리뷰를 원하면: **harness-review** (`peer-review` 스킬) → 필요 시 **harness-implement-from-review** → 다시 **`pnpm run ci:local`** 까지.
- 생략 시 이 단계 통과로 간주.

## 2. 로컬 검증 (필수)

- **`pnpm run ci:local`** 통과 확인. 실패 시 수정 후 여기로 돌아온다.

## 3. Git — 브랜치·커밋 분리

- **`git status -u`**, 현재 브랜치 확인.
- **`.cursor/rules/git-split-branches.mdc`** 에 따라:
  - 한 브랜치에서 커밋만 나눌지(방식 A), 브랜치를 나눌지(방식 B), 베이스는 **dev**(또는 규칙에 적힌 예외)인지 판단한다.
- PowerShell에서 `(protected)` 등 **괄호 경로는 따옴표**로 감싼다.

## 4. 커밋

- **`git add`** → **`git commit`** (pre-commit에서 **lint-staged**가 돈다).
- 커밋 메시지: `feat(영역):`, `fix(영역):`, `chore(영역):` 등 구체적으로.

## 5. 푸시·PR·dev 머지

- **`git push -u origin <브랜치명>`** (또는 규칙에 맞는 원격 작업).
- PR이 필요하면 **base `dev`**, 제목·본문은 **`.github/pull_request_template.md`** 참고.
- 사용자가 **로컬에서 dev에 머지**하라고 했을 때만 `git checkout dev && git pull && git merge <브랜치> && git push` 등 수행. **원격 default branch에 직접 force 하지 않는다.**

## 6. 배포

- **main 반영·프로덕션 배포**는 사용자/팀 정책에 따른다. (보통 **dev → main PR** 후 Vercel 등.) 에이전트가 임의로 main에 푸시하지 않는다.

## 7. 끝

- 수행한 브랜치·커밋·PR URL·남은 수동 작업을 짧게 요약한다.
