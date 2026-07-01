(function(){
  function escapeHtml(value){
    return String(value ?? "").replace(/[&<>"']/g, s => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[s]));
  }

  function resourceCategoryLabel(label){
    return String(label || "Resources").replace(/^[^A-Za-z0-9]+/, "").trim() || "Resources";
  }

  function formatDistance(value){
    const num = Number(value);
    return Number.isFinite(num) ? `${num.toFixed(1)} miles from camp` : "";
  }

  function normalizeList(value){
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function renderResourcePackEmailHtml({
    campName = "DeerCamp",
    campLocation = "",
    zip = "",
    recipientNames = [],
    radiusMiles = 25,
    builtAt = new Date(),
    missionName = "Trip Prep Mission",
    missionDates = "",
    hunterName = "",
    shoppingStrategy = "Shop at Home",
    startZip = "",
    endZip = "",
    searchLabel = "Search Radius",
    meals = [],
    staples = [],
    notes = "",
    categories = {},
    footerNote = "Sent from DeerCamp CampResources Mission Center."
  } = {}){
    const built = builtAt instanceof Date ? builtAt : new Date(builtAt);
    const builtLabel = Number.isNaN(built.getTime()) ? "" : built.toLocaleString();
    const recipientLine = normalizeList(recipientNames).join(", ");
    const categoryKeys = Object.keys(categories || {}).sort((a,b)=>resourceCategoryLabel(a).localeCompare(resourceCategoryLabel(b)));

    const mealHtml = normalizeList(meals).map(item => {
      const meal = escapeHtml(item.meal || "Meal");
      const title = escapeHtml(item.title || item.recipe?.title || "TBD");
      const ingredients = normalizeList(item.ingredients || item.recipe?.ingredients);
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #eadfce;"><strong>${meal}:</strong> ${title}${ingredients.length ? `<div style="margin-top:6px;color:#5f4d3d;font-size:13px;">${ingredients.map(i=>`<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 8px;border-radius:999px;background:#fff4df;border:1px solid #eadfce;">${escapeHtml(i)}</span>`).join("")}</div>` : ""}</td></tr>`;
    }).join("");

    const staplesHtml = normalizeList(staples).map(item => `<li>${escapeHtml(typeof item === "string" ? item : item.text || item.name || "")}</li>`).join("");

    const categoryHtml = categoryKeys.length ? categoryKeys.map(label => {
      const items = normalizeList(categories[label]);
      if(!items.length) return "";
      return `<section style="margin:18px 0 0;"><h3 style="margin:0 0 10px;color:#452a16;font-size:18px;">${escapeHtml(resourceCategoryLabel(label))}</h3>${items.map(item => {
        const distance = formatDistance(item.distanceMiles);
        return `<div style="padding:12px 14px;margin:0 0 10px;border:1px solid #e3d2bd;border-radius:16px;background:#fffaf2;">
          <strong style="display:block;color:#24170f;font-size:16px;">${escapeHtml(item.name || "Resource")}</strong>
          ${item.address ? `<div style="margin-top:4px;color:#5f4d3d;">${escapeHtml(item.address)}</div>` : ""}
          ${distance ? `<div style="margin-top:4px;color:#7b4f21;">${escapeHtml(distance)}</div>` : ""}
          ${item.phone ? `<div style="margin-top:4px;">Phone: <a href="tel:${escapeHtml(item.phone)}" style="color:#8a4f10;">${escapeHtml(item.phone)}</a></div>` : ""}
          ${item.website ? `<div style="margin-top:4px;"><a href="${escapeHtml(item.website)}" style="color:#8a4f10;">Website</a></div>` : ""}
          ${item.mapsUrl ? `<div style="margin-top:4px;"><a href="${escapeHtml(item.mapsUrl)}" style="color:#8a4f10;">Directions</a></div>` : ""}
        </div>`;
      }).join("")}</section>`;
    }).join("") : `<p style="color:#5f4d3d;">No resource stops were selected yet.</p>`;

    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(campName)} Resource Pack</title></head>
<body style="margin:0;background:#f4eadb;font-family:Arial,Helvetica,sans-serif;color:#24170f;">
  <div style="max-width:720px;margin:0 auto;padding:24px 14px;">
    <div style="border-radius:24px;overflow:hidden;background:#fff8ef;border:1px solid #e3d2bd;box-shadow:0 14px 38px rgba(43,28,17,.12);">
      <div style="padding:24px;background:linear-gradient(135deg,#452a16,#7a4a25);color:#fff8ef;">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#ffe1a0;">CampResources Mission Center</div>
        <h1 style="margin:8px 0 6px;font-size:28px;line-height:1.08;">${escapeHtml(missionName)}</h1>
        <div style="color:#ffe8c2;">${escapeHtml(campName)}${campLocation ? ` · ${escapeHtml(campLocation)}` : ""}${zip ? ` · ${escapeHtml(zip)}` : ""}</div>
      </div>
      <div style="padding:22px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:18px;">
          ${missionDates ? `<tr><td style="padding:6px 0;"><strong>Dates:</strong> ${escapeHtml(missionDates)}</td></tr>` : ""}
          ${hunterName ? `<tr><td style="padding:6px 0;"><strong>Hunter:</strong> ${escapeHtml(hunterName)}</td></tr>` : ""}
          ${recipientLine ? `<tr><td style="padding:6px 0;"><strong>Recipients:</strong> ${escapeHtml(recipientLine)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;"><strong>Shopping Strategy:</strong> ${escapeHtml(shoppingStrategy)}</td></tr>
          ${startZip ? `<tr><td style="padding:6px 0;"><strong>Start ZIP:</strong> ${escapeHtml(startZip)}</td></tr>` : ""}
          ${endZip ? `<tr><td style="padding:6px 0;"><strong>Camp / End ZIP:</strong> ${escapeHtml(endZip)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;"><strong>${escapeHtml(searchLabel)}:</strong> ${escapeHtml(radiusMiles)} miles</td></tr>
        </table>

        <h2 style="font-size:20px;color:#452a16;margin:18px 0 8px;">Your Assignments</h2>
        ${mealHtml ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${mealHtml}</table>` : `<p style="color:#5f4d3d;">No meals selected yet.</p>`}
        ${staplesHtml ? `<h3 style="font-size:17px;color:#452a16;margin:18px 0 8px;">Camp Staples / Resources</h3><ul style="margin-top:0;">${staplesHtml}</ul>` : ""}
        ${notes ? `<h3 style="font-size:17px;color:#452a16;margin:18px 0 8px;">Steward Notes</h3><p style="white-space:pre-wrap;">${escapeHtml(notes)}</p>` : ""}

        <h2 style="font-size:20px;color:#452a16;margin:24px 0 8px;">Suggested Stops / Resource Pack</h2>
        ${categoryHtml}
      </div>
      <div style="padding:14px 24px;background:#f7eddc;color:#6b5845;font-size:13px;">
        ${escapeHtml(footerNote)}${builtLabel ? ` Built ${escapeHtml(builtLabel)}.` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  window.DeerCampResourcePackEmail = {
    escapeHtml,
    resourceCategoryLabel,
    formatDistance,
    renderResourcePackEmailHtml
  };
})();
