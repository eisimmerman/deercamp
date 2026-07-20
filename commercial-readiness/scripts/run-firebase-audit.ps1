[CmdletBinding()]
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"

$crRoot = Join-Path $RepoRoot "commercial-readiness"
$dataPath = Join-Path $crRoot "data\readiness-data.json"
$changePath = Join-Path $crRoot "data\audit-changes.json"
$evidenceDir = Join-Path $crRoot "evidence"

New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"
$stampFile = Get-Date -Format "yyyyMMdd-HHmmss"
$evidenceFile = Join-Path $evidenceDir "firebase-audit-$stampFile.txt"
$latestFile = Join-Path $evidenceDir "firebase-audit-latest.txt"

function Get-InstalledVersion {
  param(
    [string]$WorkingDir,
    [string]$Name
  )

  Push-Location $WorkingDir
  try {
    $raw = npm list $Name --depth=0 --json 2>$null | ConvertFrom-Json
    return $raw.dependencies.$Name.version
  }
  catch {
    return $null
  }
  finally {
    Pop-Location
  }
}

function Set-Dependency {
  param(
    $Data,
    [string]$Id,
    [hashtable]$Fields
  )

  $item = $Data.dependencies |
    Where-Object id -eq $Id |
    Select-Object -First 1

  if (!$item) {
    return
  }

  foreach ($key in $Fields.Keys) {
    $item.$key = $Fields[$key]
  }
}

function Add-Change {
  param(
    $Changes,
    [string]$Component,
    [string]$Summary
  )

  $Changes.changes = @(
    @{
      timestamp = $timestamp
      component = $Component
      summary   = $Summary
    }
  ) + @($Changes.changes)

  if ($Changes.changes.Count -gt 100) {
    $Changes.changes = @(
      $Changes.changes | Select-Object -First 100
    )
  }
}

function Test-IsArchiveOrBackupPath {
  param([string]$FullName)

  return (
    $FullName -match '\\deercamp-archive-raw\\' -or
    $FullName -match '\\[^\\]*(archive|archives|revision|revisions|backup|backups)[^\\]*\\' -or
    $FullName -match '\.before-' -or
    $FullName -match '\.backup-' -or
    $FullName -match '-before-' -or
    $FullName -match '-backup-' -or
    $FullName -match '\\old\\' -or
    $FullName -match '\\legacy\\'
  )
}

function Test-IsReferenceAssetPath {
  param([string]$FullName)

  return (
    $FullName -match '\\email-assets\\' -or
    $FullName -match '\\marketing\\' -or
    $FullName -match '\\docs?\\' -or
    $FullName -match '\\examples?\\' -or
    $FullName -match '\\samples?\\'
  )
}

function Test-IsCompiledRuntimePath {
  param([string]$FullName)

  return (
    $FullName -match '\\functions\\lib\\' -or
    $FullName -match '\\dist\\' -or
    $FullName -match '\\build\\'
  )
}

function Test-IsMobileSourcePath {
  param([string]$FullName)

  return (
    $FullName -match '\\app\\' -or
    $FullName -match '\\src\\' -or
    $FullName -match '\\lib\\.*\.(ts|tsx)$'
  )
}

function Get-SourceClassification {
  param([System.IO.FileInfo]$File)

  $fullName = $File.FullName

  if (Test-IsArchiveOrBackupPath $fullName) {
    return "Archive / Backup"
  }

  if (Test-IsReferenceAssetPath $fullName) {
    return "Reference Asset"
  }

  if (Test-IsCompiledRuntimePath $fullName) {
    return "Compiled / Runtime"
  }

  if (Test-IsMobileSourcePath $fullName) {
    return "Mobile Source"
  }

  return "Active Production Web"
}

function Format-Hits {
  param($Hits)

  if (!$Hits -or $Hits.Count -eq 0) {
    return "(none)"
  }

  return (
    $Hits |
      ForEach-Object {
        "$($_.Path):$($_.LineNumber): $($_.Line.Trim())"
      } |
      Out-String
  ).TrimEnd()
}

$data = Get-Content $dataPath -Raw | ConvertFrom-Json
$changes = Get-Content $changePath -Raw | ConvertFrom-Json

$fnPkg = Join-Path $RepoRoot "functions\package.json"
$firebaseJson = Join-Path $RepoRoot "firebase.json"

$versions = [ordered]@{
  rnApp       = Get-InstalledVersion $RepoRoot "@react-native-firebase/app"
  rnAuth      = Get-InstalledVersion $RepoRoot "@react-native-firebase/auth"
  rnFirestore = Get-InstalledVersion $RepoRoot "@react-native-firebase/firestore"
  rnStorage   = Get-InstalledVersion $RepoRoot "@react-native-firebase/storage"
  admin       = Get-InstalledVersion (Join-Path $RepoRoot "functions") "firebase-admin"
  functions   = Get-InstalledVersion (Join-Path $RepoRoot "functions") "firebase-functions"
  typescript  = Get-InstalledVersion (Join-Path $RepoRoot "functions") "typescript"
}

