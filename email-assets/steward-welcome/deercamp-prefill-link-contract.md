# DeerCamp Prefill Link Contract

This contract defines the setup link used in the Steward welcome email.

## Placeholder used in email templates

- `{{setup_link}}` = fully generated DeerCamp setup URL

## Target route

- `buildyourcamp.html`

## Expected URL shape

```text
https://www.ourdeercamp.com/buildyourcamp.html?campName={campName}&locationName={locationName}&city={city}&state={state}&zip={zip}&stewardFirstName={stewardFirstName}&stewardLastName={stewardLastName}&stewardEmail={stewardEmail}&campType={campType}&campDescription={campDescription}
```

Use only the parameters you actually have. Omit empty values rather than sending blank placeholders.

## Parameter contract

- `campName`: Camp name shown to the Steward
- `locationName`: Friendly camp property or land name
- `city`: Camp city
- `state`: Two-letter state code preferred
- `zip`: ZIP code
- `stewardFirstName`: Steward first name
- `stewardLastName`: Steward last name
- `stewardEmail`: Steward email address
- `campType`: Camp style/type selected in the starter form
- `campDescription`: Short camp description or summary

## Rules

1. URL-encode every value.
2. Do not include parameters with null, undefined, or empty-string values.
3. Preserve source-of-truth values from the initial 5-minute form submission.
4. Insert the fully built URL into `{{setup_link}}` before sending.
5. The email sender should be `welcome@ourdeercamp.com`.

## Example generated link

```text
https://www.ourdeercamp.com/buildyourcamp.html?campName=Northwoods%20Ridge&city=Eau%20Claire&state=WI&zip=54701&stewardFirstName=Eric&stewardLastName=Simmerman&stewardEmail=eric@example.com
```
