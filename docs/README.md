# DeerCamp Steward Welcome Email Bundle

This bundle gives you a drop-in send flow for the Steward welcome email.

## Included

- `api/send-steward-welcome.js` — Vercel serverless endpoint
- `lib/steward-welcome-email.js` — link building, template rendering, and Resend sending logic
- `email-assets/steward-welcome/*` — your email template files
- `docs/steward-welcome-installation.md` — install and testing guide
- `docs/example-request.json` — sample payload

## Fast answer to “where do the 3 downloaded files go?”

They should live here:

```text
email-assets/steward-welcome/
```

Also copy your DeerCamp icon into that same folder as:

```text
deercamp-icon.png
```
