# DeerCamp V2 Foundation

Created: August 3, 2026

## Purpose

Build the production DeerCamp room-based experience using:

- The locked Camp Boddington interaction model
- The existing five-minute camp creation flow
- The existing Firebase data contract
- The current camps/{campId} Firestore document

## Preserved Creation Contract

- Camp form: /build.html
- Camp continuation: /buildyourcamp.html
- Current Steward setup: /steward-dashboard.html
- Current live camp: /camp.html
- Cloud service: /firebase-web.js
- Firestore document: camps/{campId}
- Save behavior: merge
- Browser fallback: generic and camp-scoped localStorage

## Initial V2 Route

/v2/index.html?campId={campId}

## Canonical Visual Reference

/presentations/craig-boddington/locked-reference/camp-boddington-canonical-v1

## First Vertical Slice

1. Resolve campId.
2. Hydrate the camp through DeerCampCloud.
3. Render the personalized V2 main camp.
4. Open one production room.
5. View saved or starter content.
6. Create real content.
7. Save through DeerCampCloud.
8. Reflect the saved content in CampFeed.

## Foundation Rules

1. Do not modify the locked Camp Boddington reference.
2. Do not replace camp.html during foundation development.
3. Reuse firebase-web.js and camps/{campId}.
4. Preserve V1 as the fallback until V2 passes staging regression.
5. Keep all initial V2 work under /v2.
