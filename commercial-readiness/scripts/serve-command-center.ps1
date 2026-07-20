param([int]$Port=8080)
$repo=(Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $repo
try{Write-Host "Commercial Readiness Command Center: http://localhost:$Port/commercial-readiness/" -ForegroundColor Cyan;python -m http.server $Port}finally{Pop-Location}
