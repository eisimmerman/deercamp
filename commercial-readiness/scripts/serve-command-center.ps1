[CmdletBinding()]
param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$url = "http://127.0.0.1:$Port/commercial-readiness/"

function Test-CommandAvailable {
  param([string]$Name)

  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Push-Location $repo

try {
  Write-Host ""
  Write-Host "DeerCamp Commercial Readiness Command Center" -ForegroundColor Cyan
  Write-Host "Open: $url"
  Write-Host "Press Ctrl+C to stop the server."
  Write-Host ""

  if (Test-CommandAvailable "python") {
    try {
      $pythonVersion = & python --version 2>&1

      if ($LASTEXITCODE -eq 0 -and $pythonVersion -notmatch "Microsoft Store") {
        Write-Host "Server: Python http.server" -ForegroundColor DarkGray
        & python -m http.server $Port
        exit $LASTEXITCODE
      }
    }
    catch {
      # Continue to Node fallback.
    }
  }

  if (Test-CommandAvailable "py") {
    try {
      $pyVersion = & py --version 2>&1

      if ($LASTEXITCODE -eq 0) {
        Write-Host "Server: Python Launcher http.server" -ForegroundColor DarkGray
        & py -m http.server $Port
        exit $LASTEXITCODE
      }
    }
    catch {
      # Continue to Node fallback.
    }
  }

  if (Test-CommandAvailable "npx") {
    Write-Host "Server: Node http-server" -ForegroundColor DarkGray
    & npx --yes http-server . -p $Port -c-1
    exit $LASTEXITCODE
  }

  throw @"
No supported local web server was found.

Install either:
- Python 3, or
- Node.js with npm/npx

Then rerun:
.\commercial-readiness\scripts\serve-command-center.ps1
"@
}
finally {
  Pop-Location
}
