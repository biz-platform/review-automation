# Agent / contributor entry

상세 규칙은 **`.cursor/rules/*.mdc`** (프론트·백엔드 컨벤션, 라우트 핸들러, React Query 등)을 따른다.

## 이 레포에서 꼭 지킬 것

- App Router API: **`withRouteHandler`로 감싼 핸들러만** export. 예외 경로는 백엔드 컨벤션 문서에 명시된 것만.
- 성공 응답: **`NextResponse.json<AppRouteHandlerResponse<T>>({ result })`** 형태.
- import: **`@/...` 절대 경로**만 사용.
- **`src/lib/services/**`, `src/lib/dashboard/**`** 에서는 **`@/app/` import 금지** (`pnpm run check:import-boundaries`).
- 공유 상수·파서는 **`@/lib/reviews/*`** 처럼 app 밖 모듈로 둔다.

## 위험 / 주의 구역

- **워커·PM2·락 파일** (`.worker-*.lock`): 동시 실행·배포 시 충돌.
- **크론·외부 배달 API·브라우저 자동화**: 시크릿·레이트리밋·플랫폼 정책 확인 후 변경.
- **AI 답글·sanitize 경로**: 회귀는 `pnpm test` (`sanitize-review-reply` 등).

## 작업 시작 시

1. **`pnpm run ci:local`** (lint → import 경계 → test → build, CI와 동일).  
   - Next.js 16+: **`next lint` 없음** → `eslint .` (`eslint.config.mjs`).
2. 커밋 시: **husky** → 스테이징된 파일만 `eslint --fix` (`lint-staged`).
3. 장기 작업이면 `.cursor/templates/harness-task-progress.template.json`을 복사해 **`harness-progress.local.json`** 으로 두고 갱신 (gitignore됨).

## Cursor 전용

- **푸시까지 한 번에(표준 순서)**: **`.cursor/commands/harness-ship.md`** — 검증 → (선택 리뷰) → Git 분리 규칙(`git-split-branches`) → 커밋 → 푸시/PR
- 태스크 프롬프트 뼈대: `.cursor/commands/harness-task.md`
- **리뷰 전용(구현 금지)**: 스킬 **`.cursor/skills/peer-review/SKILL.md`** + **`.cursor/commands/harness-review.md`**
- **리뷰 반영(구현)**: 스킬 **`.cursor/skills/implement-from-review/SKILL.md`** + **`.cursor/commands/harness-implement-from-review.md`**

### 리뷰 ↔ 구현 한 사이클 (추천)

1. 구현 작업 후 **커밋 단위**로 멈춤.  
2. **harness-review** + `peer-review` 스킬 → 산출물에 **R1… 이슈 ID** 포함.  
3. (선택) **`peer-review-result.local.md`** 에 붙여넣기 — 템플릿: **`.cursor/templates/peer-review-result.template.md`**.  
4. **harness-implement-from-review** → **계획 표 → 수정 → `pnpm run ci:local`**.  
5. 판정이 **request changes**였으면 사용자가 **harness-review** 를 다시 실행한다 (자동 리뷰 루프 없음).
