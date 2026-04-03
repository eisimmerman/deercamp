const fs = require('fs/promises');
const path = require('path');

const DEFAULT_SITE_URL = 'https://www.ourdeercamp.com';
const DEFAULT_FROM = 'DeerCamp <welcome@ourdeercamp.com>';
const DEFAULT_SUBJECT = 'Welcome to DeerCamp';
const DEFAULT_BUILDER_PATH = '/build.html';
const DEFAULT_REPLY_TO = 'eric.simmerman@ourdeercamp.com';
const ICON_FILENAME = 'deercamp-icon.png';
const ICON_CONTENT_ID = 'deercamp-icon.png';

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getBaseUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
}

function getBuilderPath() {
  const configuredPath = normalizeValue(process.env.WELCOME_BUILDER_PATH || DEFAULT_BUILDER_PATH);
  if (!configuredPath) return DEFAULT_BUILDER_PATH;
  return configuredPath.startsWith('/') ? configuredPath : `/${configuredPath}`;
}

function appendIfPresent(url, key, value) {
  const clean = normalizeValue(value);
  if (clean) {
    url.searchParams.set(key, clean);
  }
}

function buildStewardSetupLink(payload = {}) {
  const baseUrl = getBaseUrl();
  const builderUrl = new URL(getBuilderPath(), `${baseUrl}/`);

  appendIfPresent(builderUrl, 'campName', payload.campName);
  appendIfPresent(builderUrl, 'campCity', payload.campCity || payload.city);
  appendIfPresent(builderUrl, 'campState', payload.campState || payload.state);
  appendIfPresent(builderUrl, 'campZip', payload.campZip || payload.zip);
  appendIfPresent(builderUrl, 'campYear', payload.campYear || payload.established);

  appendIfPresent(
    builderUrl,
    'campSteward',
    payload.campSteward ||
      payload.stewardName ||
      [payload.stewardFirstName, payload.stewardLastName].map(normalizeValue).filter(Boolean).join(' ')
  );
  appendIfPresent(builderUrl, 'campStewardEmail', payload.campStewardEmail || payload.stewardEmail || payload.email || payload.to);
  appendIfPresent(builderUrl, 'campMembers', payload.campMembers);
  appendIfPresent(builderUrl, 'campTraditionsCustom', payload.campTraditionsCustom);
  appendIfPresent(builderUrl, 'campDeerDrives', payload.campDeerDrives);
  appendIfPresent(builderUrl, 'heroTemplate', payload.heroTemplate);

  return builderUrl.toString();
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

  const htmlTemplate = await readUtf8(htmlPath);
  const textTemplate = await readUtf8(textPath);

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
  const explicitName = normalizeValue(payload.campSteward || payload.stewardName);
  if (explicitName) return explicitName;

  const first = normalizeValue(payload.stewardFirstName);
  const last = normalizeValue(payload.stewardLastName);
  const fullName = [first, last].filter(Boolean).join(' ').trim();
  return fullName || 'Steward';
}

function getRecipientEmail(payload = {}) {
  const email = normalizeValue(
    payload.campStewardEmail || payload.stewardEmail || payload.email || payload.to
  );
  if (!email) {
    throw new Error('Missing campStewardEmail or stewardEmail in request payload.');
  }
  return email;
}

function injectGreeting(html, text, recipientName) {
  const greetingHtml = `<p style="margin:0 0 16px 0;">Hi ${htmlEscape(recipientName)},</p>`;
  const greetingText = `Hi ${recipientName},\n\n`;

  const htmlNeedle = '<p style="margin:0 0 16px 0;">Thank you for signing up and building with DeerCamp.</p>';
  const textNeedle = 'Thank you for signing up and building with DeerCamp.\n\n';

  return {
    html: html.includes(htmlNeedle) ? html.replace(htmlNeedle, `${greetingHtml}${htmlNeedle}`) : `${greetingHtml}${html}`,
    text: text.includes(textNeedle) ? text.replace(textNeedle, `${greetingText}${textNeedle}`) : `${greetingText}${text}`,
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

  const attachments = [];
  if (iconBase64) {
    attachments.push({
      filename: ICON_FILENAME,
      content: iconBase64,
      content_type: 'image/png',
      content_id: ICON_CONTENT_ID,
    });
  }

  return {
    to: recipientEmail,
    subject,
    from: process.env.WELCOME_FROM || DEFAULT_FROM,
    html: withGreeting.html,
    text: withGreeting.text,
    replyTo: process.env.WELCOME_REPLY_TO || DEFAULT_REPLY_TO,
    attachments,
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
  composeStewardWelcomeEmail,
  sendViaResend,
};
