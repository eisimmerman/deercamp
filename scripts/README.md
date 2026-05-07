# DeerCamp Deploy Scripts

Place these two files in your project root under:

```text
scripts/
```

## Staging deploy

```powershell
.\scripts\deploy-staging.ps1 -Message "Describe this change"
```

This script:
- checks for sensitive/generated files
- stages known DeerCamp runtime files only
- asks before committing
- commits and pushes
- deploys to staging
- writes a local marker that production deploy checks

## Production deploy

```powershell
.\scripts\deploy-production.ps1
```

This script:
- requires a clean Git working tree
- requires a recent staging deploy marker
- asks for explicit confirmation
- deploys to production

## Normal workflow

```text
Replace/edit local files
→ run deploy-staging.ps1
→ test https://deercamp-staging.web.app
→ run deploy-production.ps1
→ verify https://ourdeercamp.com
```
