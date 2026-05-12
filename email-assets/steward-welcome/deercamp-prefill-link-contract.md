# DeerCamp Resume Link Contract

This contract defines the setup link used in the Steward welcome and resume-later emails.

## Placeholder used in email templates

- `{{setup_link}}` = fully generated DeerCamp resume URL

## Target route

- `buildyourcamp.html`

## Expected URL shape

```text
https://www.ourdeercamp.com/buildyourcamp.html?campId={campId}
```

## Rules

1. Use the `campId`-based resume link whenever `campId` exists.
2. The resume link must reopen the same saved DeerCamp setup without overwriting saved Steward work.
3. Saved Steward edits always win over original starter data.
4. The starter 5-minute builder data is only used to fill blanks.
5. The email sender should be `welcome@ourdeercamp.com`.

## Save + Continue Later behavior

When a Steward taps **Save + Continue Later** in `buildyourcamp.html`:

1. Save the current wizard state locally.
2. Send a resume email to the Steward email on file.
3. Use the same non-destructive `campId` resume link.
4. Do not regenerate or overwrite the camp.

## Legacy fallback

If `campId` is unavailable, the system may temporarily fall back to a prefill-style setup URL until a valid `campId` exists.
