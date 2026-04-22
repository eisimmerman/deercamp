# DeerCamp Steward Welcome Email Installation

## Where the files go

Put the files in these exact project locations:

```text
/your-project-root
  /api
    send-steward-welcome.js
  /lib
    steward-welcome-email.js
  /email-assets
    /steward-welcome
      deercamp-steward-welcome-email.html
      deercamp-steward-welcome-email.txt
      deercamp-prefill-link-contract.md
      deercamp-icon.png
```

## Important placement note

Do **not** leave the 3 template files loose in the root.

The serverless send flow expects them in:

```text
email-assets/steward-welcome/
```

Copy your DeerCamp icon file into that same folder and rename it exactly:

```text
deercamp-icon.png
```

That makes the inline email images work without changing the template.

## Environment variables

Add these in Vercel Project Settings → Environment Variables:

```text
RESEND_API_KEY=your_resend_api_key
PUBLIC_SITE_URL=https://www.ourdeercamp.com
WELCOME_FROM=DeerCamp <welcome@ourdeercamp.com>
```

## What this endpoint does

POST to:

```text
/api/send-steward-welcome
```

The endpoint will:

1. Build the prefilled `buildyourcamp.html` link
2. Replace `{{setup_link}}` in the HTML and text templates
3. Attach the DeerCamp icon inline using the existing `cid:deercamp-icon.png`
4. Send the email from `welcome@ourdeercamp.com`

## Expected POST body

```json
{
  "stewardFirstName": "Eric",
  "stewardLastName": "Simmerman",
  "stewardEmail": "eric@example.com",
  "campName": "Northwoods Ridge",
  "locationName": "Big Pine Camp",
  "city": "Eau Claire",
  "state": "WI",
  "zip": "54701",
  "campType": "Family Camp",
  "campDescription": "A Northwoods deer camp for friends and family"
}
```

All empty values are automatically omitted from the generated setup link.

## Preview mode

To test without sending, include:

```json
{
  "send": false
}
```

The endpoint will return the built subject and setup link, but it will not send the email.

## Browser console test

```js
fetch('/api/send-steward-welcome', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    send: false,
    stewardFirstName: 'Eric',
    stewardLastName: 'Simmerman',
    stewardEmail: 'eric@example.com',
    campName: 'Northwoods Ridge',
    city: 'Eau Claire',
    state: 'WI',
    zip: '54701'
  })
}).then(r => r.json()).then(console.log);
```

## Real send test

Change `send: false` to `send: true` or remove `send` entirely.
