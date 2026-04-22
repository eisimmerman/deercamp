**Add a restore note**



**Inside that folder, make a small text file called RESTORE-NOTES.txt with:**



**commit hash: cccf9fc8**

**tag: deercamp-last-known-good-2026-04-08**

**branch: backup/2026-04-08-camp-page-stable**

**tested URL: https://ourdeercamp.com/camp.html?campId=camp-tv-appleton-wi-54911**

**If you need to restore later**

**Restore from the tagged good commit**

**git checkout deercamp-last-known-good-2026-04-08 -- camp.html**



**Or restore the whole repo state from that commit into a new branch:**



**git checkout -b restore/deercamp-good-2026-04-08 deercamp-last-known-good-2026-04-08**



**Then push:**



**git push origin restore/deercamp-good-2026-04-08**

**Or restore from the backup branch**

**git checkout backup/2026-04-08-camp-page-stable**

**Or restore from the local zip**



**Just unzip and copy the files back into the project folder.**



**My recommendation**



**For DeerCamp, use this naming pattern every time you hit a stable milestone:**



**tag: deercamp-last-known-good-YYYY-MM-DD**

**branch: backup/YYYY-MM-DD-description**

**local zip: \_known\_good\_YYYY-MM-DD.zip**



**That gives you a clean recovery system without guessing.**



**Use these exact commands now:**



**git tag deercamp-last-known-good-2026-04-08 cccf9fc8**

**git push origin deercamp-last-known-good-2026-04-08**

**git branch backup/2026-04-08-camp-page-stable cccf9fc8**

**git push origin backup/2026-04-08-camp-page-stable**

**New-Item -ItemType Directory -Path .\\\_known\_good\_2026-04-08 -Force**

**Copy-Item .\\camp.html .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\index.html .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\build.html .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\buildyourcamp.html .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\steward-dashboard.html .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\member-setup.html .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\camp-features.css .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\camp-calendar.js .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\code.js .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\firebase.json .\\\_known\_good\_2026-04-08\\ -Force**

**Copy-Item .\\.firebaserc .\\\_known\_good\_2026-04-08\\ -Force**

**Compress-Archive -Path .\\\_known\_good\_2026-04-08\\\* -DestinationPath .\\\_known\_good\_2026-04-08.zip -Force**

