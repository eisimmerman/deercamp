DeerCamp Admin Metrics Firestore Refresh Fix

Updated:
- admin-metrics.html

Fixes:
- Cache-busts firebase-web.js so staging does not accidentally keep using an older production Firebase config.
- Adds direct Firestore camps collection loading and merges it with DeerCampCloud.listCamps.
- Adds Firebase Project card so you can immediately see whether the dashboard is reading deercamp-staging or deercamp-47c12.
- Adds Hard Reload button for stubborn browser cache cases.
- Load status now shows total camp records and attributed records.

Expected after staging deploy:
- Firebase Project card should show deercamp-staging.
- Campaign Performance should show WI-TAVERN-001, WI-PROCESSOR-001, WI-TAXIDERMIST-001, WI-OUTFITTER-001, and WI-FBGROUP-001.
