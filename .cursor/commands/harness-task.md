# Harness task (에이전트/장기 작업)

아래 블록을 채운 뒤 실행한다. 완료 조건은 **센서가 판정 가능**하게 쓴다.

## 맥락

- 목표 (한 문장):
- 관련 이슈/슬랙 (있다면):

## 변경 범위

- 건드릴 디렉터리/파일 (추정 OK, 나중에 수정):
- 건드리면 안 되는 것:

## 완료 조건 (체크리스트)

- [ ] `pnpm run ci:local` (또는 단계별 lint / check:import-boundaries / test / build)
- [ ] (선택) **harness-review** → **harness-implement-from-review** (`.cursor/commands/` 참고)
- [ ] (수동) …

## 장기 작업 시

- 진행 상태 파일: 루트에 `harness-progress.local.json` (`.cursor/templates/harness-task-progress.template.json` 복사, gitignore)

## 규칙 포인터

- `AGENTS.md` + `.cursor/rules/*.mdc`
