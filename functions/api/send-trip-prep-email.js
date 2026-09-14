const { sendViaResend } = require("../lib/steward-welcome-email");

const DEFAULT_FROM = "DeerCamp <welcome@ourdeercamp.com>";
const DEFAULT_REPLY_TO = "welcome@ourdeercamp.com";

function getPublicSiteUrl(payload = {}) {
  return String(payload.publicSiteUrl || process.env.PUBLIC_SITE_URL || "https://www.ourdeercamp.com").replace(/\/$/, "");
}

function getTripPrepWoodUrl(payload = {}) {
  return `${getPublicSiteUrl(payload)}/email-assets/trip-prep/wood-trip-prep-header.jpg`;
}

function getTripPrepIconUrl(payload = {}) {
  return `${getPublicSiteUrl(payload)}/email-assets/trip-prep/deercamp-hoof-icon.png`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function uniqueEmails(values) {
  const seen = new Set();
  return asArray(values)
    .map(clean)
    .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    .filter(value => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function rows(items, emptyLabel) {
  const list = asArray(items).filter(Boolean);
  if (!list.length) return `<p style="margin:0;color:#6a6157;">${htmlEscape(emptyLabel)}</p>`;

  return `
    <ul style="margin:0;padding-left:20px;line-height:1.7;">
      ${list.map(item => `<li>${htmlEscape(typeof item === "string" ? item : item.label || item.name || JSON.stringify(item))}</li>`).join("")}
    </ul>
  `;
}

function textRows(items, emptyLabel) {
  const list = asArray(items).filter(Boolean);
  if (!list.length) return emptyLabel;
  return list.map(item => `- ${typeof item === "string" ? item : item.label || item.name || JSON.stringify(item)}`).join("\n");
}

function section(title, body) {
  return `
    <tr>
      <td style="padding:16px 24px;border-top:1px solid #eadfce;">
        <h2 style="margin:0 0 8px 0;font-size:18px;line-height:1.25;color:#452a16;">${htmlEscape(title)}</h2>
        <div style="font-size:15px;line-height:1.6;color:#3b342c;">${body}</div>
      </td>
    </tr>
  `;
}

function normalizeTextLine(line) {
  return String(line || "").replace(/\s+/g, " ").trim();
}

function linkifyValue(label, value) {
  const cleanLabel = htmlEscape(label);
  const cleanValue = clean(value);
  if (/^https?:\/\//i.test(cleanValue)) {
    return `<a href="${htmlEscape(cleanValue)}" style="color:#2f5d3a;text-decoration:underline;text-underline-offset:2px;">${cleanLabel}</a>`;
  }
  return `<strong style="color:#452a16;">${cleanLabel}:</strong> ${htmlEscape(cleanValue)}`;
}

function splitTripPrepSections(bodyText) {
  const lines = String(bodyText || "").replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let current = null;

  function pushCurrent() {
    if (current) {
      current.lines = current.lines
        .map(line => String(line || "").trim())
        .filter(Boolean)
        .filter(line => !/^Sent from DeerCamp CampResources Trip Prep Center\.?$/i.test(line));
      sections.push(current);
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || "").trim();
    const next = String(lines[i + 1] || "").trim();
    if (line && /^(={3,}|-{3,})$/.test(next)) {
      pushCurrent();
      current = { title: line, underline: next.charAt(0), lines: [] };
      i += 1;
      continue;
    }
    if (!current) current = { title: "Trip Details", underline: "=", lines: [] };
    current.lines.push(line);
  }
  pushCurrent();
  return sections.filter(section => section.title && section.title !== "Sent from DeerCamp CampResources Trip Prep Center.");
}

function renderTextCardLines(lines) {
  const out = [];
  let bulletBuffer = [];

  function flushBullets() {
    if (!bulletBuffer.length) return;
    out.push(`<ul style="margin:8px 0 12px 22px;padding:0;line-height:1.55;">${bulletBuffer.map(item => `<li style="margin:0 0 5px 0;">${htmlEscape(item)}</li>`).join("")}</ul>`);
    bulletBuffer = [];
  }

  (lines || []).forEach(rawLine => {
    const line = normalizeTextLine(rawLine);
    if (!line) {
      flushBullets();
      return;
    }

    if (/^-+\s+/.test(line)) {
      bulletBuffer.push(line.replace(/^-+\s+/, ""));
      return;
    }

    flushBullets();

    const keyValue = line.match(/^([^:]{2,42}):\s*(.+)$/);
    if (keyValue) {
      const label = keyValue[1];
      const value = keyValue[2];
      if (/^(Website|Directions)$/i.test(label) && /^https?:\/\//i.test(value)) {
        out.push(`<p style="margin:0 0 8px 0;">${linkifyValue(label, value)}</p>`);
      } else {
        out.push(`<p style="margin:0 0 8px 0;"><strong style="color:#452a16;">${htmlEscape(label)}:</strong> ${htmlEscape(value)}</p>`);
      }
      return;
    }

    out.push(`<p style="margin:0 0 8px 0;">${htmlEscape(line)}</p>`);
  });

  flushBullets();

  return out.join("") || `<p style="margin:0;color:#6a6157;">No details included.</p>`;
}


function hasProviderStopSections(bodyText) {
  const sections = splitTripPrepSections(bodyText);
  const providerStartIndex = sections.findIndex(section => /Suggested Stops|Resource Pack/i.test(section.title));
  return providerStartIndex >= 0 && sections.some((section, index) => index > providerStartIndex && section.lines && section.lines.length);
}

function removeAssignedStaplesFromAssignmentLines(lines, assignedStaples) {
  const assignedKeys = new Set(
    asArray(assignedStaples)
      .map(normalizeTextLine)
      .filter(Boolean)
      .map(value => value.toLowerCase())
  );

  if (!assignedKeys.size) return lines || [];

  const output = [];
  let inStaplesBlock = false;
  let staplesHeaderIndex = -1;
  let keptStaplesLines = 0;

  (lines || []).forEach(rawLine => {
    const line = normalizeTextLine(rawLine);

    if (/^Camp Staples\s*\/\s*Resources:?$/i.test(line)) {
      inStaplesBlock = true;
      staplesHeaderIndex = output.length;
      keptStaplesLines = 0;
      output.push(rawLine);
      return;
    }

    if (inStaplesBlock && /^[A-Za-z][A-Za-z\s/]+:?$/.test(line) && !/^-/.test(line)) {
      if (keptStaplesLines === 0 && staplesHeaderIndex >= 0) {
        output.splice(staplesHeaderIndex, 1);
      }
      inStaplesBlock = false;
      staplesHeaderIndex = -1;
      keptStaplesLines = 0;
      output.push(rawLine);
      return;
    }

    if (inStaplesBlock && /^-\s+/.test(line)) {
      const item = normalizeTextLine(line.replace(/^-\s+/, ""));
      if (assignedKeys.has(item.toLowerCase())) {
        return;
      }
      keptStaplesLines += 1;
      output.push(rawLine);
      return;
    }

    output.push(rawLine);
  });

  if (inStaplesBlock && keptStaplesLines === 0 && staplesHeaderIndex >= 0) {
    output.splice(staplesHeaderIndex, 1);
  }

  return output;
}

function renderPremiumTripPrepSections(bodyText, tripName, payload = {}) {
  const sections = splitTripPrepSections(bodyText);
  const providerStartIndex = sections.findIndex(section => /Suggested Stops|Resource Pack/i.test(section.title));
  const assignedStaples = asArray(payload.assignedStaples || payload.staples)
    .map(item => typeof item === "string" ? item : item && (item.text || [item.name, item.qty || item.quantity || item.amount].filter(Boolean).join(" - ")))
    .map(normalizeTextLine)
    .filter(Boolean);
  const assignedStaplesCard = assignedStaples.length ? `
      <tr>
        <td style="padding:0 28px 16px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e3d5bd;border-radius:16px;background:#fffaf2;overflow:hidden;">
            <tr>
              <td style="padding:16px 18px 14px 18px;border-left:5px solid #452a16;">
                <div style="margin:0 0 5px 0;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a6a3e;">Assigned Camp Staples</div>
                <h2 style="margin:0 0 10px 0;font-size:20px;line-height:1.25;color:#452a16;">Staples / Resources Assigned to Hunter</h2>
                <ul style="margin:8px 0 0 22px;padding:0;line-height:1.55;">
                  ${assignedStaples.map(item => `<li style="margin:0 0 5px 0;">${htmlEscape(item)}</li>`).join("")}
                </ul>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    ` : "";

  return assignedStaplesCard + sections.map((section, index) => {
    let title = section.title;
    let label = "Trip Prep";

    if (index === 0 && title === tripName) {
      title = "Trip Details";
      label = "Mission";
    } else if (/Your Assignments/i.test(title)) {
      label = "Hunter Assignments";
    } else if (/Suggested Stops|Resource Pack/i.test(title)) {
      label = "Resource Pack";
    } else if (providerStartIndex >= 0 && index > providerStartIndex) {
      label = "Suggested Stop";
    }

    const isProviderMarker = /Suggested Stops|Resource Pack/i.test(title);
    const isProvider = providerStartIndex >= 0 && index > providerStartIndex;
    if (isProviderMarker) {
      return "";
    }
    const accent = isProvider ? "#2f5d3a" : "#452a16";
    const renderLines = /Your Assignments/i.test(section.title)
      ? removeAssignedStaplesFromAssignmentLines(section.lines, assignedStaples)
      : section.lines;
    const body = renderTextCardLines(renderLines);

    return `
      <tr>
        <td style="padding:0 28px 16px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e3d5bd;border-radius:16px;background:#fffaf2;overflow:hidden;">
            <tr>
              <td style="padding:16px 18px 14px 18px;border-left:5px solid ${accent};">
                <div style="margin:0 0 5px 0;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a6a3e;">${htmlEscape(label)}</div>
                <h2 style="margin:0 0 10px 0;font-size:20px;line-height:1.25;color:#452a16;">${htmlEscape(title)}</h2>
                <div style="font-size:15px;line-height:1.58;color:#3b342c;">${body}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join("");
}

function composeTripPrepEmail(payload, to) {
  const campName = clean(payload.campName) || "DeerCamp";
  const tripName = clean(payload.tripName) || "Trip Prep";
  const hunterName = clean(payload.hunterName) || "Hunter";

  const subject = clean(payload.subject) || `DeerCamp Trip Prep - ${tripName}`;
  const bodyText = clean(payload.bodyText || payload.textBody || payload.text);

  if (bodyText) {
    const woodUrl = getTripPrepWoodUrl(payload);
    const iconUrl = getTripPrepIconUrl(payload);
    const premiumSections = renderPremiumTripPrepSections(bodyText, tripName, payload);
    const providerIntro = hasProviderStopSections(bodyText)
      ? "Your DeerCamp mission pack: meals, assigned camp staples, steward notes, and route-based provider stops in one place."
      : "Your DeerCamp mission pack: meals, assigned camp staples, and steward notes in one place.";
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${htmlEscape(subject)}</title></head>
<body style="margin:0;padding:0;background:#efe7d8;font-family:Arial,Helvetica,sans-serif;color:#2f2a24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#efe7d8;margin:0;padding:24px 0;">
    <tr><td align="center" style="padding:0 12px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #d8c8ae;box-shadow:0 12px 32px rgba(69,42,22,.12);">
        <tr>
          <td background="${woodUrl}" style="padding:0;background:#452a16 url('${woodUrl}') center/cover no-repeat;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding:24px 28px 26px 28px;background:rgba(69,42,22,.78);color:#fff8ef;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="width:64px;vertical-align:top;padding-right:16px;">
                        <img src="${iconUrl}" alt="DeerCamp" width="56" height="56" style="display:block;border:2px solid rgba(255,248,239,.80);border-radius:50%;background:#fff8ef;">
                      </td>
                      <td style="vertical-align:middle;">
                        <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffe1a0;">${htmlEscape(campName || "DeerCamp")}</div>
                        <h1 style="margin:8px 0 6px 0;font-size:32px;line-height:1.10;color:#fff8ef;">${htmlEscape(tripName)}</h1>
                        <div style="font-size:17px;line-height:1.45;color:#f7e8d0;">Trip Prep for ${htmlEscape(hunterName)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px 8px 28px;background:#fbf7ef;color:#5b3d1e;">
            <p style="margin:0;font-size:15px;line-height:1.55;">${htmlEscape(providerIntro)}</p>
          </td>
        </tr>
        ${premiumSections}
        <tr>
          <td background="${woodUrl}" align="center" style="padding:24px 30px 26px 30px;background:#452a16 url('${woodUrl}') center/cover no-repeat;border-top:1px solid #eadfce;">
            <div style="font-size:13px;line-height:1.7;color:#fff8ef;text-align:center;text-shadow:0 2px 6px rgba(0,0,0,.35);">
              Sent from <a href="mailto:welcome@ourdeercamp.com" style="color:#ffe1a0;text-decoration:none;font-weight:800;">welcome@ourdeercamp.com</a><br>
              <span style="color:#fff8ef;font-weight:700;">DeerCamp CampResources Trip Prep Center</span>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    return {
      to,
      from: process.env.WELCOME_FROM || DEFAULT_FROM,
      replyTo: process.env.WELCOME_REPLY_TO || DEFAULT_REPLY_TO,
      subject,
      html,
      text: bodyText,
      attachments: [],
      tags: [
        { name: "flow", value: "campresources-trip-prep" },
        { name: "environment", value: process.env.VERCEL_ENV || "firebase" },
      ],
    };
  }

  const meals = payload.meals || {};
  const mealRows = [
    meals.breakfast ? `Breakfast: ${meals.breakfast}` : "",
    meals.lunch ? `Lunch: ${meals.lunch}` : "",
    meals.dinner ? `Dinner: ${meals.dinner}` : "",
  ].filter(Boolean);

  const staples = asArray(payload.staples).map(item => {
    if (typeof item === "string") return item;
    const name = clean(item.name);
    const qty = clean(item.quantity || item.qty || item.amount);
    return [name, qty].filter(Boolean).join(" - ");
  }).filter(Boolean);

  const notes = [
    clean(payload.hunterNotes) ? `Hunter notes: ${clean(payload.hunterNotes)}` : "",
    clean(payload.stewardNotes) ? `Steward notes: ${clean(payload.stewardNotes)}` : "",
  ].filter(Boolean);

  const strategy = [
    clean(payload.shoppingStrategy) ? `Shopping strategy: ${clean(payload.shoppingStrategy)}` : "",
    clean(payload.startZip) ? `Start ZIP: ${clean(payload.startZip)}` : "",
    clean(payload.endZip) ? `Camp / End ZIP: ${clean(payload.endZip)}` : "",
    clean(payload.routeCorridor) ? `Route corridor: ${clean(payload.routeCorridor)}` : "",
  ].filter(Boolean);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${htmlEscape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;color:#2f2a24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e8;margin:0;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:28px 24px 18px 24px;background:#452a16;color:#fff8ef;">
            <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ffe1a0;">${htmlEscape(campName)}</div>
            <h1 style="margin:8px 0 6px 0;font-size:28px;line-height:1.15;">${htmlEscape(tripName)}</h1>
            <div style="font-size:16px;line-height:1.5;">Trip Prep for ${htmlEscape(hunterName)}</div>
          </td>
        </tr>
        ${section("Trip Details", rows(strategy, "No shopping strategy details included."))}
        ${section("Meals", rows(mealRows, "No meals selected yet."))}
        ${section("Assigned Staples", rows(staples, "No staples assigned yet."))}
        ${section("Hunter / Steward Notes", rows(notes, "No notes included."))}
        ${section("Provider Options", `<p style="margin:0;">DeerCamp will include the top provider options by category as this resource layer is connected. Hunters can use those suggestions or choose their preferred provider.</p>`)}
        <tr>
          <td style="padding:18px 24px 26px 24px;font-size:13px;line-height:1.6;color:#6a6157;">
            Sent from <a href="mailto:welcome@ourdeercamp.com" style="color:#2f5d3a;text-decoration:none;">welcome@ourdeercamp.com</a><br>
            DeerCamp Trip Prep Email
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `${campName}`,
    `${tripName}`,
    `Trip Prep for ${hunterName}`,
    "",
    "Trip Details:",
    textRows(strategy, "No shopping strategy details included."),
    "",
    "Meals:",
    textRows(mealRows, "No meals selected yet."),
    "",
    "Assigned Staples:",
    textRows(staples, "No staples assigned yet."),
    "",
    "Hunter / Steward Notes:",
    textRows(notes, "No notes included."),
    "",
    "Provider Options:",
    "DeerCamp will include the top provider options by category as this resource layer is connected. Hunters can use those suggestions or choose their preferred provider.",
    "",
    "Sent from welcome@ourdeercamp.com",
    "DeerCamp Trip Prep Email",
  ].join("\n");

  return {
    to,
    from: process.env.WELCOME_FROM || DEFAULT_FROM,
    replyTo: process.env.WELCOME_REPLY_TO || DEFAULT_REPLY_TO,
    subject,
    html,
    text,
    attachments: [],
    tags: [
      { name: "flow", value: "campresources-trip-prep" },
      { name: "environment", value: process.env.VERCEL_ENV || "firebase" },
    ],
  };
}

module.exports = async function sendTripPrepEmailHandler(req, res) {
  res.set("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const payload = req.body || {};
    const recipients = uniqueEmails(payload.to || payload.recipients || payload.emails);

    if (!recipients.length) {
      return res.status(400).json({ ok: false, error: "No valid email recipients supplied." });
    }

    const results = [];
    for (const to of recipients) {
      const result = await sendViaResend(composeTripPrepEmail(payload, to));
      results.push({ to, id: result && result.id ? String(result.id) : "" });
    }

    return res.status(200).json({ ok: true, sent: results.length, results });
  } catch (error) {
    console.error("sendTripPrepEmail failed", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};