$cli = try {
  firebase --version
}
catch {
  "Unavailable"
}

$node = try {
  node --version
}
catch {
  "Unavailable"
}

$gitCommit = try {
  git -C $RepoRoot rev-parse --short HEAD
}
catch {
  "Unknown"
}

$branch = try {
  git -C $RepoRoot branch --show-current
}
catch {
  "Unknown"
}

$hostName = $env:COMPUTERNAME

$runtime = $null
if (Test-Path $firebaseJson) {
  $fj = Get-Content $firebaseJson -Raw | ConvertFrom-Json
  $runtime = @($fj.functions)[0].runtime
}

$fnPackageJson = Get-Content $fnPkg -Raw | ConvertFrom-Json
$engine = $fnPackageJson.engines.node
$buildScript = $fnPackageJson.scripts.build

$configHits = @(
  Get-ChildItem (Join-Path $RepoRoot "functions\src") -Recurse -File -Include *.ts,*.js |
    Select-String -Pattern 'functions\.config\('
)

$v1Hits = @(
  Get-ChildItem (Join-Path $RepoRoot "functions\src") -Recurse -File -Include *.ts,*.js |
    Where-Object {
      $_.Name -notmatch '\.before-' -and
      $_.Name -notmatch '\.backup-'
    } |
    Select-String -Pattern 'firebase-functions/v1'
)

$v2Hits = @(
  Get-ChildItem (Join-Path $RepoRoot "functions\src") -Recurse -File -Include *.ts,*.js |
    Where-Object {
      $_.Name -notmatch '\.before-' -and
      $_.Name -notmatch '\.backup-'
    } |
    Select-String -Pattern 'firebase-functions/v2'
)

$sourceFiles = @(
  Get-ChildItem $RepoRoot -Recurse -File `
    -Include *.html,*.js,*.mjs,*.cjs,*.ts,*.tsx `
    -ErrorAction SilentlyContinue |
    Where-Object {
      $_.FullName -notmatch '\\node_modules\\' -and
      $_.FullName -notmatch '\\\.git\\' -and
      $_.FullName -notmatch '\\commercial-readiness\\'
    }
)

$firebasePattern = 'firebasejs|from\s+["'']firebase/|firebase\.initializeApp|@react-native-firebase'

$classifications = @(
  "Active Production Web",
  "Mobile Source",
  "Compiled / Runtime",
  "Archive / Backup",
  "Reference Asset"
)

$hitsByClass = @{}

foreach ($classification in $classifications) {
  $hitsByClass[$classification] = @()
}

foreach ($file in $sourceFiles) {
  $classification = Get-SourceClassification $file
  $matches = @(
    Select-String -Path $file.FullName -Pattern $firebasePattern -ErrorAction SilentlyContinue
  )

  if ($matches.Count -gt 0) {
    $hitsByClass[$classification] += $matches
  }
}

$activeWebHits = @($hitsByClass["Active Production Web"])
$mobileHits = @($hitsByClass["Mobile Source"])
$compiledHits = @($hitsByClass["Compiled / Runtime"])
$archiveHits = @($hitsByClass["Archive / Backup"])
$referenceHits = @($hitsByClass["Reference Asset"])

$activeWebVersions = @(
  $activeWebHits |
    ForEach-Object {
      [regex]::Matches($_.Line, 'firebasejs/([0-9]+\.[0-9]+\.[0-9]+)') |
        ForEach-Object { $_.Groups[1].Value }
    } |
    Sort-Object -Unique
)

$activeWebCompatCount = @(
  $activeWebHits |
    Where-Object { $_.Line -match '-compat\.js' }
).Count

$activeWebModularCount = @(
  $activeWebHits |
    Where-Object {
      $_.Line -match 'firebase-app\.js|firebase-auth\.js|firebase-firestore\.js|firebase-storage\.js'
    } |
    Where-Object { $_.Line -notmatch '-compat\.js' }
).Count

$evidence = @"
DEERCAMP FIREBASE COMMERCIAL READINESS AUDIT
Timestamp: $timestamp
Repository: $RepoRoot
Branch: $branch
Commit: $gitCommit
Host: $hostName

RUNTIMES AND TOOLS
Node local: $node
Firebase CLI: $cli
firebase.json Functions runtime: $runtime
functions/package.json Node engine: $engine
Functions build script: $buildScript
TypeScript installed: $($versions.typescript)

INSTALLED PACKAGES
@react-native-firebase/app: $($versions.rnApp)
@react-native-firebase/auth: $($versions.rnAuth)
@react-native-firebase/firestore: $($versions.rnFirestore)
@react-native-firebase/storage: $($versions.rnStorage)
firebase-admin: $($versions.admin)
firebase-functions: $($versions.functions)

