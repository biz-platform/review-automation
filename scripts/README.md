# Scripts

## Git 브랜치 워크플로 (scripts/git/)

`.cursor/rules/git-split-branches.mdc` 방식 B 사용 시 참고.

| 스크립트 | 용도 |
|----------|------|
| `git-split-branches.ps1` | 변경사항을 그룹별 브랜치로 분리 (stash → 브랜치 생성 → 그룹별 add/commit) |
| `git-merge-split-branches.ps1` | 분리한 브랜치들을 main에 순서대로 머지 |
| `git-cleanup-split-branches.ps1` | 분리했던 5개 브랜치 로컬/원격 삭제. `-Remote` 시 원격도 삭제 |
| `git-cleanup-remaining-branches.ps1` | 기타 로컬 브랜치 일괄 삭제. `-Force` 시 머지 여부 무시하고 삭제 |

**실행:** 프로젝트 루트에서, `main` 체크아웃 상태로 실행.  
예: `.\scripts\git\git-cleanup-split-branches.ps1 -Remote`

## 기타

- `archive-old-reviews.ts` – 리뷰 아카이브
- `check-reviews-platform-reply.ts` – 플랫폼별 답글 점검
- `debug-coupang-eats-reviews.ts` – 쿠팡이츠 리뷰 디버그
- `worker.ts` – 워커
