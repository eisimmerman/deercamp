# DeerCamp Commercial Readiness Command Center v1.0

Copy the entire `commercial-readiness` folder into `C:\Users\simme\Documents\DeerCamp`.

## First run

```powershell
cd C:\Users\simme\Documents\DeerCamp
Set-ExecutionPolicy -Scope Process Bypass
.\commercial-readiness\scripts\run-firebase-audit.ps1
.\commercial-readiness\scripts\serve-command-center.ps1
```

Open `http://localhost:8080/commercial-readiness/`. Do not double-click `index.html`; browsers often block local JSON loading.

## Git

```powershell
git status
git diff -- commercial-readiness
git add commercial-readiness
git commit -m "Add Commercial Readiness Command Center v1.0"
git push origin main
```

## Staging

```powershell
firebase use staging
firebase deploy --only hosting
```

Expected path: `https://deercamp-staging.web.app/commercial-readiness/`

## Security

Never write API keys, private keys, access tokens, webhook secrets, or credential contents into JSON, evidence, Git, or the webpage.
