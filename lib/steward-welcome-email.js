const fs = require('fs/promises');
const path = require('path');

const DEFAULT_SITE_URL = 'https://www.ourdeercamp.com';
const DEFAULT_FROM = 'DeerCamp <welcome@ourdeercamp.com>';
const DEFAULT_SUBJECT = 'Welcome to DeerCamp';
const DEFAULT_BUILDER_PATH = '/buildyourcamp.html';
const DEFAULT_REPLY_TO = 'eric.simmerman@ourdeercamp.com';
const ICON_FILENAME = 'deercamp-icon.png';
const ICON_CONTENT_ID = 'deercamp-icon.png';

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getNestedValue(source, valuePath) {
  if (!source || !valuePath) return '';
  const parts = String(valuePath).split('.');
  let current = source;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return '';
    }
    current = current[part];
  }
  return normalizeValue(current);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const clean = normalizeValue(value);
    if (clean) return clean;
  }
  return '';
}

function getCampName(payload = {}) {
  return firstNonEmpty(
    payload.campName,
    getNestedValue(payload, 'camp.name'),
    getNestedValue(payload, 'campData.name'),
    getNestedValue(payload, 'campData.campName')
  );
}

function getBaseUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function getNormalizedPath(value, fallback) {
  const configuredPath = normalizeValue(value || fallback);
  if (!configuredPath) return fallback;
  return configuredPath.startsWith('/') ? configuredPath : `/${configuredPath}`;
}

function appendIfPresent(url, key, value) {
  const clean = normalizeValue(value);
  if (clean) {
    url.searchParams.set(key, clean);
  }
}

function getEmailVariant(payload = {}) {
  const variant = normalizeValue(payload.emailVariant || payload.variant || '').toLowerCase();
  return variant === 'return-link' || variant === 'resume' ? 'return-link' : 'starter';
}

function buildLegacyPrefillSetupLink(payload = {}) {
  const baseUrl = getBaseUrl();
  const builderPath = getNormalizedPath(payload.setupPath || process.env.WELCOME_BUILDER_PATH, DEFAULT_BUILDER_PATH);
  const builderUrl = new URL(builderPath, `${baseUrl}/`);

  appendIfPresent(builderUrl, 'campId', payload.campId);
  appendIfPresent(builderUrl, 'campName', getCampName(payload));
  appendIfPresent(builderUrl, 'campCity', payload.campCity || payload.city);
  appendIfPresent(builderUrl, 'campState', payload.campState || payload.state);
  appendIfPresent(builderUrl, 'campZip', payload.campZip || payload.zip);
  appendIfPresent(builderUrl, 'campYear', payload.campYear || payload.established);
  appendIfPresent(
    builderUrl,
    'campSteward',
    payload.campSteward ||
      payload.stewardName ||
      getNestedValue(payload, 'steward.name') ||
      [payload.stewardFirstName, payload.stewardLastName].map(normalizeValue).filter(Boolean).join(' ')
  );
  appendIfPresent(builderUrl, 'campStewardEmail', payload.campStewardEmail || payload.stewardEmail || getNestedValue(payload, 'steward.email') || payload.email || payload.to);
  appendIfPresent(builderUrl, 'campMembers', payload.campMembers);
  appendIfPresent(builderUrl, 'campTraditionsCustom', payload.campTraditionsCustom);
  appendIfPresent(builderUrl, 'campDeerDrives', payload.campDeerDrives);
  appendIfPresent(builderUrl, 'heroTemplate', payload.heroTemplate);

  return builderUrl.toString();
}

