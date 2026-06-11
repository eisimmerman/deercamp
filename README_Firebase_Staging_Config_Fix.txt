DeerCamp Firebase Staging Config Fix

Updated:
- firebase-web.js

What changed:
- deercamp-staging.web.app now initializes Firebase with projectId: deercamp-staging.
- production hosts continue using projectId: deercamp-47c12.
- Added window.DEERCAMP_FIREBASE_PROJECT_ID for quick console verification.

After staging deploy, test in DevTools Console:
firebase.app().options.projectId
window.DEERCAMP_FIREBASE_PROJECT_ID

Expected on staging:
deercamp-staging

Then test:
https://deercamp-staging.web.app/build.html?ref=WI-TAVERN-001

Expected:
The new camp document appears in staging Firestore under camps with campaignId WI-TAVERN-001.
