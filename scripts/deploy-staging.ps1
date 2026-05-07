# DeerCamp guarded staging deploy
# Usage:
#   .\scripts\deploy-staging.ps1 -Message "Describe this change"
# Or:
#   .\scripts\deploy-staging.ps1

param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

function Stop-If-Failed($msg) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
  }
}

Write-Host "== DeerCamp staging deploy ==" -ForegroundColor Cyan

# Confirm we are in repo root
if (!(Test-Path "firebase.json") -or !(Test-Path ".firebaserc")) {
  Write-Host "ERROR: Run this from the DeerCamp project root." -ForegroundColor Red
  exit 1
}

# Block obviously sensitive/unwanted files from being staged accidentally
$forbiddenPatterns = @(
  "\.jks$",
  "\.pem$",
  "\.keystore$",
  "\.p12$",
  "\.pfx$",
  "\.key$",
  "google-services\.json$",
  "^\.firebase/",
  "~\$",
  "\.tmp$"
)

$statusPorcelain = git status --porcelain
foreach ($line in $statusPorcelain) {
  foreach ($pattern in $forbiddenPatterns) {
    if ($line -match $pattern) {
      Write-Host "ERROR: Sensitive/generated file is visible to Git:" -ForegroundColor Red
      Write-Host "  $line" -ForegroundColor Yellow
      Write-Host "Fix .gitignore or remove the file before deploying." -ForegroundColor Red
      exit 1
    }
  }
}

Write-Host ""
Write-Host "Current Git status:" -ForegroundColor Cyan
git status --short

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = Read-Host "Commit message"
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  Write-Host "ERROR: Commit message required." -ForegroundColor Red
  exit 1
}

# Stage only known launch/runtime files. Add more here deliberately as needed.
$pathsToAdd = @(
  ".firebaserc",
  "firebase.json",
  ".gitignore",
  "camp.html",
  "steward-dashboard.html",
  "member-setup.html",
  "buildyourcamp.html",
  "build.html",
  "index.html",
  "scout.html",
  "member-welcome-email.html",
  "deercamp-member-welcome-email.html",
  "api",
  "functions",
  "lib",
  "email-assets",
  "data",
  "assets/branding",
  "assets/images",
  "assets/heroes",
  "assets/maps"
)

foreach ($path in $pathsToAdd) {
  if (Test-Path $path) {
    git add $path
  }
}

$staged = git diff --cached --name-only
if ([string]::IsNullOrWhiteSpace($staged)) {
  Write-Host "No staged changes. Skipping commit/push and deploying current committed files to staging." -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "Staged files:" -ForegroundColor Cyan
  git diff --cached --name-only

  $confirm = Read-Host "Commit and push these files? Type YES"
  if ($confirm -ne "YES") {
    Write-Host "Cancelled before commit." -ForegroundColor Yellow
    exit 1
  }

  git commit -m "$Message"
  Stop-If-Failed "git commit failed"

  git push
  Stop-If-Failed "git push failed"
}

Write-Host ""
Write-Host "Deploying to STAGING..." -ForegroundColor Cyan
firebase deploy --only hosting:staging --project staging
Stop-If-Failed "staging deploy failed"

# Record staging deploy marker locally
$markerDir = ".deploy"
if (!(Test-Path $markerDir)) {
  New-Item -ItemType Directory -Path $markerDir | Out-Null
}
(Get-Date).ToString("o") | Set-Content "$markerDir\last-staging-deploy.txt"

Write-Host ""
Write-Host "Staging deploy complete:" -ForegroundColor Green
Write-Host "https://deercamp-staging.web.app" -ForegroundColor Green
Write-Host ""
Write-Host "Test staging. If good, run:" -ForegroundColor Cyan
Write-Host ".\scripts\deploy-production.ps1" -ForegroundColor White
