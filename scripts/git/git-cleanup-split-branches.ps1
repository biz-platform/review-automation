# 분리했던 브랜치 로컬 삭제 (main에 머지 완료 후 실행)
# 사용법: .\scripts\git\git-cleanup-split-branches.ps1
# 원격도 삭제: .\scripts\git\git-cleanup-split-branches.ps1 -Remote

param([switch]$Remote)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\../..

$branches = @(
  "feat/ui-store-manage",
  "feat/stores-link-flow",
  "refactor/reviews-routes",
  "feat/layout-snb-sticky",
  "chore/manage-auth-platform"
)

$current = git branch --show-current
if ($current -ne "main") {
  Write-Host "main 브랜치에서 실행해 주세요. 현재: $current" -ForegroundColor Red
  exit 1
}

foreach ($b in $branches) {
  $exists = git branch --list $b
  if ($exists) {
    git branch -d $b
    if ($LASTEXITCODE -ne 0) {
      Write-Host "머지 안 된 변경이 있으면 -D로 강제 삭제: git branch -D $b" -ForegroundColor Yellow
    } else {
      Write-Host "Deleted local branch: $b" -ForegroundColor Green
    }
    if ($Remote) {
      $prevErr = $ErrorActionPreference
      $ErrorActionPreference = "SilentlyContinue"
      git push origin --delete $b 2>&1 | Out-Null
      $ErrorActionPreference = $prevErr
      if ($LASTEXITCODE -eq 0) { Write-Host "Deleted remote: $b" -ForegroundColor Green }
      else { Write-Host "Skip remote (없음 또는 이미 삭제됨): $b" -ForegroundColor Gray }
    }
  } else {
    Write-Host "Skip (not found): $b" -ForegroundColor Gray
  }
}
Write-Host "`n로컬 브랜치 정리 완료." -ForegroundColor Green
if (-not $Remote) {
  Write-Host "원격 브랜치도 삭제하려면: .\scripts\git\git-cleanup-split-branches.ps1 -Remote" -ForegroundColor Yellow
}
