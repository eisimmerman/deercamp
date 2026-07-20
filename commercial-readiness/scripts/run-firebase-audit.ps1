[CmdletBinding()]param([string]$RepoRoot=(Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path)
$ErrorActionPreference="Stop";$crRoot=Join-Path $RepoRoot "commercial-readiness";$dataPath=Join-Path $crRoot "data\readiness-data.json";$changePath=Join-Path $crRoot "data\audit-changes.json";$evidenceDir=Join-Path $crRoot "evidence";New-Item -ItemType Directory -Force -Path $evidenceDir|Out-Null
$timestamp=Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz";$stampFile=Get-Date -Format "yyyyMMdd-HHmmss";$evidenceFile=Join-Path $evidenceDir "firebase-audit-$stampFile.txt";$latestFile=Join-Path $evidenceDir "firebase-audit-latest.txt"
function Get-InstalledVersion{param([string]$WorkingDir,[string]$Name) Push-Location $WorkingDir;try{$raw=npm list $Name --depth=0 --json 2>$null|ConvertFrom-Json;return $raw.dependencies.$Name.version}catch{return $null}finally{Pop-Location}}
function Set-Dependency{param($Data,[string]$Id,[hashtable]$Fields)$item=$Data.dependencies|Where-Object id -eq $Id|Select-Object -First 1;if(!$item){return};foreach($key in $Fields.Keys){$item.$key=$Fields[$key]}}
$data=Get-Content $dataPath -Raw|ConvertFrom-Json;$changes=Get-Content $changePath -Raw|ConvertFrom-Json;$fnDir=Join-Path $RepoRoot "functions";$fnPkg=Join-Path $fnDir "package.json";$firebaseJson=Join-Path $RepoRoot "firebase.json"
$versions=[ordered]@{rnApp=Get-InstalledVersion $RepoRoot "@react-native-firebase/app";rnAuth=Get-InstalledVersion $RepoRoot "@react-native-firebase/auth";rnFirestore=Get-InstalledVersion $RepoRoot "@react-native-firebase/firestore";rnStorage=Get-InstalledVersion $RepoRoot "@react-native-firebase/storage";admin=Get-InstalledVersion $fnDir "firebase-admin";functions=Get-InstalledVersion $fnDir "firebase-functions";typescript=Get-InstalledVersion $fnDir "typescript"}
$cli=try{firebase --version}catch{"Unavailable"};$node=try{node --version}catch{"Unavailable"};$gitCommit=try{git -C $RepoRoot rev-parse --short HEAD}catch{"Unknown"};$branch=try{git -C $RepoRoot branch --show-current}catch{"Unknown"};$hostName=$env:COMPUTERNAME
$runtime=$null;if(Test-Path $firebaseJson){$fj=Get-Content $firebaseJson -Raw|ConvertFrom-Json;$runtime=@($fj.functions)[0].runtime};$pkg=Get-Content $fnPkg -Raw|ConvertFrom-Json;$engine=$pkg.engines.node;$buildScript=$pkg.scripts.build
$configHits=@(Get-ChildItem (Join-Path $fnDir "src") -Recurse -File -Include *.ts,*.js|Select-String -Pattern 'functions\.config\(');$v1Hits=@(Get-ChildItem (Join-Path $fnDir "src") -Recurse -File -Include *.ts,*.js|Where-Object Name -notlike "*.before-*"|Select-String -Pattern 'firebase-functions/v1');$v2Hits=@(Get-ChildItem (Join-Path $fnDir "src") -Recurse -File -Include *.ts,*.js|Where-Object Name -notlike "*.before-*"|Select-String -Pattern 'firebase-functions/v2')
$webRefs=@(Get-ChildItem $RepoRoot -Recurse -File -Include *.html,*.js,*.mjs,*.cjs,*.ts,*.tsx|Where-Object{$_.FullName -notmatch '\\node_modules\\|\\\.git\\|\\commercial-readiness\\|\\functions\\lib\\'}|Select-String -Pattern 'firebasejs|from\s+["'']firebase/|firebase\.initializeApp')
$evidence=@"
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

SOURCE AUDIT
functions.config() hits: $($configHits.Count)
Active v1 import hits: $($v1Hits.Count)
Active v2 import hits: $($v2Hits.Count)
Firebase Web/CDN reference hits: $($webRefs.Count)

WEB REFERENCES
$($webRefs|ForEach-Object{"$($_.Path):$($_.LineNumber): $($_.Line.Trim())"}|Out-String)
"@
$evidence|Set-Content $evidenceFile -Encoding UTF8;$evidence|Set-Content $latestFile -Encoding UTF8
Set-Dependency $data "D-003A" @{currentVersion=$versions.rnApp;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"};Set-Dependency $data "D-003B" @{currentVersion=$versions.rnAuth;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"};Set-Dependency $data "D-003C" @{currentVersion=$versions.rnFirestore;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"};Set-Dependency $data "D-003D" @{currentVersion=$versions.rnStorage;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"};Set-Dependency $data "D-031" @{currentVersion=$versions.admin;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"};Set-Dependency $data "D-032" @{currentVersion=$versions.functions;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"};Set-Dependency $data "D-033" @{currentVersion="Node.js $engine";lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"};Set-Dependency $data "D-034" @{currentVersion=$cli;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"}
if($webRefs.Count -gt 0){Set-Dependency $data "D-003" @{status="Review Required";requiredAction="Review detected Firebase Web/CDN references and standardize versions";lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"}}else{Set-Dependency $data "D-003" @{status="Review Required";requiredAction="No direct Web/CDN references detected; verify shared config and generated assets";lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"}}
if($buildScript -match 'echo|checked-in'){Set-Dependency $data "D-035" @{status="Launch Blocker";currentVersion=$buildScript;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"}}else{Set-Dependency $data "D-035" @{status="Review Required";currentVersion=$buildScript;lastChecked=$timestamp;evidence="../evidence/firebase-audit-latest.txt"}}
$data.meta.lastAudit=$timestamp;$data.meta.gitCommit=$gitCommit;$data.meta.branch=$branch;$data.meta.auditHost=$hostName;$changes.changes=@(@{timestamp=$timestamp;component="Firebase audit";summary="Captured package versions, runtimes, source API usage, web references and build-process status at commit $gitCommit."})+@($changes.changes);if($changes.changes.Count -gt 100){$changes.changes=@($changes.changes|Select-Object -First 100)};$data|ConvertTo-Json -Depth 20|Set-Content $dataPath -Encoding UTF8;$changes|ConvertTo-Json -Depth 10|Set-Content $changePath -Encoding UTF8
Write-Host "";Write-Host "Firebase audit complete." -ForegroundColor Cyan;Write-Host "Evidence: $evidenceFile";Write-Host "Register: $dataPath";Write-Host "";Write-Host "Next:";Write-Host "  git diff -- commercial-readiness";Write-Host "  .\commercial-readiness\scripts\serve-command-center.ps1"
