# 방식 B 머지: 분리한 브랜치들을 main에 순서대로 머지
# 사용법: .\scripts\git\git-merge-split-branches.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\../..

$branches = @(
  "feat/ui-store-manage",
  "feat/stores-link-flow",
  "refactor/reviews-routes",
  "feat/layout-snb-sticky",
  "chore/manage-auth-platform"
)

git checkout main
foreach ($b in $branches) {
  Write-Host "Merging $b ..." -ForegroundColor Cyan
  git merge $b --no-edit
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Conflict in $b. Resolve and run: git commit" -ForegroundColor Red
    exit 1
  }
}
Write-Host "`nAll branches merged into main." -ForegroundColor Green
