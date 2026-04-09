const fs = require('fs/promises');
const path = require('path');

const DEFAULT_SITE_URL = 'https://www.ourdeercamp.com';
const DEFAULT_FROM = 'DeerCamp <welcome@ourdeercamp.com>';
const DEFAULT_SUBJECT = 'You’re invited to join DeerCamp';
const DEFAULT_MEMBER_SETUP_PATH = '/member-setup.html';
const DEFAULT_REPLY_TO = 'welcome@ourdeercamp.com';
const ICON_FILENAME = 'deercamp-icon.png';
const ICON_CONTENT_ID = 'deercamp-icon.png';

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getNestedValue(source, pathValue) {
  if (!source || !pathValue) return '';
  const parts = String(pathValue).split('.');
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


function getCampCity(payload = {}) {
  return firstNonEmpty(
    payload.campCity,
    payload.city,
    getNestedValue(payload, 'camp.city'),
    getNestedValue(payload, 'campData.city')
  );
}

function getCampState(payload = {}) {
  return firstNonEmpty(
    payload.campState,
    payload.state,
    getNestedValue(payload, 'camp.state'),
    getNestedValue(payload, 'campData.state')
  );
}

function getCampZip(payload = {}) {
  return firstNonEmpty(
    payload.campZip,
    payload.zip,
    getNestedValue(payload, 'camp.zip'),
    getNestedValue(payload, 'campData.zip')
  );
}

function getCampEstablished(payload = {}) {
  return firstNonEmpty(
    payload.campEstablished,
    payload.established,
    getNestedValue(payload, 'camp.established'),
    getNestedValue(payload, 'campData.established')
  );
}

function getCampHero(payload = {}) {
  return firstNonEmpty(
    payload.campHero,
    payload.hero,
    getNestedValue(payload, 'camp.hero'),
    getNestedValue(payload, 'campData.hero'),
    getNestedValue(payload, 'campData.brandImage'),
    getNestedValue(payload, 'campData.brandingImage')
  );
}

function slugifyCampId(value = '') {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function deriveCampIdFromPayload(payload = {}) {
  const explicitCampId = firstNonEmpty(
    payload.campId,
    getNestedValue(payload, 'camp.campId'),
    getNestedValue(payload, 'campData.campId')
  );
  if (explicitCampId) return explicitCampId;

  const parts = [
    getCampName(payload),
    getCampCity(payload),
    getCampState(payload),
    getCampZip(payload),
  ].map(normalizeValue).filter(Boolean);

  return slugifyCampId(parts.join('-'));
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

function getMemberFirstName(payload = {}) {
  return firstNonEmpty(
    payload.memberFirstName,
    normalizeValue(payload.memberName).split(/\s+/).filter(Boolean)[0],
    normalizeValue(getNestedValue(payload, 'member.firstName')),
    normalizeValue(getNestedValue(payload, 'member.name')).split(/\s+/).filter(Boolean)[0],
    'Camp Member'
  );
}

function getMemberName(payload = {}) {
  return firstNonEmpty(
    payload.memberName,
    getNestedValue(payload, 'member.name'),
    [payload.memberFirstName, payload.memberLastName].map(normalizeValue).filter(Boolean).join(' ')
  ) || 'Camp Member';
}

function getMemberEmail(payload = {}) {
  const email = firstNonEmpty(
    payload.memberEmail,
    getNestedValue(payload, 'member.email'),
    payload.email,
    payload.to
  );
  if (!email) {
    throw new Error('Missing memberEmail in request payload.');
  }
  return email;
}

function getStewardName(payload = {}) {
  return firstNonEmpty(
    payload.stewardName,
    payload.campSteward,
    getNestedValue(payload, 'steward.name'),
    getNestedValue(payload, 'camp.stewardName'),
    getNestedValue(payload, 'campData.stewardName'),
    [payload.stewardFirstName, payload.stewardLastName].map(normalizeValue).filter(Boolean).join(' ')
  ) || 'Your Camp Steward';
}

function getInviteToken(payload = {}) {
  return firstNonEmpty(
    payload.inviteToken,
    payload.memberInviteToken,
    getNestedValue(payload, 'member.inviteToken')
  );
}

function getFallbackLinkLabel(payload = {}) {
  const campName = getCampName(payload);
  return campName ? `Join ${campName}` : 'Open DeerCamp invitation';
}

function buildMemberInviteLink(payload = {}) {
  const baseUrl = getBaseUrl();
  const memberPath = getNormalizedPath(
    payload.memberSetupPath || payload.setupPath || process.env.MEMBER_SETUP_PATH,
    DEFAULT_MEMBER_SETUP_PATH
  );
  const memberUrl = new URL(memberPath, `${baseUrl}/`);

  appendIfPresent(memberUrl, 'campId', deriveCampIdFromPayload(payload));
  appendIfPresent(memberUrl, 'campName', getCampName(payload));
  appendIfPresent(memberUrl, 'campCity', getCampCity(payload));
  appendIfPresent(memberUrl, 'campState', getCampState(payload));
  appendIfPresent(memberUrl, 'campZip', getCampZip(payload));
  appendIfPresent(memberUrl, 'campEstablished', getCampEstablished(payload));
  appendIfPresent(memberUrl, 'campHero', getCampHero(payload));
  appendIfPresent(memberUrl, 'memberName', getMemberName(payload));
  appendIfPresent(memberUrl, 'memberEmail', getMemberEmail(payload));
  appendIfPresent(memberUrl, 'inviteToken', getInviteToken(payload));
  appendIfPresent(memberUrl, 'stewardName', getStewardName(payload));

  return memberUrl.toString();
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

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
                  <a href="{{invite_link}}" style="display:inline-block; background:#2f5d3a; color:#ffffff; text-decoration:none; padding:14px 22px; border-radius:10px; font-weight:700;">{{cta_label}}</a>
                </p>
                <p style="margin:0 0 16px 0;">{{fallback_copy}}</p>
                <p style="margin:0 0 24px 0;"><a href="{{fallback_link}}" style="color:#2f5d3a; font-weight:700; text-decoration:underline;">{{fallback_link_label}}</a></p>
                <p style="margin:0 0 16px 0;">We’re glad to have you in camp.</p>
                <p style="margin:0 0 18px 0;">
                  <a href="https://ourdeercamp.com" style="display:inline-block; background:#ffffff; color:#2f5d3a; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700; border:1px solid #2f5d3a;">Share DeerCamp</a>
                </p>
                <p style="margin:0;">— Eric Simmerman, Founder</p>
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
{{invite_link}}

{{fallback_copy}}
{{fallback_link_label}}
{{fallback_link}}

We’re glad to have you in camp.

Share DeerCamp:
https://ourdeercamp.com

— Eric Simmerman, Founder

Sent from welcome@ourdeercamp.com
{{footer_label}}
`;
}

async function loadMemberTemplates() {
  const templateDir = path.join(process.cwd(), 'email-assets', 'member-welcome');
  const htmlPath = path.join(templateDir, 'deercamp-member-welcome-email.html');
  const textPath = path.join(templateDir, 'deercamp-member-welcome-email.txt');
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

function injectGreeting(html, text, memberFirstName) {
  const greetingHtml = `<p style="margin:0 0 16px 0;">Hi ${htmlEscape(memberFirstName)},</p>`;
  const greetingText = `Hi ${memberFirstName},

`;

  return {
    html: html.replace('{{greeting_block}}', greetingHtml),
    text: text.replace('{{greeting_text}}', greetingText)
  };
}

function buildMemberEmailCopy(payload = {}) {
  const campName = getCampName(payload);
  const stewardName = getStewardName(payload);

  return {
    headline: campName ? `${campName} DeerCamp Invitation` : 'Welcome to DeerCamp',
    introLine: `${stewardName} invited you to join ${campName || 'a DeerCamp'} on DeerCamp.`,
    detailLine: 'DeerCamp is where your camp can keep members, memories, camp details, traditions, recipes, and season plans together in one place.',
    ctaLabel: campName ? `Join ${campName}` : 'Join DeerCamp',
    fallbackCopy: `This invitation is for joining ${campName || 'your DeerCamp'}. Once you join, you’ll be able to view camp updates and contribute where the Steward has enabled member participation.`,
    footerLabel: 'DeerCamp Member Invitation',
    subject: campName ? `You’re invited to join ${campName} on DeerCamp` : DEFAULT_SUBJECT
  };
}

async function composeMemberWelcomeEmail(payload = {}) {
  const inviteLink = buildMemberInviteLink(payload);
  const fallbackLink = inviteLink;
  const memberFirstName = getMemberFirstName(payload);
  const recipientEmail = getMemberEmail(payload);
  const { htmlTemplate, textTemplate, iconBase64 } = await loadMemberTemplates();
  const copy = buildMemberEmailCopy(payload);
  const fallbackLinkLabel = getFallbackLinkLabel(payload);

  const replacements = {
    '{{headline}}': copy.headline,
    '{{intro_line}}': copy.introLine,
    '{{detail_line}}': copy.detailLine,
    '{{cta_label}}': copy.ctaLabel,
    '{{fallback_copy}}': copy.fallbackCopy,
    '{{invite_link}}': inviteLink,
    '{{fallback_link}}': fallbackLink,
    '{{fallback_link_label}}': fallbackLinkLabel,
    '{{footer_label}}': copy.footerLabel,
    '{{greeting_block}}': '{{greeting_block}}',
    '{{greeting_text}}': '{{greeting_text}}'
  };

  const renderedHtml = renderTemplate(htmlTemplate, replacements);
  const renderedText = renderTemplate(textTemplate, replacements);
  const withGreeting = injectGreeting(renderedHtml, renderedText, memberFirstName);

  const attachments = [];
  let finalHtml = withGreeting.html;
  if (iconBase64) {
    attachments.push({
      filename: ICON_FILENAME,
      content: iconBase64,
      content_type: 'image/png',
      content_id: ICON_CONTENT_ID,
      content_disposition: 'inline',
    });
  } else {
    const fallbackIconUrl = `${getBaseUrl()}/assets/images/deer-track.png`;
    finalHtml = finalHtml.split(`cid:${ICON_CONTENT_ID}`).join(fallbackIconUrl);
  }

  return {
    to: recipientEmail,
    subject: copy.subject,
    from: process.env.WELCOME_FROM || DEFAULT_FROM,
    html: finalHtml,
    text: withGreeting.text,
    replyTo: process.env.WELCOME_REPLY_TO || DEFAULT_REPLY_TO,
    attachments,
    tags: [
      { name: 'flow', value: 'member-invite' },
      { name: 'environment', value: process.env.VERCEL_ENV || 'local' },
    ],
    inviteLink,
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
  buildMemberInviteLink,
  composeMemberWelcomeEmail,
  sendViaResend,
};
