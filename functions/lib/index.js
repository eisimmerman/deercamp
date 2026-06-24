"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createBillingPortalSession = exports.createCheckoutSession = exports.sendStewardWelcome = exports.pollSeasonOpeners = exports.transcribeCampStory = exports.enrichPublishedMemory = void 0;
const node_fs_1 = require("node:fs");
const node_fs_2 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const firestore_2 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const openai_1 = __importDefault(require("openai"));
const stripe_1 = __importDefault(require("stripe"));
const sendStewardWelcomeHandler = require("../api/send-steward-welcome");
const { sendViaResend } = require("./steward-welcome-email");
(0, app_1.initializeApp)();
const OPENAI_API_KEY = (0, params_1.defineSecret)("OPENAI_API_KEY");
const STRIPE_SECRET_KEY = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
const ADMIN_NOTIFICATION_EMAIL = (0, params_1.defineSecret)("ADMIN_NOTIFICATION_EMAIL");
const db = (0, firestore_1.getFirestore)();
const bucket = (0, storage_1.getStorage)().bucket();

const DEFAULT_SEASON_OPENERS_URL = "https://www.ourdeercamp.com/data/us-state-deer-openers.json";
function normalizeSeasonState(value) {
    return String(value || "").trim().toUpperCase();
}
function normalizeSeasonType(value) {
    const clean = String(value || "").trim().toLowerCase();
    if (["gun", "guns", "rifle", "firearms", "firearm"].includes(clean))
        return "firearm";
    if (["blackpowder", "black powder", "black-powder", "muzzle loader", "muzzle-loader", "muzzleloader"].includes(clean))
        return "muzzleloader";
    if (["bow", "archery", "crossbow"].includes(clean))
        return "archery";
    return clean || "season";
}
function getSeasonYear(dateValue) {
    const match = String(dateValue || "").match(/^(\d{4})-/);
    return match ? match[1] : String(new Date().getFullYear());
}
function defaultSeasonIcon(type) {
    if (type === "archery")
        return "🏹";
    if (type === "muzzleloader")
        return "💥";
    if (type === "firearm")
        return "🔫";
    return "🦌";
}
function normalizeSeasonRecords(payload) {
    const records = [];
    const statesNode = payload && payload.states && typeof payload.states === "object"
        ? payload.states
        : payload;
    if (!statesNode || typeof statesNode !== "object")
        return records;
    Object.entries(statesNode).forEach(([stateKey, stateValue]) => {
        const state = normalizeSeasonState(stateKey);
        if (!state || !stateValue || typeof stateValue !== "object")
            return;
        const stateData = stateValue;
        if (Array.isArray(stateData.seasons)) {
            stateData.seasons.forEach((season) => {
                const date = String((season && (season.date || season.opener)) || "").trim();
                if (!date)
                    return;
                const type = normalizeSeasonType(season.type || season.name || season.label);
                const year = getSeasonYear(date);
                records.push({
                    state,
                    year,
                    type,
                    date,
                    title: String(season.title || season.label || `${state} ${type} deer opener`).trim(),
                    description: String(season.description || season.scopeNote || "Verified statewide deer season opener.").trim(),
                    icon: String(season.icon || defaultSeasonIcon(type)).trim(),
                    source: String(stateData.source || season.source || "").trim(),
                    sourceUrl: String(stateData.sourceUrl || season.sourceUrl || "").trim(),
                    scopeNote: String(season.scopeNote || "").trim(),
                    verified: true,
                });
            });
            return;
        }
        Object.entries(stateData).forEach(([yearKey, yearValue]) => {
            if (!yearValue || typeof yearValue !== "object")
                return;
            const seasons = yearValue.seasons || {};
            Object.entries(seasons).forEach(([typeKey, season]) => {
                const date = String((season && (season.opener || season.date)) || "").trim();
                if (!date)
                    return;
                const type = normalizeSeasonType(typeKey);
                records.push({
                    state,
                    year: String(yearKey || getSeasonYear(date)),
                    type,
                    date,
                    title: String(season.title || season.label || `${state} ${type} deer opener`).trim(),
                    description: String(season.description || "Verified statewide deer season opener.").trim(),
                    icon: String(season.icon || defaultSeasonIcon(type)).trim(),
                    source: String(yearValue.source || season.source || "").trim(),
                    sourceUrl: String(yearValue.sourceUrl || season.sourceUrl || "").trim(),
                    scopeNote: String(season.scopeNote || "").trim(),
                    verified: true,
                });
            });
        });
    });
    return records;
}
function buildSeasonCalendarEvent(record) {
    const id = `season-opener-${record.year}-${record.state.toLowerCase()}-${record.type}`;
    return {
        id,
        title: record.title,
        name: record.title,
        date: record.date,
        type: "season-opener",
        seasonType: record.type,
        state: record.state,
        icon: record.icon || defaultSeasonIcon(record.type),
        description: record.description || "Verified statewide deer season opener.",
        source: record.source || "Official state wildlife agency season data",
        sourceUrl: record.sourceUrl || "",
        scopeNote: record.scopeNote || "",
        status: "Active",
        verified: true,
        autoGenerated: true,
    };
}
function shouldAddSeasonEvent(existingEvents, record) {
    const targetId = `season-opener-${record.year}-${record.state.toLowerCase()}-${record.type}`;
    return !existingEvents.some((event) => {
        const eventId = String(event && event.id || "");
        const eventDate = String(event && event.date || "");
        const eventType = normalizeSeasonType(event && (event.seasonType || event.type));
        const eventState = normalizeSeasonState(event && event.state);
        if (eventId === targetId)
            return true;
        return eventDate === record.date && eventType === record.type && (!eventState || eventState === record.state);
    });
}
async function backfillCampsWithSeasonOpeners(records) {
    if (!records.length)
        return { scanned: 0, updated: 0, addedEvents: 0 };
    const recordsByState = records.reduce((acc, record) => {
        if (!acc[record.state])
            acc[record.state] = [];
        acc[record.state].push(record);
        return acc;
    }, {});
    const campsSnap = await db.collection("camps").get();
    let updated = 0;
    let addedEvents = 0;
    const commits = [];
    let batch = db.batch();
    let writeCount = 0;
    campsSnap.docs.forEach((doc) => {
        const camp = doc.data() || {};
        const state = normalizeSeasonState(camp.state || camp.campState || (camp.camp && camp.camp.state));
        if (!state || !recordsByState[state])
            return;
        const existingEvents = Array.isArray(camp.calendarEvents) ? camp.calendarEvents : [];
        const additions = recordsByState[state]
            .filter((record) => shouldAddSeasonEvent(existingEvents, record))
            .map(buildSeasonCalendarEvent);
        if (!additions.length)
            return;
        const nextEvents = existingEvents.concat(additions).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.title || a.name || "").localeCompare(String(b.title || b.name || "")));
        batch.set(doc.ref, {
            calendarEvents: nextEvents,
            calendarMeta: Object.assign({}, camp.calendarMeta || {}, {
                seasonOpenersBackfilledAtClient: new Date().toISOString(),
                seasonOpenersSource: "scheduled-poll",
            }),
            updatedAtClient: new Date().toISOString(),
        }, { merge: true });
        updated += 1;
        addedEvents += additions.length;
        writeCount += 1;
        if (writeCount >= 450) {
            commits.push(batch.commit());
            batch = db.batch();
            writeCount = 0;
        }
    });
    if (writeCount)
        commits.push(batch.commit());
    await Promise.all(commits);
    return { scanned: campsSnap.size, updated, addedEvents };
}
async function storeSeasonOpeners(records, sourceUrl) {
    if (!records.length)
        return { written: 0 };
    const metaRef = db.collection("systemStats").doc("seasonOpeners");
    let batch = db.batch();
    let writeCount = 0;
    const commits = [];
    records.forEach((record) => {
        const docId = `${record.state}_${record.year}_${record.type}`;
        batch.set(db.collection("seasonOpeners").doc(docId), Object.assign({}, record, {
            id: docId,
            sourceUrl: record.sourceUrl || sourceUrl,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAtClient: new Date().toISOString(),
        }), { merge: true });
        writeCount += 1;
        if (writeCount >= 450) {
            commits.push(batch.commit());
            batch = db.batch();
            writeCount = 0;
        }
    });
    batch.set(metaRef, {
        lastPollAt: firestore_1.FieldValue.serverTimestamp(),
        lastPollAtClient: new Date().toISOString(),
        lastSourceUrl: sourceUrl,
        recordCount: records.length,
    }, { merge: true });
    writeCount += 1;
    if (writeCount)
        commits.push(batch.commit());
    await Promise.all(commits);
    return { written: records.length };
}
exports.pollSeasonOpeners = (0, scheduler_1.onSchedule)({
    region: "us-central1",
    schedule: "0 7 1,15 * *",
    timeZone: "America/Chicago",
    timeoutSeconds: 300,
    memory: "512MiB",
}, async () => {
    const sourceUrl = String(process.env.SEASON_OPENERS_URL || DEFAULT_SEASON_OPENERS_URL).trim();
    firebase_functions_1.logger.info("Polling DeerCamp season opener data.", { sourceUrl });
    const response = await fetch(sourceUrl, { headers: { "accept": "application/json" } });
    if (!response.ok) {
        throw new Error(`Season opener source returned ${response.status}.`);
    }
    const payload = await response.json();
    const records = normalizeSeasonRecords(payload);
    if (!records.length) {
        firebase_functions_1.logger.warn("Season opener poll returned zero verified records.", { sourceUrl });
        await db.collection("systemStats").doc("seasonOpeners").set({
            lastPollAt: firestore_1.FieldValue.serverTimestamp(),
            lastPollAtClient: new Date().toISOString(),
            lastSourceUrl: sourceUrl,
            recordCount: 0,
            warning: "No verified records found.",
        }, { merge: true });
        return;
    }
    const stored = await storeSeasonOpeners(records, sourceUrl);
    const backfilled = await backfillCampsWithSeasonOpeners(records);
    firebase_functions_1.logger.info("Season opener polling complete.", Object.assign({ sourceUrl, recordCount: records.length }, stored, backfilled));
});


