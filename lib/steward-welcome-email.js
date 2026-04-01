const fs = require('fs/promises');
const path = require('path');

const DEFAULT_SITE_URL = 'https://www.ourdeercamp.com';
const DEFAULT_FROM = 'DeerCamp <welcome@ourdeercamp.com>';
const DEFAULT_SUBJECT = 'Welcome to DeerCamp';
const ICON_FILENAME = 'deercamp-icon.png';
const ICON_CONTENT_ID = 'deercamp-icon.png';

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getBaseUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function buildStewardSetupLink(payload = {}) {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}/buildyourcamp.html`);

  const allowedParams = {
    campName: payload.campName,
    locationName: payload.locationName,
    city: payload.city,
    state: payload.state,
    zip: payload.zip,
    stewardFirstName: payload.stewardFirstName,
    stewardLastName: payload.stewardLastName,
    stewardEmail: payload.stewardEmail,
    campType: payload.campType,
    campDescription: payload.campDescription,
  };

  for (const [key, rawValue] of Object.entries(allowedParams)) {
    const value = normalizeValue(rawValue);
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function readBase64(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

async function loadWelcomeTemplates() {
  const templateDir = path.join(process.cwd(), 'email-assets', 'steward-welcome');
  const htmlPath = path.join(templateDir, 'deercamp-steward-welcome-email.html');
  const textPath = path.join(templateDir, 'deercamp-steward-welcome-email.txt');
  const iconPath = path.join(templateDir, ICON_FILENAME);

  const [htmlTemplate, textTemplate, iconBase64] = await Promise.all([
    readUtf8(htmlPath),
    readUtf8(textPath),
    readBase64(iconPath),
  ]);

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
  const first = normalizeValue(payload.stewardFirstName);
  const last = normalizeValue(payload.stewardLastName);
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  return fullName || 'Steward';
}

function getRecipientEmail(payload = {}) {
  const email = normalizeValue(payload.stewardEmail || payload.email || payload.to);
  if (!email) {
    throw new Error('Missing stewardEmail in request payload.');
  }
  return email;
}

function injectGreeting(html, text, recipientName) {
  const greetingHtml = `<p style="margin:0 0 16px 0;">Hi ${htmlEscape(recipientName)},</p>`;
  const greetingText = `Hi ${recipientName},\n\n`;

  const htmlNeedle = '<p style="margin:0 0 16px 0;">Thank you for signing up and building with DeerCamp.</p>';
  const textNeedle = 'Thank you for signing up and building with DeerCamp.\n\n';

  return {
    html: html.replace(htmlNeedle, `${greetingHtml}${htmlNeedle}`),
    text: text.replace(textNeedle, `${greetingText}${textNeedle}`),
  };
}

async function composeStewardWelcomeEmail(payload = {}) {
  const setupLink = buildStewardSetupLink(payload);
  const recipientName = getRecipientName(payload);
  const recipientEmail = getRecipientEmail(payload);
  const campName = normalizeValue(payload.campName);
  const { htmlTemplate, textTemplate, iconBase64 } = await loadWelcomeTemplates();

  const replacements = {
    '{{setup_link}}': setupLink,
  };

  const renderedHtml = renderTemplate(htmlTemplate, replacements);
  const renderedText = renderTemplate(textTemplate, replacements);
  const withGreeting = injectGreeting(renderedHtml, renderedText, recipientName);

  const subject = campName ? `Welcome to DeerCamp — ${campName}` : DEFAULT_SUBJECT;

  return {
    to: recipientEmail,
    subject,
    from: process.env.WELCOME_FROM || DEFAULT_FROM,
    html: withGreeting.html,
    text: withGreeting.text,
    attachments: [
      {
        filename: ICON_FILENAME,
        content: iconBase64,
        contentType: 'image/png',
        contentId: ICON_CONTENT_ID,
      },
    ],
    tags: [
      { name: 'flow', value: 'steward-welcome' },
      { name: 'environment', value: process.env.VERCEL_ENV || 'local' },
    ],
    setupLink,
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
  composeStewardWelcomeEmail,
  sendViaResend,
};
