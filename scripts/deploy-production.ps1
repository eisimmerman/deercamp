# DeerCamp guarded production deploy
# Usage:
#   .\scripts\deploy-production.ps1

$ErrorActionPreference = "Stop"

function Stop-If-Failed($msg) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
  }
}

Write-Host "== DeerCamp production deploy ==" -ForegroundColor Cyan

# Confirm we are in repo root
if (!(Test-Path "firebase.json") -or !(Test-Path ".firebaserc")) {
  Write-Host "ERROR: Run this from the DeerCamp project root." -ForegroundColor Red
  exit 1
}

# Require clean working tree before production
$statusPorcelain = git status --porcelain
if (![string]::IsNullOrWhiteSpace($statusPorcelain)) {
  Write-Host "ERROR: Working tree is not clean. Commit/stash changes before production deploy." -ForegroundColor Red
  git status --short
  exit 1
}

# Require staging deploy marker
$marker = ".deploy\last-staging-deploy.txt"
if (!(Test-Path $marker)) {
  Write-Host "ERROR: No staging deploy marker found." -ForegroundColor Red
  Write-Host "Run .\scripts\deploy-staging.ps1 first, test staging, then deploy production." -ForegroundColor Yellow
  exit 1
}

$lastStaging = Get-Content $marker -ErrorAction SilentlyContinue
Write-Host "Last staging deploy marker: $lastStaging" -ForegroundColor Cyan

Write-Host ""
Write-Host "Production target: ourdeercamp.com / deercamp-47c12" -ForegroundColor Yellow
$confirm = Read-Host "Deploy to PRODUCTION now? Type DEPLOY PRODUCTION"
if ($confirm -ne "DEPLOY PRODUCTION") {
  Write-Host "Cancelled production deploy." -ForegroundColor Yellow
  exit 1
}

firebase deploy --only hosting:production --project production
Stop-If-Failed "production deploy failed"

Write-Host ""
Write-Host "Production deploy complete:" -ForegroundColor Green
Write-Host "https://ourdeercamp.com" -ForegroundColor Green