const DC_PLUS_MONTHLY_PRICE_ID = "price_1TRsjcDOIUbMFzLxNCO58x3n";
const DC_PLUS_ANNUAL_PRICE_ID = "price_1TRsjcDOIUbMFzLxmw4bEOuM";
const DC_PLUS_PRICE_IDS = new Set([DC_PLUS_MONTHLY_PRICE_ID, DC_PLUS_ANNUAL_PRICE_ID]);
async function recordAdminSubscriptionNotification({ eventId, campId, campName, priceId }) {
    if (!eventId)
        throw new Error("Missing Stripe event id for subscription notification.");
    if (!DC_PLUS_PRICE_IDS.has(priceId))
        return { skipped: true, reason: "Non-DC+ price id." };
    const statsRef = db.collection("systemStats").doc("subscriptions");
    const eventRef = statsRef.collection("processedEvents").doc(eventId);
    const isAnnual = priceId === DC_PLUS_ANNUAL_PRICE_ID;
    const planLabel = isAnnual ? "Annual ($79)" : "Monthly ($9.99)";
    const totals = await db.runTransaction(async (transaction) => {
        const existingEvent = await transaction.get(eventRef);
        const statsSnap = await transaction.get(statsRef);
        const current = statsSnap.exists ? statsSnap.data() || {} : {};
        if (existingEvent.exists) {
            return Object.assign({}, current, { alreadyProcessed: true });
        }
        const next = {
            dcPlusTotal: Number(current.dcPlusTotal || 0) + 1,
            dcPlusMonthly999: Number(current.dcPlusMonthly999 || 0) + (isAnnual ? 0 : 1),
            dcPlusAnnual79: Number(current.dcPlusAnnual79 || 0) + (isAnnual ? 1 : 0),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAtClient: new Date().toISOString(),
        };
        transaction.set(statsRef, next, { merge: true });
        transaction.set(eventRef, {
            eventId,
            campId,
            campName,
            priceId,
            planLabel,
            processedAt: firestore_1.FieldValue.serverTimestamp(),
            processedAtClient: new Date().toISOString(),
        });
        return next;
    });
    if (totals.alreadyProcessed) {
        return { skipped: true, reason: "Stripe event already processed.", totals };
    }
    const subject = `New DC+ Subscription — Total DC+: ${totals.dcPlusTotal || 0}`;
    const text = `New DC+ subscription received.\n\nCamp:\n${campName || campId}\n\nCamp ID:\n${campId}\n\nPlan:\n${planLabel}\n\nRunning Totals:\nTotal DC+: ${totals.dcPlusTotal || 0}\nMonthly $9.99: ${totals.dcPlusMonthly999 || 0}\nAnnual $79: ${totals.dcPlusAnnual79 || 0}\n\nTime:\n${new Date().toISOString()}\n`;
    await sendViaResend({
        to: ADMIN_NOTIFICATION_EMAIL.value(),
        from: process.env.WELCOME_FROM || "DeerCamp <welcome@ourdeercamp.com>",
        subject,
        text,
        html: `<pre style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;line-height:1.5;">${htmlEscape(text)}</pre>`,
        replyTo: process.env.WELCOME_REPLY_TO || "welcome@ourdeercamp.com",
        attachments: [],
        tags: [
            { name: "flow", value: "dc-plus-admin-subscription-notification" },
            { name: "environment", value: process.env.VERCEL_ENV || "firebase" },
        ],
    });
    return { skipped: false, totals };
}
const GSS_PRODUCT_NAME_MATCH = "guided steward setup";
const GSS_PAYMENT_LINK_IDS = new Set([
    "plink_1Td9lJRcr1GduppUYBDqpQbE",
    "plink_1Td7MFRcr1GduppUKYqu7ycU",
]);
const GSS_ADMIN_NOTIFICATION_EMAIL = "subscriptions@ourdeercamp.com";
function normalizeProductName(value) {
    return String(value || "").trim().toLowerCase();
}
function getSessionCustomerEmail(session) {
    return firstNonEmptyValue(
        session.customer_details && session.customer_details.email,
        session.customer_email,
        session.customer && session.customer.email
    );
}
function getSessionCustomerName(session) {
    return firstNonEmptyValue(
        session.customer_details && session.customer_details.name,
        session.customer && session.customer.name,
        "Steward"
    );
}
function getSessionCustomerPhone(session) {
    return firstNonEmptyValue(
        session.customer_details && session.customer_details.phone,
        session.phone_number_collection && session.phone_number_collection.phone
    );
}
async function getCheckoutLineItemSummary(stripe, sessionId) {
    const lineItems = await stripe.checkout.sessions.listLineItems(String(sessionId || ""), {
        limit: 10,
        expand: ["data.price.product"],
    });
    return lineItems.data.map((item) => {
        const price = item.price || {};
        const product = price.product && typeof price.product === "object" ? price.product : {};
        return {
            description: String(item.description || product.name || "").trim(),
            productName: String(product.name || item.description || "").trim(),
            productId: String(product.id || "").trim(),
            priceId: String(price.id || "").trim(),
            quantity: Number(item.quantity || 0),
            amountTotal: Number(item.amount_total || 0),
            currency: String(item.currency || price.currency || "usd").trim().toUpperCase(),
        };
    });
}
function isGssCheckoutSession(session, lineItems = []) {
    const metadata = session.metadata || {};
    const mode = String(session.mode || "").toLowerCase();
    const paymentLinkId = normalizeStripeId(session.payment_link);
    const metadataText = [metadata.product, metadata.service, metadata.sku, metadata.tier, metadata.flow, metadata.offer, metadata.name]
        .map(normalizeProductName)
        .join(" ");
    const lineText = lineItems.map((item) => normalizeProductName(`${item.productName} ${item.description}`)).join(" ");
    return mode === "payment" && (GSS_PAYMENT_LINK_IDS.has(paymentLinkId) || metadataText.includes("gss") || metadataText.includes(GSS_PRODUCT_NAME_MATCH) || lineText.includes(GSS_PRODUCT_NAME_MATCH));
}
function formatDollarsFromCents(cents, currency = "USD") {
    const amount = Number(cents || 0) / 100;
    return `${amount.toLocaleString("en-US", { style: "currency", currency: currency || "USD" })}`;
}
function getStewardDashboardLink(campId) {
    const cleanCampId = String(campId || "").trim();
    if (!cleanCampId)
        return "https://www.ourdeercamp.com/build.html";
    return `https://www.ourdeercamp.com/steward-dashboard.html?campId=${encodeURIComponent(cleanCampId)}&role=steward&view=steward`;
}
async function recordGssPurchase({ eventId, session, lineItems }) {
    if (!eventId)
        throw new Error("Missing Stripe event id for GSS purchase.");
    const campId = String((session.metadata && session.metadata.campId) || session.client_reference_id || "").trim();
    const stewardEmail = getSessionCustomerEmail(session);
    const stewardName = getSessionCustomerName(session);
    const phone = getSessionCustomerPhone(session);
    const paymentIntentId = normalizeStripeId(session.payment_intent);
    const customerId = normalizeStripeId(session.customer);
    const amountTotal = Number(session.amount_total || lineItems.reduce((sum, item) => sum + Number(item.amountTotal || 0), 0));
    const currency = String(session.currency || (lineItems[0] && lineItems[0].currency) || "USD").toUpperCase();
    const purchaseRef = db.collection("gssPurchases").doc(String(session.id || eventId));
    const eventRef = db.collection("systemStats").doc("gss").collection("processedEvents").doc(eventId);
    const statsRef = db.collection("systemStats").doc("gss");
    const purchasePayload = {
        eventId,
        checkoutSessionId: String(session.id || ""),
        paymentIntentId,
        stripeCustomerId: customerId,
        campId,
        stewardName,
        stewardEmail,
        phone,
        amountTotal,
        currency,
        lineItems,
        status: "needs_scheduling",
        includesDcPlusYear: true,
        purchased: true,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        createdAtClient: new Date().toISOString(),
    };
    const totals = await db.runTransaction(async (transaction) => {
        const existingEvent = await transaction.get(eventRef);
        const statsSnap = await transaction.get(statsRef);
        const current = statsSnap.exists ? statsSnap.data() || {} : {};
        if (existingEvent.exists) {
            return Object.assign({}, current, { alreadyProcessed: true });
        }
        const next = {
            gssTotal: Number(current.gssTotal || 0) + 1,
            gssRevenueCents: Number(current.gssRevenueCents || 0) + amountTotal,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAtClient: new Date().toISOString(),
        };
        transaction.set(statsRef, next, { merge: true });
        transaction.set(eventRef, { eventId, checkoutSessionId: String(session.id || ""), processedAt: firestore_1.FieldValue.serverTimestamp(), processedAtClient: new Date().toISOString() });
        transaction.set(purchaseRef, purchasePayload, { merge: true });
        if (campId) {
            transaction.set(db.collection("camps").doc(campId), {
                gss: {
                    purchased: true,
                    status: "needs_scheduling",
                    purchasedAt: firestore_1.FieldValue.serverTimestamp(),
                    purchasedAtClient: new Date().toISOString(),
                    checkoutSessionId: String(session.id || ""),
                    paymentIntentId,
                    stripeCustomerId: customerId,
                    stewardEmail,
                    phone,
                    includesDcPlusYear: true,
                },
                tier: "dc_plus",
                billingStatus: "gss_includes_dc_plus_year",
                updatedAtClient: new Date().toISOString(),
            }, { merge: true });
        }
        return next;
    });
    return { campId, stewardEmail, stewardName, phone, amountTotal, currency, paymentIntentId, customerId, totals };
}
function composeGssStewardEmail({ campId, stewardName, stewardEmail }) {
    if (!stewardEmail)
        throw new Error("Missing Steward email for GSS welcome email.");
    const dashboardLink = getStewardDashboardLink(campId);
    const subject = "Your Guided Steward Setup is ready";
    const safeName = stewardName || "Steward";
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${htmlEscape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;color:#2f2a24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e8;margin:0;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 12px 32px;text-align:left;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <img src="https://ourdeercamp.com/email-assets/steward-welcome/deercamp-icon.png" alt="DeerCamp" width="40" height="40" style="display:inline-block;vertical-align:middle;border:0;" />
            <div style="font-size:24px;line-height:1.2;font-weight:700;color:#1f1a15;">Your Guided Steward Setup is ready</div>
          </div>
          <div style="font-size:15px;line-height:1.7;color:#3b342c;">
            <p style="margin:0 0 16px 0;">Hi ${htmlEscape(safeName)},</p>
            <p style="margin:0 0 16px 0;">Thank you for purchasing Guided Steward Setup. We’ll help you configure your DeerCamp, review your setup, assist with member invites, and answer questions so your camp is ready to launch with confidence.</p>
            <p style="margin:0 0 16px 0;"><strong>Your first year of DeerCamp Plus (DC+) is included.</strong></p>
            <p style="margin:0 0 16px 0;">Please reply to this email with your camp name, best phone number, and a few good times to connect. We’ll use that to schedule your setup help.</p>
            <p style="margin:0 0 24px 0;"><a href="${htmlEscape(dashboardLink)}" style="display:inline-block;background:#2f5d3a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700;">Continue Building Your DeerCamp</a></p>
            <p style="margin:0 0 16px 0;">Need help sooner? Email <a href="mailto:support@ourdeercamp.com" style="color:#2f5d3a;font-weight:700;text-decoration:underline;">support@ourdeercamp.com</a>.</p>
            <p style="margin:0 0 0 0;">— Eric Simmerman, Founder</p>
          </div>
        </td></tr>
        <tr><td style="padding:8px 32px 32px 32px;font-size:13px;line-height:1.6;color:#6a6157;">Sent from <a href="mailto:welcome@ourdeercamp.com" style="color:#2f5d3a;text-decoration:none;">welcome@ourdeercamp.com</a><br />Guided Steward Setup Email</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    const text = `Hi ${safeName},\n\nThank you for purchasing Guided Steward Setup. We’ll help you configure your DeerCamp, review your setup, assist with member invites, and answer questions so your camp is ready to launch with confidence.\n\nYour first year of DeerCamp Plus (DC+) is included.\n\nPlease reply to this email with your camp name, best phone number, and a few good times to connect. We’ll use that to schedule your setup help.\n\nContinue Building Your DeerCamp:\n${dashboardLink}\n\nNeed help sooner? Email support@ourdeercamp.com.\n\n— Eric Simmerman, Founder\n`;
    return {
        to: stewardEmail,
        subject,
        from: process.env.WELCOME_FROM || "DeerCamp <welcome@ourdeercamp.com>",
        html,
        text,
        replyTo: process.env.WELCOME_REPLY_TO || "welcome@ourdeercamp.com",
        attachments: [],
        tags: [
            { name: "flow", value: "gss-steward-welcome" },
            { name: "environment", value: process.env.VERCEL_ENV || "firebase" },
        ],
    };
}
function composeGssAdminEmail({ campId, stewardName, stewardEmail, phone, amountTotal, currency, paymentIntentId, customerId, totals }) {
    const subject = `New GSS Purchase — Includes First Year DC+`;
    const dashboardLink = getStewardDashboardLink(campId);
    const text = `New Guided Steward Setup purchase received.\n\nIncludes first year of DC+.\n\nSteward:\n${stewardName || ""}\n\nEmail:\n${stewardEmail || ""}\n\nPhone:\n${phone || ""}\n\nCamp ID:\n${campId || "Not provided by Stripe Payment Link"}\n\nDashboard / Builder Link:\n${dashboardLink}\n\nStripe Customer ID:\n${customerId || ""}\n\nPayment Intent ID:\n${paymentIntentId || ""}\n\nAmount:\n${formatDollarsFromCents(amountTotal, currency)}\n\nRunning Totals:\nTotal GSS: ${totals && totals.gssTotal ? totals.gssTotal : 0}\nGSS Revenue: ${formatDollarsFromCents(totals && totals.gssRevenueCents ? totals.gssRevenueCents : 0, currency)}\n\nTime:\n${new Date().toISOString()}\n`;
    return {
        to: GSS_ADMIN_NOTIFICATION_EMAIL,
        from: process.env.WELCOME_FROM || "DeerCamp <welcome@ourdeercamp.com>",
        subject,
        text,
        html: `<pre style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;line-height:1.5;">${htmlEscape(text)}</pre>`,
        replyTo: process.env.WELCOME_REPLY_TO || "welcome@ourdeercamp.com",
        attachments: [],
        tags: [
            { name: "flow", value: "gss-admin-purchase-notification" },
            { name: "environment", value: process.env.VERCEL_ENV || "firebase" },
        ],
    };
}
async function handleGssCheckoutCompleted({ stripe, event, session }) {
    const lineItems = await getCheckoutLineItemSummary(stripe, session.id);
    if (!isGssCheckoutSession(session, lineItems)) {
        return { skipped: true, reason: "Not a GSS checkout session." };
    }
    const purchase = await recordGssPurchase({ eventId: String(event.id || ""), session, lineItems });
    await sendViaResend(composeGssAdminEmail(purchase));
    if (purchase.stewardEmail) {
        await sendViaResend(composeGssStewardEmail(purchase));
    }
    else {
        firebase_functions_1.logger.warn("GSS purchase did not include a customer email; steward email skipped.", { eventId: String(event.id || ""), sessionId: String(session.id || "") });
    }
    return { skipped: false, purchase };
}

function getRequestOrigin(req) {
    const origin = String(req.headers.origin || "").trim();
    if (origin)
        return origin;
    const host = String(req.headers.host || "www.ourdeercamp.com").trim();
    return host.includes("localhost") ? `http://${host}` : `https://${host}`;
}
function getStripe() {
    return new stripe_1.default(STRIPE_SECRET_KEY.value());
}
function sendJson(res, status, payload) {
    res.status(status).json(payload);
}
function normalizeStripeId(value) {
    if (!value)
        return "";
    if (typeof value === "string")
        return value;
    return String(value.id || "");
}
function getSubscriptionPeriodEnd(subscription) {
    const periodEnd = Number(subscription.current_period_end || 0);
    return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}
function subscriptionBillingPayload(subscription, extra = {}) {
    const status = String(subscription.status || "").toLowerCase();
    const isActive = ["active", "trialing"].includes(status);
    const firstItem = subscription.items && subscription.items.data && subscription.items.data[0] ? subscription.items.data[0] : null;
    const priceId = firstItem && firstItem.price ? String(firstItem.price.id || "") : "";
    return Object.assign({
        tier: isActive ? "dc_plus" : "dcf",
        status: status || "unknown",
        stripeCustomerId: normalizeStripeId(subscription.customer),
        stripeSubscriptionId: String(subscription.id || ""),
        priceId,
        currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        cancelAt: subscription.cancel_at ? new Date(Number(subscription.cancel_at) * 1000).toISOString() : null,
        canceledAt: subscription.canceled_at ? new Date(Number(subscription.canceled_at) * 1000).toISOString() : null,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAtClient: new Date().toISOString(),
    }, extra);
}
async function findCampIdForSubscription(subscription) {
    const metadataCampId = String((subscription.metadata && subscription.metadata.campId) || "").trim();
    if (metadataCampId)
        return metadataCampId;
    const subscriptionId = String(subscription.id || "").trim();
    if (!subscriptionId)
        return "";
    const snap = await db.collection("camps").where("billing.stripeSubscriptionId", "==", subscriptionId).limit(1).get();
    if (!snap.empty)
        return snap.docs[0].id;
    return "";
}
async function writeCampBilling(campId, billing) {
    const cleanCampId = String(campId || "").trim();
    if (!cleanCampId)
        throw new Error("Missing campId for billing update.");
    await db.collection("camps").doc(cleanCampId).set({
        billing,
        tier: billing.tier,
        billingStatus: billing.status,
        updatedAtClient: new Date().toISOString(),
    }, { merge: true });
}
async function getCampForBillingEmail(campId) {
    const cleanCampId = String(campId || "").trim();
    if (!cleanCampId)
        return { ref: null, data: {} };
    const ref = db.collection("camps").doc(cleanCampId);
    const snap = await ref.get();
    return { ref, data: snap.exists ? snap.data() || {} : {} };
}
function firstNonEmptyValue(...values) {
    for (const value of values) {
        const clean = String(value || "").trim();
        if (clean)
            return clean;
    }
    return "";
}
function getPublicCampLink(campId) {
    return `https://www.ourdeercamp.com/camp.html?campId=${encodeURIComponent(String(campId || ""))}`;
}
function formatPaidThroughDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime()))
        return "the end of your current billing period";
    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Chicago",
    });
}
function htmlEscape(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function composeDcPlusCancellationEmail({ campId, camp, billing }) {
    const campName = firstNonEmptyValue(camp.name, camp.campName, campId, "your DeerCamp");
    const stewardName = firstNonEmptyValue(camp.stewardName, camp.steward, camp.campSteward, "Steward");
    const to = firstNonEmptyValue(camp.stewardEmail, camp.campStewardEmail, camp.email, camp.billing && camp.billing.customerEmail);
    if (!to)
        throw new Error("Missing Steward email for DC+ cancellation email.");
    const paidThrough = formatPaidThroughDate(billing.currentPeriodEnd);
    const campLink = getPublicCampLink(campId);
    const subject = `Your DeerCamp Plus cancellation is scheduled — ${campName}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${htmlEscape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;color:#2f2a24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e8;margin:0;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 32px 12px 32px;text-align:left;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <img src="https://ourdeercamp.com/email-assets/steward-welcome/deercamp-icon.png" alt="DeerCamp" width="40" height="40" style="display:inline-block;vertical-align:middle;border:0;" />
            <div style="font-size:24px;line-height:1.2;font-weight:700;color:#1f1a15;">Your DC+ cancellation is scheduled</div>
          </div>
          <div style="font-size:15px;line-height:1.7;color:#3b342c;">
            <p style="margin:0 0 16px 0;">Hi ${htmlEscape(stewardName)},</p>
            <p style="margin:0 0 16px 0;">Your DeerCamp Plus membership for <strong>${htmlEscape(campName)}</strong> is scheduled to end on <strong>${htmlEscape(paidThrough)}</strong>.</p>
            <p style="margin:0 0 16px 0;">Your DC+ access remains active until then, including Scout Elite, Stand Builder, Drive Builder, and Manage Billing.</p>
            <p style="margin:0 0 24px 0;"><a href="${htmlEscape(campLink)}" style="display:inline-block;background:#2f5d3a;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700;">Return to DeerCamp</a></p>
            <p style="margin:0 0 16px 0;">You can manage or reactivate your membership from the billing button in your camp while access remains active.</p>
            <p style="margin:0 0 0 0;">— The DeerCamp Team</p>
          </div>
        </td></tr>
        <tr><td style="padding:8px 32px 32px 32px;font-size:13px;line-height:1.6;color:#6a6157;">Sent from <a href="mailto:welcome@ourdeercamp.com" style="color:#2f5d3a;text-decoration:none;">welcome@ourdeercamp.com</a><br />DeerCamp Plus Billing Email</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    const text = `Hi ${stewardName},\n\nYour DeerCamp Plus membership for ${campName} is scheduled to end on ${paidThrough}.\n\nYour DC+ access remains active until then, including Scout Elite, Stand Builder, Drive Builder, and Manage Billing.\n\nReturn to DeerCamp:\n${campLink}\n\nYou can manage or reactivate your membership from the billing button in your camp while access remains active.\n\n— The DeerCamp Team\n\nSent from welcome@ourdeercamp.com\nDeerCamp Plus Billing Email\n`;
    return {
        to,
        subject,
        from: process.env.WELCOME_FROM || "DeerCamp <welcome@ourdeercamp.com>",
        html,
        text,
        replyTo: process.env.WELCOME_REPLY_TO || "welcome@ourdeercamp.com",
        attachments: [],
        tags: [
            { name: "flow", value: "dc-plus-cancellation" },
            { name: "environment", value: process.env.VERCEL_ENV || "firebase" },
        ],
    };
}
async function maybeSendDcPlusCancellationEmail(campId, subscription, billing) {
    if (!Boolean(subscription.cancel_at_period_end))
        return {};
    const { ref, data: camp } = await getCampForBillingEmail(campId);
    const previousBilling = camp && camp.billing && typeof camp.billing === "object" ? camp.billing : {};
    if (previousBilling.cancelEmailSentAt) {
        return { cancelEmailSentAt: previousBilling.cancelEmailSentAt };
    }
    try {
        const emailPayload = composeDcPlusCancellationEmail({ campId, camp, billing });
        const result = await sendViaResend(emailPayload);
        const sentAt = new Date().toISOString();
        return {
            cancelEmailSentAt: sentAt,
            cancelEmailStatus: "sent",
            cancelEmailRecipient: emailPayload.to,
            cancelEmailResendId: result && result.id ? String(result.id) : "",
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        firebase_functions_1.logger.error("Could not send DC+ cancellation email.", { campId, error: message });
        if (ref) {
            await ref.set({
                billing: {
                    cancelEmailStatus: "failed",
                    cancelEmailError: message,
                    cancelEmailFailedAt: new Date().toISOString(),
                },
                updatedAtClient: new Date().toISOString(),
            }, { merge: true });
        }
        return {
            cancelEmailStatus: "failed",
            cancelEmailError: message,
            cancelEmailFailedAt: new Date().toISOString(),
        };
    }
}
exports.createCheckoutSession = (0, https_1.onRequest)({
    region: "us-central1",
    cors: true,
    secrets: [STRIPE_SECRET_KEY],
}, async (req, res) => {
    if (req.method !== "POST") {
        res.set("Allow", "POST");
        return sendJson(res, 405, { error: "Method not allowed." });
    }
    try {
        const body = req.body || {};
        const campId = String(body.campId || "").trim();
        const priceId = String(body.priceId || "").trim();
        if (!campId)
            return sendJson(res, 400, { error: "Missing campId." });
        if (!DC_PLUS_PRICE_IDS.has(priceId))
            return sendJson(res, 400, { error: "Invalid DC+ priceId." });
        const campRef = db.collection("camps").doc(campId);
        const campSnap = await campRef.get();
        const camp = campSnap.exists ? campSnap.data() || {} : {};
        const billing = camp.billing && typeof camp.billing === "object" ? camp.billing : {};
        const stripe = getStripe();
        let customerId = String(billing.stripeCustomerId || "").trim();
        const stewardEmail = String(body.email || camp.stewardEmail || camp.email || "").trim();
        const campName = String(camp.name || camp.campName || campId).trim();
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: stewardEmail || undefined,
                name: campName || undefined,
                metadata: { campId, app: "DeerCamp" },
            });
            customerId = customer.id;
            await campRef.set({
                billing: Object.assign({}, billing, {
                    tier: billing.tier || "dcf",
                    status: billing.status || "free",
                    stripeCustomerId: customerId,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAtClient: new Date().toISOString(),
                }),
            }, { merge: true });
        }
        const origin = getRequestOrigin(req);
        const successUrl = String(body.successUrl || `${origin}/camp.html?campId=${encodeURIComponent(campId)}&checkout=success&session_id={CHECKOUT_SESSION_ID}`).trim();
        const cancelUrl = String(body.cancelUrl || `${origin}/camp.html?campId=${encodeURIComponent(campId)}&checkout=cancelled`).trim();
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            client_reference_id: campId,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: { campId, app: "DeerCamp", tier: "dc_plus" },
            subscription_data: { metadata: { campId, app: "DeerCamp", tier: "dc_plus" } },
        });
        return sendJson(res, 200, { url: session.url, id: session.id });
    }
    catch (error) {
        firebase_functions_1.logger.error("Could not create Stripe Checkout session.", { error: error instanceof Error ? error.message : String(error) });
        return sendJson(res, 500, { error: "Could not create Stripe Checkout session." });
    }
});
exports.createBillingPortalSession = (0, https_1.onRequest)({
    region: "us-central1",
    cors: true,
    secrets: [STRIPE_SECRET_KEY],
}, async (req, res) => {
    if (req.method !== "POST") {
        res.set("Allow", "POST");
        return sendJson(res, 405, { error: "Method not allowed." });
    }
    try {
        const body = req.body || {};
        const campId = String(body.campId || "").trim();
        if (!campId)
            return sendJson(res, 400, { error: "Missing campId." });
        const campSnap = await db.collection("camps").doc(campId).get();
        const camp = campSnap.exists ? campSnap.data() || {} : {};
        const customerId = String((camp.billing && camp.billing.stripeCustomerId) || "").trim();
        if (!customerId)
            return sendJson(res, 400, { error: "No Stripe customer found for this camp yet." });
        const origin = getRequestOrigin(req);
        const returnUrl = String(body.returnUrl || `${origin}/camp.html?campId=${encodeURIComponent(campId)}&billing=returned`).trim();
        const stripe = getStripe();
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });
        return sendJson(res, 200, { url: session.url, id: session.id });
    }
    catch (error) {
        firebase_functions_1.logger.error("Could not create Stripe Billing Portal session.", { error: error instanceof Error ? error.message : String(error) });
        return sendJson(res, 500, { error: "Could not create Stripe Billing Portal session." });
    }
});
exports.stripeWebhook = (0, https_1.onRequest)({
    region: "us-central1",
    cors: false,
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_NOTIFICATION_EMAIL, "RESEND_API_KEY"],
}, async (req, res) => {
    if (req.method !== "POST") {
        res.set("Allow", "POST");
        return res.status(405).send("Method not allowed.");
    }
    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
    }
    catch (error) {
        firebase_functions_1.logger.warn("Stripe webhook signature verification failed.", { error: error instanceof Error ? error.message : String(error) });
        return res.status(400).send("Webhook signature verification failed.");
    }
    if (!event.livemode) {
        firebase_functions_1.logger.info("Ignoring non-live Stripe event.", {
            eventId: String(event.id || ""),
            type: event.type,
        });
        return res.status(200).send("Ignored test event.");
    }
    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const campId = String((session.metadata && session.metadata.campId) || session.client_reference_id || "").trim();
            const subscriptionId = normalizeStripeId(session.subscription);
            const customerId = normalizeStripeId(session.customer);
            try {
                await handleGssCheckoutCompleted({ stripe, event, session });
            }
            catch (gssError) {
                firebase_functions_1.logger.error("GSS checkout handling failed.", {
                    error: gssError instanceof Error ? gssError.message : String(gssError),
                    eventId: String(event.id || ""),
                    sessionId: String(session.id || ""),
                });
            }
            if (campId && subscriptionId) {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                await writeCampBilling(campId, subscriptionBillingPayload(subscription, {
                    stripeCustomerId: customerId || normalizeStripeId(subscription.customer),
                    lastCheckoutSessionId: String(session.id || ""),
                }));
                const lineItems = await stripe.checkout.sessions.listLineItems(String(session.id || ""), { limit: 1 });
                const firstLine = lineItems.data[0];
                const priceId = firstLine && firstLine.price ? String(firstLine.price.id || "") : "";
                if (DC_PLUS_PRICE_IDS.has(priceId)) {
                    const campSnap = await db.collection("camps").doc(campId).get();
                    const camp = campSnap.exists ? campSnap.data() || {} : {};
                    try {
                        await recordAdminSubscriptionNotification({
                            eventId: String(event.id || ""),
                            campId,
                            campName: String(camp.name || camp.campName || campId),
                            priceId,
                        });
                    }
                    catch (notificationError) {
                        firebase_functions_1.logger.error("Admin subscription notification failed.", {
                            error: notificationError instanceof Error ? notificationError.message : String(notificationError),
                            campId,
                            eventId: String(event.id || ""),
                        });
                    }
                }
            }
        }
        if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
            const subscription = event.data.object;
            const campId = await findCampIdForSubscription(subscription);
            if (campId) {
                const billing = subscriptionBillingPayload(subscription);
                const emailFields = event.type === "customer.subscription.updated"
                    ? await maybeSendDcPlusCancellationEmail(campId, subscription, billing)
                    : {};
                await writeCampBilling(campId, Object.assign({}, billing, emailFields));
            }
        }
        if (["invoice.payment_failed", "invoice.payment_succeeded"].includes(event.type)) {
            const invoice = event.data.object;
            const subscriptionId = normalizeStripeId(invoice.subscription);
            if (subscriptionId) {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                const campId = await findCampIdForSubscription(subscription);
                if (campId) {
                    await writeCampBilling(campId, subscriptionBillingPayload(subscription, {
                        lastInvoiceStatus: String(invoice.status || ""),
                        lastInvoiceEvent: event.type,
                    }));
                }
            }
        }
        return res.status(200).send("ok");
    }
    catch (error) {
        firebase_functions_1.logger.error("Stripe webhook handling failed.", { type: event.type, error: error instanceof Error ? error.message : String(error) });
        return res.status(500).send("Webhook handler failed.");
    }
});
exports.sendStewardWelcome = (0, https_1.onRequest)({
    region: "us-central1",
    cors: true,
    secrets: ["RESEND_API_KEY"],
}, sendStewardWelcomeHandler);

function clampWords(value, maxWords) {
    return String(value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, maxWords)
        .join(" ");
}
function cleanSpaces(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}
function makeTranscriptPreview(value, maxLength = 180) {
    const clean = cleanSpaces(value);
    if (!clean)
        return "";
    if (clean.length <= maxLength)
        return clean;
    return `${clean.slice(0, maxLength - 1).trim()}…`;
}
function extractFirebaseStoragePathFromUrl(value) {
    const raw = String(value || "").trim();
    if (!raw)
        return "";
    try {
        const marker = "/o/";
        const markerIndex = raw.indexOf(marker);
        if (markerIndex < 0)
            return "";
        const afterMarker = raw.slice(markerIndex + marker.length);
        const encodedPath = (afterMarker.split("?")[0] || "").split("#")[0] || "";
        return decodeURIComponent(encodedPath).trim();
    }
    catch (error) {
        return "";
    }
}
function safeGeneratedTitle(value, fallback) {
    const cleaned = cleanSpaces(value)
        .replace(/^[-–—:;,]+/, "")
        .replace(/[.!?]+$/g, "");
    const limited = clampWords(cleaned, 6).slice(0, 64).trim();
    return limited || fallback;
}
function safeGeneratedCaption(value, fallback) {
    const cleaned = cleanSpaces(value).slice(0, 180).trim();
    return cleaned || fallback;
}
async function transcribeAudio(openai, localAudioPath) {
    const transcript = await openai.audio.transcriptions.create({
        file: (0, node_fs_1.createReadStream)(localAudioPath),
        model: "gpt-4o-mini-transcribe",
        response_format: "json",
    });
    return cleanSpaces(transcript.text || "");
}
async function generateTitleAndCaption(openai, transcript, fallbackTitle, fallbackCaption) {
    const response = await openai.responses.create({
        model: "gpt-4o-mini",
        input: [
            {
                role: "system",
                content: [
                    {
                        type: "input_text",
                        text: "You write short hunting-memory metadata for DeerCamp posts. Return strict JSON with keys title and caption. " +
                            "Title rules: 3 to 6 words, plain spoken, no quotes, no hashtags, no emojis, no ending punctuation. " +
                            "Caption rules: 1 sentence, 8 to 18 words, grounded only in the transcript, no invented details. " +
                            "Ignore filler words, ums, dead air, and microphone noise. If the transcript is too weak, return the supplied fallbacks unchanged.",
                    },
                ],
            },
            {
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: JSON.stringify({
                            transcript,
                            fallbackTitle,
                            fallbackCaption,
                        }),
                    },
                ],
            },
        ],
    });
    const raw = cleanSpaces(response.output_text || "");
    if (!raw) {
        return {
            title: fallbackTitle,
            caption: fallbackCaption,
        };
    }
    try {
        const parsed = JSON.parse(raw);
        return {
            title: safeGeneratedTitle(parsed.title || "", fallbackTitle),
            caption: safeGeneratedCaption(parsed.caption || "", fallbackCaption),
        };
    }
    catch (error) {
        firebase_functions_1.logger.warn("Could not parse generated metadata JSON; using fallbacks.", {
            raw,
            error: error instanceof Error ? error.message : String(error),
        });
        return {
            title: fallbackTitle,
            caption: fallbackCaption,
        };
    }
}
exports.enrichPublishedMemory = (0, firestore_2.onDocumentCreated)({
    document: "feedItems/{feedDocId}",
    region: "us-central1",
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const feedDocId = event.params.feedDocId;
    const data = snapshot.data();
    if (String(data.source || "") !== "app") {
        return;
    }
    if (String(data.transcriptionStatus || "pending") !== "pending") {
        return;
    }
    const audioPath = String(data.audioPath || data.voicePath || "").trim() ||
        extractFirebaseStoragePathFromUrl(data.audioUrl || data.voiceUrl);
    const currentTitle = String(data.title || "Field Memory").trim() || "Field Memory";
    const currentCaption = String(data.caption || "Captured in DeerCamp Field Mode.").trim() ||
        "Captured in DeerCamp Field Mode.";
    if (!audioPath) {
        await snapshot.ref.update({
            transcriptionStatus: "failed",
            transcriptionError: "Missing audio storage path for cloud transcription.",
            aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return;
    }
    const tmpDir = await node_fs_2.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "deercamp-audio-"));
    const ext = node_path_1.default.extname(audioPath) || ".m4a";
    const localAudioPath = node_path_1.default.join(tmpDir, `memory${ext}`);
    try {
        await bucket.file(audioPath).download({ destination: localAudioPath });
        const openai = new openai_1.default({ apiKey: OPENAI_API_KEY.value() });
        const transcript = await transcribeAudio(openai, localAudioPath);
        if (!transcript) {
            await snapshot.ref.update({
                transcriptionStatus: "failed",
                transcriptionError: "No usable speech detected.",
                transcript: "",
                transcriptPreview: "",
                aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return;
        }
        const generated = await generateTitleAndCaption(openai, transcript, currentTitle, currentCaption);
        const titleSource = String(data.titleSource || "fallback") === "manual" ? "manual" : "generated";
        const captionSource = String(data.captionSource || "fallback") === "manual" ? "manual" : "generated";
        await snapshot.ref.update({
            title: titleSource === "manual" ? currentTitle : generated.title,
            caption: captionSource === "manual" ? currentCaption : generated.caption,
            generatedTitle: generated.title,
            generatedCaption: generated.caption,
            titleSource,
            captionSource,
            transcript,
            transcriptPreview: makeTranscriptPreview(transcript),
            transcriptionStatus: "complete",
            transcriptionError: "",
            aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await db.collection("feedItems").doc(feedDocId).collection("ai").doc("metadata").set({
            transcript,
            generatedTitle: generated.title,
            generatedCaption: generated.caption,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (error) {
        firebase_functions_1.logger.error("Cloud title generation failed.", {
            feedDocId,
            error: error instanceof Error ? error.message : String(error),
        });
        await snapshot.ref.update({
            transcriptionStatus: "failed",
            transcriptionError: error instanceof Error ? error.message : "Cloud title generation failed.",
            aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    finally {
        await node_fs_2.promises.rm(tmpDir, { recursive: true, force: true });
    }
});

exports.transcribeCampStory = (0, firestore_2.onDocumentCreated)({
    document: "campStories/{storyId}",
    region: "us-central1",
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const storyId = event.params.storyId;
    const data = snapshot.data() || {};
    if (String(data.transcriptionStatus || "").trim() !== "pending") {
        return;
    }
    const audioPath = String(data.audioPath || data.voicePath || "").trim() ||
        extractFirebaseStoragePathFromUrl(data.audioUrl || data.voiceUrl);
    if (!audioPath) {
        await snapshot.ref.update({
            transcriptionStatus: "failed",
            transcriptionError: "Missing story audio storage path for transcription.",
            aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return;
    }
    const tmpDir = await node_fs_2.promises.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "deercamp-story-audio-"));
    const ext = node_path_1.default.extname(audioPath) || ".webm";
    const localAudioPath = node_path_1.default.join(tmpDir, `story${ext}`);
    try {
        await bucket.file(audioPath).download({ destination: localAudioPath });
        const openai = new openai_1.default({ apiKey: OPENAI_API_KEY.value() });
        const transcript = await transcribeAudio(openai, localAudioPath);
        if (!transcript) {
            await snapshot.ref.update({
                transcriptionStatus: "failed",
                transcriptionError: "No usable speech detected.",
                transcript: "",
                transcriptPreview: "",
                aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return;
        }
        const transcriptPreview = makeTranscriptPreview(transcript, 240);
        const summary = makeTranscriptPreview(transcript, 220);
        const existingBody = cleanSpaces(data.body || data.text || "");
        await snapshot.ref.update(Object.assign({
            transcript,
            transcriptPreview,
            summary,
            transcriptionStatus: "complete",
            transcriptionError: "",
            aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, existingBody ? {} : {
            body: transcript,
            text: transcript,
        }));
        await snapshot.ref.collection("ai").doc("transcript").set({
            transcript,
            summary,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (error) {
        firebase_functions_1.logger.error("Camp story transcription failed.", {
            storyId,
            error: error instanceof Error ? error.message : String(error),
        });
        await snapshot.ref.update({
            transcriptionStatus: "failed",
            transcriptionError: error instanceof Error ? error.message : "Camp story transcription failed.",
            aiUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    finally {
        await node_fs_2.promises.rm(tmpDir, { recursive: true, force: true });
    }
});

//# sourceMappingURL=index.js.map