FUNCTIONS SOURCE AUDIT
functions.config() hits: $($configHits.Count)
Active v1 import hits: $($v1Hits.Count)
Active v2 import hits: $($v2Hits.Count)

FIREBASE REFERENCE CLASSIFICATION
Active Production Web hits: $($activeWebHits.Count)
Mobile Source hits: $($mobileHits.Count)
Compiled / Runtime hits: $($compiledHits.Count)
Archive / Backup hits: $($archiveHits.Count)
Reference Asset hits: $($referenceHits.Count)

ACTIVE PRODUCTION WEB SUMMARY
Detected CDN versions: $($activeWebVersions -join ", ")
Compat references: $activeWebCompatCount
Modular references: $activeWebModularCount

ACTIVE PRODUCTION WEB REFERENCES
$(Format-Hits $activeWebHits)

MOBILE SOURCE REFERENCES
$(Format-Hits $mobileHits)

COMPILED / RUNTIME REFERENCES
$(Format-Hits $compiledHits)

ARCHIVE / BACKUP REFERENCES
$(Format-Hits $archiveHits)

REFERENCE ASSET REFERENCES
$(Format-Hits $referenceHits)
"@

$evidence | Set-Content $evidenceFile -Encoding UTF8
$evidence | Set-Content $latestFile -Encoding UTF8

Set-Dependency $data "D-003A" @{
  currentVersion = $versions.rnApp
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

Set-Dependency $data "D-003B" @{
  currentVersion = $versions.rnAuth
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

Set-Dependency $data "D-003C" @{
  currentVersion = $versions.rnFirestore
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

Set-Dependency $data "D-003D" @{
  currentVersion = $versions.rnStorage
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

Set-Dependency $data "D-031" @{
  currentVersion = $versions.admin
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

Set-Dependency $data "D-032" @{
  currentVersion = $versions.functions
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

Set-Dependency $data "D-033" @{
  currentVersion = "Node.js $engine"
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

Set-Dependency $data "D-034" @{
  currentVersion = $cli
  lastChecked    = $timestamp
  evidence       = "../evidence/firebase-audit-latest.txt"
}

if ($activeWebHits.Count -gt 0) {
  $versionSummary = if ($activeWebVersions.Count -gt 0) {
    $activeWebVersions -join ", "
  }
  else {
    "npm/import-based"
  }

  Set-Dependency $data "D-003" @{
    currentVersion = $versionSummary
    status         = "Review Required"
    requiredAction = "Review active production web references only; standardize compat and modular Firebase usage before launch"
    lastChecked    = $timestamp
    evidence       = "../evidence/firebase-audit-latest.txt"
  }
}
else {
  Set-Dependency $data "D-003" @{
    currentVersion = "No active production web references detected"
    status         = "Review Required"
    requiredAction = "Verify shared configuration and generated assets before marking not applicable"
    lastChecked    = $timestamp
    evidence       = "../evidence/firebase-audit-latest.txt"
  }
}

if ($buildScript -match 'echo|checked-in') {
  Set-Dependency $data "D-035" @{
    status         = "Launch Blocker"
    currentVersion = $buildScript
    lastChecked    = $timestamp
    evidence       = "../evidence/firebase-audit-latest.txt"
  }
}
else {
  Set-Dependency $data "D-035" @{
    status         = "Review Required"
    currentVersion = $buildScript
    lastChecked    = $timestamp
    evidence       = "../evidence/firebase-audit-latest.txt"
  }
}

$data.meta.lastAudit = $timestamp
$data.meta.gitCommit = $gitCommit
$data.meta.branch = $branch
$data.meta.auditHost = $hostName

Add-Change $changes "Firebase audit v1.1" (
  "Classified Firebase references into active production web, mobile source, compiled/runtime, archive/backup, and reference assets. " +
  "Active web: $($activeWebHits.Count); mobile: $($mobileHits.Count); compiled: $($compiledHits.Count); archive: $($archiveHits.Count); reference: $($referenceHits.Count)."
)

$data | ConvertTo-Json -Depth 20 |
  Set-Content $dataPath -Encoding UTF8

$changes | ConvertTo-Json -Depth 10 |
  Set-Content $changePath -Encoding UTF8

Write-Host ""
Write-Host "Firebase audit v1.1 complete." -ForegroundColor Cyan
Write-Host "Evidence: $evidenceFile"
Write-Host "Register: $dataPath"
Write-Host ""
Write-Host "Reference counts:"
Write-Host "  Active Production Web: $($activeWebHits.Count)"
Write-Host "  Mobile Source:         $($mobileHits.Count)"
Write-Host "  Compiled / Runtime:    $($compiledHits.Count)"
Write-Host "  Archive / Backup:      $($archiveHits.Count)"
Write-Host "  Reference Asset:       $($referenceHits.Count)"
Write-Host ""
Write-Host "Next:"
Write-Host "  git diff -- commercial-readiness"
Write-Host "  .\commercial-readiness\scripts\serve-command-center.ps1"
