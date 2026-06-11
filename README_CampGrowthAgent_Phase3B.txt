DeerCamp CampGrowthAgent Phase 3B Dashboard Fix

Updated:
- admin-metrics.html

What changed:
- Dashboard now reads campaignId, campaignRef, campaignName, and campaignType from Phase 3A camp records.
- Campaign filter now includes campaign IDs like WI-TAVERN-001.
- Added Campaign Performance table.
- Added Campaign Types table.
- Added campaignType to search, export CSV, Recent Camps, and High-Intent tables.

Test:
1. Deploy staging.
2. Open https://deercamp-staging.web.app/admin-metrics.html
3. Unlock dashboard.
4. Verify WI-TAVERN-001 appears under Campaign Performance.
5. Verify Tavern / Supper Club appears under Campaign Types.
