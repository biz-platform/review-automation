# 방식 B: 브랜치별 완전 분리
# 사용법: .\scripts\git\git-split-branches.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\../..

# ---------- 4.1 변경사항 임시 보관 ----------
Write-Host "=== 4.1 Stash (변경 모두 임시 보관) ===" -ForegroundColor Cyan
git stash push -u -m "wip: split-branches 전체 변경"
if ($LASTEXITCODE -ne 0) { exit 1 }

# ---------- 4.2 그룹 1: UI 공통 ----------
Write-Host "`n=== 그룹 1: UI 공통 (feat/ui-store-manage) ===" -ForegroundColor Cyan
git checkout main
git checkout -b feat/ui-store-manage
git stash pop

git add src/components/ui/button.tsx src/components/ui/tab-line.tsx
git add src/components/ui/content-state-message.tsx src/components/ui/native-select.tsx
git commit -m "feat(ui): Button disabled(wgray-06), ButtonLink, ContentStateMessage, NativeSelect"

git stash push -u -m "wip: 남은 변경(2,3,4,5)"

# ---------- 4.2 그룹 2: 매장 관리 ----------
Write-Host "`n=== 그룹 2: 매장 관리 (feat/stores-link-flow) ===" -ForegroundColor Cyan
git checkout main
git checkout -b feat/stores-link-flow
git stash pop

git add "src/app/(protected)/manage/stores/page.tsx"
git add "src/app/(protected)/manage/stores/stores-page-content.tsx"
git add "src/app/(protected)/manage/stores/[id]/accounts/page.tsx"
git add "src/app/(protected)/manage/stores/[id]/accounts/use-store-accounts-state.ts"
git add "src/app/(protected)/manage/stores/[id]/accounts/link-platform.ts"
git add "src/app/(protected)/manage/stores/[id]/accounts/platform-link-config.ts"
git add "src/app/(protected)/manage/stores/new/page.tsx"
git add src/components/store/PlatformLinkForm.tsx
git add src/components/store/StoreLinkProgressModal.tsx
git add src/lib/store/link-platform.ts
git add src/lib/store/use-baemin-session.ts
git add src/const/platform-link-config.ts
git commit -m "feat(stores): 매장 연동 플로우 정리, 연동 중 2단계 모달, link-platform/use-baemin-session"

git stash push -u -m "wip: 남은 변경(3,4,5)"

# ---------- 4.2 그룹 3: 리뷰 관리 ----------
Write-Host "`n=== 그룹 3: 리뷰 관리 (refactor/reviews-routes) ===" -ForegroundColor Cyan
git checkout main
git checkout -b refactor/reviews-routes
git stash pop

git add "src/app/(protected)/manage/reviews/page.tsx"
git add "src/app/(protected)/manage/reviews/[id]/page.tsx"
git add "src/app/(protected)/manage/reviews/constants.ts"
git add "src/app/(protected)/manage/reviews/list/page.tsx"
git add "src/app/(protected)/manage/reviews/use-reviews-manage-state.ts"
git add "src/app/(protected)/manage/reviews/manage/constants.ts"
git add "src/app/(protected)/manage/reviews/manage/page.tsx"
git add "src/app/(protected)/manage/reviews/manage/use-reviews-manage-state.ts"
git commit -m "refactor(reviews): 라우트/상수 정리 (manage -> list, constants 이동)"

git stash push -u -m "wip: 남은 변경(4,5)"

# ---------- 4.2 그룹 4: 레이아웃 ----------
Write-Host "`n=== 그룹 4: 레이아웃 (feat/layout-snb-sticky) ===" -ForegroundColor Cyan
git checkout main
git checkout -b feat/layout-snb-sticky
git stash pop

git add src/components/layout/SNB.tsx
git add "src/app/(protected)/AppShell.tsx"
git commit -m "feat(layout): SNB sticky, AppShell 유지"

git stash push -u -m "wip: 남은 변경(5)"

# ---------- 4.2 그룹 5: 기타 ----------
Write-Host "`n=== 그룹 5: 기타 (chore/manage-auth-platform) ===" -ForegroundColor Cyan
git checkout main
git checkout -b chore/manage-auth-platform
git stash pop

git add "src/app/(auth)/page.tsx"
git add "src/const/platform.ts"
git add "src/app/(protected)/manage/page.tsx"
git commit -m "chore: manage 루트 페이지, auth 페이지, platform 상수"

$s = git stash list
if ($s -match "wip: 남은 변경") { git stash drop }

Write-Host "`n=== 완료. 현재 브랜치: chore/manage-auth-platform ===" -ForegroundColor Green
Write-Host "머지: .\scripts\git\git-merge-split-branches.ps1" -ForegroundColor Yellow
