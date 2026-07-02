const { sendViaResend } = require("../lib/steward-welcome-email");

const DEFAULT_FROM = "DeerCamp <welcome@ourdeercamp.com>";
const DEFAULT_REPLY_TO = "welcome@ourdeercamp.com";

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

function composeTripPrepEmail(payload, to) {
  const campName = clean(payload.campName) || "DeerCamp";
  const tripName = clean(payload.tripName) || "Trip Prep";
  const hunterName = clean(payload.hunterName) || "Hunter";

  const subject = `DeerCamp Trip Prep — ${tripName}`;

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
