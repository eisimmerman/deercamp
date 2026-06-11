DeerCamp CampGrowthAgent Phase 3A - Campaign Tracking

Updated files:
- index.html
- build.html
- buildyourcamp.html
- steward-dashboard.html

What changed:
- Homepage build links preserve attribution parameters like ?ref=WI-TAVERN-001.
- build.html captures campaign IDs from ?ref=, ?campaignId=, ?cid=, ?dc_campaign=, or ?utm_campaign=.
- Camp records now save campaignId, campaignName, campaignType, campaignRef, and existing UTM fields.
- Campaign metadata is included in local camp data, dashboard seed, welcome payload, cloud save payload, and camp_created metric events.
- buildyourcamp.html carries campaign params forward to the Steward Dashboard when present.
- steward-dashboard.html preserves campaign fields during dashboard saves, so later saves do not wipe attribution.

Test examples:
https://deercamp-staging.web.app/build.html?ref=WI-TAVERN-001
https://deercamp-staging.web.app/build.html?ref=FB-WI-GROUP-003
https://deercamp-staging.web.app/build.html?campaignId=TAX-WI-007&campaignName=Buck%20Country%20Taxidermy%20Poster&campaignType=Taxidermist