function buildStewardSetupLink(payload = {}) {
  const baseUrl = getBaseUrl();
  const builderPath = getNormalizedPath(
    payload.setupPath || payload.returnPath || process.env.WELCOME_BUILDER_PATH || process.env.WELCOME_RETURN_PATH,
    DEFAULT_BUILDER_PATH
  );
  const builderUrl = new URL(builderPath, `${baseUrl}/`);
  const campId = normalizeValue(payload.campId);
  const campName = getCampName(payload);

  if (campId) {
    builderUrl.searchParams.set('campId', campId);
    appendIfPresent(builderUrl, 'campName', campName);
    return builderUrl.toString();
  }

  return buildLegacyPrefillSetupLink(payload);
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function tryReadUtf8(filePath) {
  try {
    return await readUtf8(filePath);
  } catch (error) {
    return '';
  }
}

async function readBase64(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

function getDefaultHtmlTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{headline}}</title>
</head>
<body style="margin:0; padding:0; background:#f5f1e8; font-family:Arial, Helvetica, sans-serif; color:#2f2a24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e8; margin:0; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:16px; overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 12px 32px; text-align:left;">
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <img src="cid:${ICON_CONTENT_ID}" alt="DeerCamp" width="40" height="40" style="display:inline-block; vertical-align:middle; border:0;" />
                <div style="font-size:24px; line-height:1.2; font-weight:700; color:#1f1a15;">{{headline}}</div>
              </div>
              <div style="font-size:15px; line-height:1.7; color:#3b342c;">
                {{greeting_block}}
                <p style="margin:0 0 16px 0;">{{intro_line}}</p>
                <p style="margin:0 0 16px 0;">{{detail_line}}</p>
                <p style="margin:0 0 24px 0;">
                  <a href="{{cta_link}}" style="display:inline-block; background:#2f5d3a; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:10px; font-weight:700;">{{cta_label}}</a>
                </p>
                <p style="margin:0 0 16px 0;">{{fallback_copy}}</p>
                <p style="margin:0 0 24px 0; word-break:break-word;"><a href="{{fallback_link}}" style="color:#2f5d3a;">{{fallback_link}}</a></p>
                <p style="margin:0 0 16px 0;">We’re glad to have you here, and thank you for getting started.</p>
                <p style="margin:0 0 18px 0;">
                  <a href="https://ourdeercamp.com" style="display:inline-block; background:#ffffff; color:#2f5d3a; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700; border:1px solid #2f5d3a;">Share DeerCamp</a>
                </p>
                <p style="margin:0 0 0 0;">— Eric Simmerman, Founder</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle; padding-right:10px;">
                    <img src="cid:${ICON_CONTENT_ID}" alt="DeerCamp" width="24" height="24" style="display:block; border:0;" />
                  </td>
                  <td style="vertical-align:middle; font-size:13px; line-height:1.6; color:#6a6157;">
                    Sent from <a href="mailto:welcome@ourdeercamp.com" style="color:#2f5d3a; text-decoration:none;">welcome@ourdeercamp.com</a><br />
                    {{footer_label}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getDefaultTextTemplate() {
  return `{{greeting_text}}{{headline}}

{{intro_line}}

{{detail_line}}

{{cta_label}}:
{{cta_link}}

{{fallback_copy}}

We’re glad to have you here, and thank you for getting started.

Share DeerCamp:
https://ourdeercamp.com

— Eric Simmerman, Founder

Sent from welcome@ourdeercamp.com
{{footer_label}}
`;
}

async function loadWelcomeTemplates() {
  const templateDir = path.join(process.cwd(), 'email-assets', 'steward-welcome');
  const htmlPath = path.join(templateDir, 'deercamp-steward-welcome-email.html');
  const textPath = path.join(templateDir, 'deercamp-steward-welcome-email.txt');
  const iconPath = path.join(templateDir, ICON_FILENAME);

  const htmlTemplate = (await tryReadUtf8(htmlPath)) || getDefaultHtmlTemplate();
  const textTemplate = (await tryReadUtf8(textPath)) || getDefaultTextTemplate();

  let iconBase64 = '';
  try {
    iconBase64 = await readBase64(iconPath);
  } catch (error) {
    iconBase64 = '';
  }

  return { htmlTemplate, textTemplate, iconBase64 };
}

function renderTemplate(template, replacements) {
  return Object.entries(replacements).reduce((output, [token, value]) => {
    return output.split(token).join(value);
  }, template);
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRecipientName(payload = {}) {
  const explicitName = firstNonEmpty(
    payload.campSteward,
    payload.stewardName,
    getNestedValue(payload, 'steward.name'),
    getNestedValue(payload, 'camp.stewardName'),
    getNestedValue(payload, 'campData.stewardName')
  );
  if (explicitName) return explicitName;

  const first = normalizeValue(payload.stewardFirstName);
  const last = normalizeValue(payload.stewardLastName);
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  return fullName || 'Steward';
}

function getRecipientEmail(payload = {}) {
  const email = firstNonEmpty(
    payload.campStewardEmail,
    payload.stewardEmail,
    getNestedValue(payload, 'steward.email'),
    getNestedValue(payload, 'camp.stewardEmail'),
    getNestedValue(payload, 'campData.stewardEmail'),
    payload.email,
    payload.to
  );
  if (!email) {
    throw new Error('Missing campStewardEmail or stewardEmail in request payload.');
  }
  return email;
}

function injectGreeting(html, text, recipientName) {
  const greetingHtml = `<p style="margin:0 0 16px 0;">Hi ${htmlEscape(recipientName)},</p>`;
  const greetingText = `Hi ${recipientName},\n\n`;

  return {
    html: html.replace('{{greeting_block}}', greetingHtml),
    text: text.replace('{{greeting_text}}', greetingText)
  };
}

function buildDynamicCtaLabel(campName) {
  return campName ? `Continue Your Saved DeerCamp — ${campName}` : 'Continue Your Saved DeerCamp';
}

function buildVisibleFallbackLink(payload = {}, setupLink = '') {
  const baseUrl = getBaseUrl();
  const builderPath = getNormalizedPath(
    payload.setupPath || payload.returnPath || process.env.WELCOME_BUILDER_PATH || process.env.WELCOME_RETURN_PATH,
    DEFAULT_BUILDER_PATH
  );
  const builderUrl = new URL(builderPath, `${baseUrl}/`);
  const campId = normalizeValue(payload.campId);
  const campName = getCampName(payload);

  if (campId) {
    builderUrl.searchParams.set('campId', campId);
    appendIfPresent(builderUrl, 'campName', campName);
    return builderUrl.toString();
  }

  return setupLink || buildStewardSetupLink(payload);
}

function buildEmailCopy(payload = {}) {
  const campName = getCampName(payload);
  const variant = getEmailVariant(payload);
  const ctaLabel = buildDynamicCtaLabel(campName);
  const fallbackCopy = 'This link returns you to your saved DeerCamp setup. Any work you’ve already saved will still be there.';

  if (variant === 'return-link') {
    return {
      headline: 'Continue Your Saved DeerCamp',
      introLine: 'We saved the progress you added to your camp.',
      detailLine: 'Use the link below to return to your saved DeerCamp setup and keep building without losing any work you already saved.',
      ctaLabel,
      fallbackCopy,
      footerLabel: 'DeerCamp Steward Return Link Email',
      subject: campName ? `Continue Your Saved DeerCamp — ${campName}` : 'Continue Your Saved DeerCamp'
    };
  }

  return {
    headline: 'Welcome to DeerCamp',
    introLine: 'Thank you for signing up and building with DeerCamp.',
    detailLine: 'Your saved DeerCamp setup is ready below. Use this link to keep building without losing any work you save.',
    ctaLabel,
    fallbackCopy,
    footerLabel: 'DeerCamp Steward Welcome Email',
    subject: campName ? `Welcome to DeerCamp — ${campName}` : DEFAULT_SUBJECT
  };
}

async function composeStewardWelcomeEmail(payload = {}) {
  const setupLink = buildStewardSetupLink(payload);
  const fallbackLink = buildVisibleFallbackLink(payload, setupLink);
  const recipientName = getRecipientName(payload);
  const recipientEmail = getRecipientEmail(payload);
  const { htmlTemplate, textTemplate, iconBase64 } = await loadWelcomeTemplates();
  const copy = buildEmailCopy(payload);

  const replacements = {
    '{{headline}}': copy.headline,
    '{{intro_line}}': copy.introLine,
    '{{detail_line}}': copy.detailLine,
    '{{cta_label}}': copy.ctaLabel,
    '{{fallback_copy}}': copy.fallbackCopy,
    '{{cta_link}}': setupLink,
    '{{fallback_link}}': fallbackLink,
    '{{setup_link}}': setupLink,
    '{{footer_label}}': copy.footerLabel,
    '{{greeting_block}}': '{{greeting_block}}',
    '{{greeting_text}}': '{{greeting_text}}'
  };

  const renderedHtml = renderTemplate(htmlTemplate, replacements);
  const renderedText = renderTemplate(textTemplate, replacements);
  const withGreeting = injectGreeting(renderedHtml, renderedText, recipientName);

  const attachments = [];
  if (iconBase64) {
    attachments.push({
      filename: ICON_FILENAME,
      content: iconBase64,
      content_type: 'image/png',
      content_id: ICON_CONTENT_ID,
      content_disposition: 'inline',
    });
  }

  return {
    to: recipientEmail,
    subject: copy.subject,
    from: process.env.WELCOME_FROM || DEFAULT_FROM,
    html: withGreeting.html,
    text: withGreeting.text,
    replyTo: process.env.WELCOME_REPLY_TO || DEFAULT_REPLY_TO,
    attachments,
    tags: [
      { name: 'flow', value: getEmailVariant(payload) === 'return-link' ? 'steward-return-link' : 'steward-welcome' },
      { name: 'environment', value: process.env.VERCEL_ENV || 'local' },
    ],
    setupLink,
    fallbackLink,
  };
}

async function sendViaResend(emailPayload) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailPayload.from,
      to: [emailPayload.to],
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
      reply_to: emailPayload.replyTo,
      attachments: emailPayload.attachments,
      tags: emailPayload.tags,
    }),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = responseBody?.message || responseBody?.error || `Resend error (${response.status})`;
    throw new Error(errorMessage);
  }

  return responseBody;
}

module.exports = {
  buildStewardSetupLink,
  buildVisibleFallbackLink,
  composeStewardWelcomeEmail,
  sendViaResend,
};
