# main 제외 지정 로컬 브랜치 일괄 삭제
# 사용법: .\scripts\git\git-cleanup-remaining-branches.ps1
# 강제 삭제(머지 여부 무시): .\scripts\git\git-cleanup-remaining-branches.ps1 -Force

param([switch]$Force)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\../..

$branches = @(
  "feat/gnb-split",
  "feat/gnb-unified-user-menu",
  "feat/initial-ui",
  "feat/phone-verification",
  "feat/signup-complete",
  "feat/snb",
  "feat/store-trial",
  "fix/auth-session",
  "fix/auth-session-nextjs16",
  "refactor/convention-fit",
  "ui/signup-button-alignment"
)

$current = git branch --show-current
if ($current -ne "main") {
  Write-Host "main 브랜치에서 실행해 주세요. 현재: $current" -ForegroundColor Red
  exit 1
}

$flag = if ($Force) { "-D" } else { "-d" }
foreach ($b in $branches) {
  $exists = git branch --list $b
  if ($exists) {
    git branch $flag $b
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Deleted: $b" -ForegroundColor Green
    } else {
      Write-Host "실패 (머지 안 됨). 강제 삭제: .\scripts\git\git-cleanup-remaining-branches.ps1 -Force" -ForegroundColor Yellow
    }
  } else {
    Write-Host "Skip (not found): $b" -ForegroundColor Gray
  }
}
Write-Host "`n완료." -ForegroundColor Green
