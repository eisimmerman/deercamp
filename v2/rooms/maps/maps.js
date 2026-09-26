(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  const ACTIONS = {
    "property-maps": {
      title: "Property Maps",
      message: "No Property Map has been saved for this camp yet."
    },

    "drive-maps": {
      title: "Drive Maps",
      message: "Drive Maps wiring is next."
    },

    "deer-analytics": {
      title: "Deer Analytics Map",
      message: "Deer Analytics Map wiring will follow Drive Maps."
    },

    "create-stand-map": {
      title: "Create Stand Map",
      message: "Create Stand Map selected."
    },

    "create-drive-map": {
      title: "Create Drive Map",
      message: "Create Drive Map selected."
    },

    "record-deer-count": {
      title: "Record Deer Count",
      message: "Record Deer Count selected."
    },

    "export-map": {
      title: "Export Map",
      message: "Export Map selected."
    }
  };

  function safeParse(value, fallback = null) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      const clean = String(value ?? "").trim();
      if (clean) return clean;
    }
    return "";
  }

  function getActiveCampId() {
    const params = new URLSearchParams(window.location.search);

    return firstNonEmpty(
      params.get("campId"),
      localStorage.getItem("deercamp.activeCampId"),
      localStorage.getItem("activeCampId"),
      safeParse(localStorage.getItem("campData"), {})?.campId
    );
  }

  async function getCampData() {
    const campId = getActiveCampId();

    if (
      campId &&
      window.DeerCampCloud &&
      typeof window.DeerCampCloud.getCamp === "function"
    ) {
      try {
        const cloudCamp = await window.DeerCampCloud.getCamp(campId);

        if (cloudCamp && typeof cloudCamp === "object") {
          localStorage.setItem("campData", JSON.stringify(cloudCamp));
          return cloudCamp;
        }
      } catch (error) {
        console.warn("Maps: cloud camp load failed; using local camp data.", error);
      }
    }

    return safeParse(localStorage.getItem("campData"), {}) || {};
  }

  function getStandIdentity(item, index) {
    return firstNonEmpty(
      item?.id,
      item?.standId,
      item?.linkedItemId,
      item?.title,
      item?.name,
      `stand-${index}`
    ).toLowerCase();
  }

  function collectStandMaps(camp) {
    const sources = [
      camp?.deerStandPosts,
      camp?.deerStands,
      camp?.stands,
      camp?.savedDeerStands,
      camp?.scoutDeerStands
    ];

    const seen = new Set();
    const result = [];

    sources.forEach(source => {
      if (!Array.isArray(source)) return;

      source.forEach((item, index) => {
        if (!item || typeof item !== "object") return;

        const identity = getStandIdentity(item, index);

        if (seen.has(identity)) return;

        seen.add(identity);
        result.push(item);
      });
    });

    return result;
  }

  function getCoordinates(item) {
    const lat = Number(
      item?.lat ??
      item?.latitude ??
      item?.coords?.lat ??
      item?.position?.lat
    );

    const lng = Number(
      item?.lng ??
      item?.longitude ??
      item?.coords?.lng ??
      item?.position?.lng
    );

    return {
      lat,
      lng,
      valid: Number.isFinite(lat) && Number.isFinite(lng)
    };
  }

  function labelize(value) {
    return String(value || "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function getStandType(item) {
    const labels = {
      treestand: "Treestand",
      blind: "Ground Blind",
      boxblind: "Box Blind",
      ladder: "Ladder Stand",
      foodplot: "Food Plot",
      trailcam: "Trail Camera",
      scrape: "Scrape / Rub",
      waypoint: "Waypoint"
    };

    const raw = String(item?.standType || item?.type || "").toLowerCase();

    return labels[raw] || labelize(raw || "Stand");
  }

  function getStandImage(item) {
    return firstNonEmpty(
      item?.thumbUrl,
      item?.thumbnail,
      item?.image,
      item?.displayUrl,
      item?.imageUrl,
      item?.photo && typeof item.photo === "object"
        ? item.photo.thumbUrl || item.photo.displayUrl
        : item?.photo,
      item?.media,
      item?.url
    );
  }

  function openDialog(title, message, useHtml = false) {
    const dialog = byId("mapsDialog");
    const titleElement = byId("mapsDialogTitle");
    const messageElement = byId("mapsDialogMessage");

    if (!dialog) return;

    if (titleElement) {
      titleElement.textContent = title;
    }

    if (messageElement) {
      if (useHtml) {
        messageElement.innerHTML = message;
      } else {
        messageElement.textContent = message;
      }
    }

    if (
      typeof dialog.showModal === "function" &&
      !dialog.open
    ) {
      dialog.showModal();
    }
  }

  async function openStandMaps() {
    openDialog(
      "Stand Maps",
      '<div class="maps-loading">Loading saved stand maps...</div>',
      true
    );

    const camp = await getCampData();
    const stands = collectStandMaps(camp);

    if (!stands.length) {
      openDialog(
        "Stand Maps",
        '<div class="maps-empty">' +
          '<strong>No stand maps saved yet.</strong>' +
          '<p>Create and save a Deer Stand to make it available here.</p>' +
        '</div>',
        true
      );
      return;
    }

    const cards = stands.map(item => {
      const coords = getCoordinates(item);
      const title = firstNonEmpty(
        item.title,
        item.name,
        "Saved Stand"
      );
      const notes = firstNonEmpty(
        item.body,
        item.notes,
        item.description,
        "Stand details available."
      );
      const image = getStandImage(item);
      const type = getStandType(item);

      const meta = [
        type,
        item.wind ? `Wind ${item.wind}` : "",
        item.tod || item.timeOfDay
          ? labelize(item.tod || item.timeOfDay)
          : "",
        item.season || ""
      ].filter(Boolean);

      const coordinateText = coords.valid
        ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
        : firstNonEmpty(item.location, "No coordinates saved");

      const mapLink = coords.valid
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${coords.lat},${coords.lng}`
          )}`
        : "";

      return `
        <article class="maps-stand-card">
          ${
            image
              ? `<img class="maps-stand-thumb"
                   src="${esc(image)}"
                   alt="${esc(title)}">`
              : ""
          }

          <div class="maps-stand-copy">
            <div class="maps-stand-kicker">Deer Stand</div>
            <h3>${esc(title)}</h3>

            ${
              meta.length
                ? `<div class="maps-stand-tags">
                    ${meta.map(tag =>
                      `<span>${esc(tag)}</span>`
                    ).join("")}
                   </div>`
                : ""
            }

            <p class="maps-stand-notes">${esc(notes)}</p>

            <p class="maps-stand-coords">
              ${esc(coordinateText)}
            </p>

            ${
              mapLink
                ? `<a
                     class="maps-stand-open"
                     href="${mapLink}"
                     target="_blank"
                     rel="noopener noreferrer">
                     Open Map
                   </a>`
                : `<span class="maps-stand-no-map">
                     Map location unavailable
                   </span>`
            }
          </div>
        </article>
      `;
    }).join("");

    openDialog(
      "Stand Maps",
      `
        <div class="maps-stand-summary">
          ${stands.length} saved stand${stands.length === 1 ? "" : "s"}
        </div>

        <div class="maps-stand-list">
          ${cards}
        </div>
      `,
      true
    );
  }

  function closeDialog() {
    const dialog = byId("mapsDialog");

    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  document.addEventListener("click", async function (event) {
    const button = event.target.closest("[data-action-id]");

    if (!button) return;

    const actionId = String(button.dataset.actionId || "");

    if (actionId === "stand-maps") {
      await openStandMaps();
      return;
    }

    const action = ACTIONS[actionId];

    if (!action) return;

    openDialog(
      action.title,
      action.message
    );
  });

  const closeButton = byId("mapsDialogClose");

  if (closeButton) {
    closeButton.addEventListener(
      "click",
      closeDialog
    );
  }

  const dialog = byId("mapsDialog");

  if (dialog) {
    dialog.addEventListener(
      "click",
      function (event) {
        if (event.target === dialog) {
          closeDialog();
        }
      }
    );
  }
})();
