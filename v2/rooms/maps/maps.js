(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

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

  async function openScoutBuilder(builder) {
    const campId = getActiveCampId();
    const camp = await getCampData();
    const campName = firstNonEmpty(
      camp?.campName,
      camp?.name,
      camp?.title,
      camp?.campTitle,
      camp?.camp,
      "DeerCamp"
    );
    const url = new URL("../../../scout.html", window.location.href);

    if (campId) url.searchParams.set("campId", campId);
    url.searchParams.set("builder", builder === "drive" ? "drive" : "stand");
    url.searchParams.set("campName", campName);

    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get("useStagingFirebase") === "true") {
      url.searchParams.set("useStagingFirebase", "true");
    }

    window.location.href = url.toString();
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

  function buildScoutStandUrl(item) {
    const campId = getActiveCampId();
    const standId = firstNonEmpty(
      item?.id,
      item?.standId,
      item?.campStandId,
      item?.linkedItemId,
      item?.scoutId,
      item?.title,
      item?.name
    );
    if (!standId) return "";

    const url = new URL("../../../scout.html", window.location.href);
    if (campId) url.searchParams.set("campId", campId);
    url.searchParams.set("builder", "stand");
    url.searchParams.set("standId", standId);

    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get("useStagingFirebase") === "true") {
      url.searchParams.set("useStagingFirebase", "true");
    }

    return url.toString();
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

  function getDriveIdentity(item, index) {
    return firstNonEmpty(
      item?.id,
      item?.driveId,
      item?.linkedItemId,
      item?.title,
      item?.driveName,
      item?.name,
      `drive-${index}`
    ).toLowerCase();
  }

  function buildScoutDriveUrl(item) {
    const campId = getActiveCampId();
    const driveId = firstNonEmpty(
      item?.id,
      item?.driveId,
      item?.linkedItemId,
      item?.savedSummary?.id,
      item?.title,
      item?.driveName,
      item?.name
    );
    if (!driveId) return "";

    const url = new URL("../../../scout.html", window.location.href);
    if (campId) url.searchParams.set("campId", campId);
    url.searchParams.set("builder", "drive");
    url.searchParams.set("driveId", driveId);

    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get("useStagingFirebase") === "true") {
      url.searchParams.set("useStagingFirebase", "true");
    }

    return url.toString();
  }

  function collectDriveMaps(camp) {
    const sources = [
      camp?.deerDrivePosts,
      camp?.deerDrives,
      camp?.savedDeerDrives,
      camp?.scoutDeerDrives
    ];

    const seen = new Set();
    const result = [];

    sources.forEach(source => {
      if (!Array.isArray(source)) return;

      source.forEach((item, index) => {
        if (!item || typeof item !== "object") return;

        const identity = getDriveIdentity(item, index);

        if (seen.has(identity)) return;

        seen.add(identity);
        result.push(item);
      });
    });

    return result;
  }

  function getDriveImage(item) {
    const summary =
      item?.savedSummary &&
      typeof item.savedSummary === "object"
        ? item.savedSummary
        : {};

    return firstNonEmpty(
      item?.imageUrl,
      item?.thumbnailUrl,
      item?.thumbUrl,
      item?.mapImageUrl,
      item?.detailImageUrl,
      item?.originalMapImageUrl,
      item?.firebaseUrl,
      item?.storageUrl,
      item?.downloadUrl,
      item?.downloadURL,
      summary?.imageUrl,
      summary?.thumbnailUrl,
      summary?.thumbUrl,
      summary?.mapImageUrl,
      summary?.detailImageUrl,
      summary?.originalMapImageUrl,
      summary?.firebaseUrl,
      summary?.storageUrl,
      summary?.downloadUrl,
      summary?.downloadURL,
      item?.image,
      item?.thumbnail,
      item?.detailImage,
      item?.originalMapImage
    );
  }

  function getDriveRoutes(item) {
    const summary =
      item?.savedSummary &&
      typeof item.savedSummary === "object"
        ? item.savedSummary
        : {};

    const candidates = [
      item?.routeSummaries,
      item?.routes,
      item?.routePaths,
      item?.driveRoutes,
      item?.accessRoutes,
      summary?.routeSummaries
    ];

    return candidates.find(value => Array.isArray(value)) || [];
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
        ? buildScoutStandUrl(item)
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

  async function openDriveMaps() {
    openDialog(
      "Drive Maps",
      '<div class="maps-loading">Loading saved drive maps...</div>',
      true
    );

    const camp = await getCampData();
    const drives = collectDriveMaps(camp);

    if (!drives.length) {
      openDialog(
        "Drive Maps",
        '<div class="maps-empty">' +
          '<strong>No drive maps saved yet.</strong>' +
          '<p>Create and save a Deer Drive to make it available here.</p>' +
        '</div>',
        true
      );
      return;
    }

    const cards = drives.map(item => {
      const summary =
        item?.savedSummary &&
        typeof item.savedSummary === "object"
          ? item.savedSummary
          : {};

      const title = firstNonEmpty(
        item?.title,
        item?.driveName,
        item?.name,
        summary?.driveName,
        "Saved Deer Drive"
      );

      const notes = firstNonEmpty(
        item?.notes,
        item?.body,
        item?.description,
        summary?.notes,
        "Drive details available."
      );

      const wind = firstNonEmpty(
        item?.windLabel,
        item?.wind,
        summary?.windLabel
      );

      const image = getDriveImage(item);
      const routes = getDriveRoutes(item);
      const mapLink = buildScoutDriveUrl(item);

      const routeSummary = routes
        .slice(0, 4)
        .map((route, index) => {
          const routeName = firstNonEmpty(
            route?.name,
            route?.title,
            `Route ${index + 1}`
          );

          const miles = Number(route?.miles);
          const direction = firstNonEmpty(route?.direction);

          const details = [
            Number.isFinite(miles) && miles > 0
              ? `${miles.toFixed(2)} mi`
              : "",
            direction
          ].filter(Boolean).join(" \u2022 ");

          return `
            <div class="maps-drive-route">
              <strong>${esc(routeName)}</strong>
              ${details ? `<span>${esc(details)}</span>` : ""}
            </div>
          `;
        })
        .join("");

      return `
        <article class="maps-drive-card">
          ${
            image
              ? `<img
                   class="maps-drive-thumb"
                   src="${esc(image)}"
                   alt="${esc(title)}">`
              : ""
          }

          <div class="maps-drive-copy">
            <div class="maps-drive-kicker">Deer Drive</div>
            <h3>${esc(title)}</h3>

            ${
              wind
                ? `<div class="maps-drive-tags">
                     <span>${esc(wind)}</span>
                   </div>`
                : ""
            }

            <p class="maps-drive-notes">${esc(notes)}</p>

            ${
              routes.length
                ? `<div class="maps-drive-route-count">
                     ${routes.length} saved route${routes.length === 1 ? "" : "s"}
                   </div>`
                : ""
            }

            ${
              routeSummary
                ? `<div class="maps-drive-routes">
                     ${routeSummary}
                   </div>`
                : ""
            }

            ${
              mapLink
                ? `<a
                     class="maps-stand-open"
                     href="${mapLink}">
                     Open Map
                   </a>`
                : ""
            }
          </div>
        </article>
      `;
    }).join("");

    openDialog(
      "Drive Maps",
      `
        <div class="maps-stand-summary">
          ${drives.length} saved drive${drives.length === 1 ? "" : "s"}
        </div>

        <div class="maps-drive-list">
          ${cards}
        </div>
      `,
      true
    );
  }

  async function waitForMapsAuthUser(timeoutMs = 3500) {
    const auth =
      window.DeerCampAuth &&
      typeof window.DeerCampAuth.ensureReady === "function"
        ? window.DeerCampAuth.ensureReady()
        : null;

    if (!auth) {
      return null;
    }

    if (auth.currentUser) {
      return auth.currentUser;
    }

    return await new Promise(resolve => {
      let settled = false;

      const finish = user => {
        if (settled) return;
        settled = true;

        try {
          unsubscribe();
        } catch (error) {}

        resolve(user || auth.currentUser || null);
      };

      const unsubscribe = auth.onAuthStateChanged(user => {
        if (user) {
          finish(user);
        }
      });

      setTimeout(() => {
        finish(auth.currentUser || null);
      }, timeoutMs);
    });
  }
  async function openDeerAnalytics() {
    openDialog(
      "Deer Analytics Map",
      '<div class="maps-loading">Loading deer analytics...</div>',
      true
    );

    const campId = getActiveCampId();

    if (!campId) {
      openDialog(
        "Deer Analytics Map",
        '<div class="maps-empty"><strong>No active camp found.</strong></div>',
        true
      );
      return;
    }

    if (
      !window.firebase ||
      typeof window.firebase.firestore !== "function"
    ) {
      openDialog(
        "Deer Analytics Map",
        '<div class="maps-empty"><strong>Firestore is unavailable.</strong></div>',
        true
      );
      return;
    }

    try {
      const authUser = await waitForMapsAuthUser();

      if (!authUser) {
        throw new Error("MAPS_AUTH_REQUIRED");
      }

      const camp = await getCampData();
      const stands = collectStandMaps(camp);

      const snapshot = await window.firebase
        .firestore()
        .collection("camps")
        .doc(campId)
        .collection("campStats")
        .limit(250)
        .get();

      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() || {})
      }));

      if (!records.length) {
        openDialog(
          "Deer Analytics Map",
          '<div class="maps-empty">' +
            '<strong>No deer-count records yet.</strong>' +
            '<p>CampStatsMgr sightings will appear here after they are synced.</p>' +
          '</div>',
          true
        );
        return;
      }

      function normalizeName(value) {
        return String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      }

      function findStand(record) {
        const standId = String(record.standId || "").trim();

        if (standId) {
          const byId = stands.find(stand =>
            [
              stand.id,
              stand.standId,
              stand.linkedItemId
            ].some(value =>
              String(value || "").trim() === standId
            )
          );

          if (byId) return byId;
        }

        const name = normalizeName(record.standName);

        return stands.find(stand =>
          [
            stand.title,
            stand.name,
            stand.standName
          ].some(value =>
            normalizeName(value) === name
          )
        ) || null;
      }

      const groups = new Map();

      records.forEach(record => {
        const stand = findStand(record);

        const key = firstNonEmpty(
          record.standId,
          record.standName,
          "unknown-stand"
        );

        if (!groups.has(key)) {
          groups.set(key, {
            stand,
            name: firstNonEmpty(
              stand?.title,
              stand?.name,
              record.standName,
              "Unknown Stand"
            ),
            buckAm: 0,
            doeAm: 0,
            buckPm: 0,
            doePm: 0,
            total: 0
          });
        }

        const group = groups.get(key);
        const count = Number(record.count || 1);

        if (
          ["buckAm", "doeAm", "buckPm", "doePm"]
            .includes(record.statType)
        ) {
          group[record.statType] += count;
        }

        group.total += count;
      });

      const sortedGroups = Array
        .from(groups.values())
        .sort((a, b) => b.total - a.total);

      const grandTotals = sortedGroups.reduce(
        (totals, group) => {
          totals.total += group.total;
          totals.buckAm += group.buckAm;
          totals.doeAm += group.doeAm;
          totals.buckPm += group.buckPm;
          totals.doePm += group.doePm;
          return totals;
        },
        {
          total: 0,
          buckAm: 0,
          doeAm: 0,
          buckPm: 0,
          doePm: 0
        }
      );

      const cards = sortedGroups.map(group => {
        const coords = group.stand
          ? getCoordinates(group.stand)
          : { valid: false };

        const mapLink = coords.valid
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${coords.lat},${coords.lng}`
            )}`
          : "";

        return `
          <article class="maps-stand-card">
            <div class="maps-stand-copy">
              <div class="maps-stand-kicker">
                Deer Analytics
              </div>

              <h3>${esc(group.name)}</h3>

              <div class="maps-stand-tags">
                <span>Total ${group.total}</span>
                <span>Buck AM ${group.buckAm}</span>
                <span>Doe AM ${group.doeAm}</span>
                <span>Buck PM ${group.buckPm}</span>
                <span>Doe PM ${group.doePm}</span>
              </div>

              ${
                coords.valid
                  ? `
                    <p class="maps-stand-coords">
                      ${coords.lat.toFixed(5)},
                      ${coords.lng.toFixed(5)}
                    </p>

                    <a
                      class="maps-stand-open"
                      href="${mapLink}"
                      target="_blank"
                      rel="noopener noreferrer">
                      Open Map
                    </a>
                  `
                  : `
                    <span class="maps-stand-no-map">
                      Stand location unavailable
                    </span>
                  `
              }
            </div>
          </article>
        `;
      }).join("");

      openDialog(
        "Deer Analytics Map",
        `
          <div class="maps-stand-summary">
            ${grandTotals.total} total sightings
            &nbsp;|&nbsp;
            Buck AM ${grandTotals.buckAm}
            &nbsp;&#8226;&nbsp;
            Doe AM ${grandTotals.doeAm}
            &nbsp;&#8226;&nbsp;
            Buck PM ${grandTotals.buckPm}
            &nbsp;&#8226;&nbsp;
            Doe PM ${grandTotals.doePm}
          </div>

          <div class="maps-stand-list">
            ${cards}
          </div>
        `,
        true
      );

    } catch (error) {
      console.error(
        "Maps: Deer Analytics load failed.",
        error
      );

      openDialog(
        "Deer Analytics Map",
        '<div class="maps-empty">' +
          '<strong>Deer analytics could not load.</strong>' +
          '<p>Confirm you are signed in to this camp and try again.</p>' +
        '</div>',
        true
      );
    }
  }

  function openRecordDeerCount() {
    openDialog(
      "Record Deer Count",
      '<p>Record deer sightings in the <strong>Camp Field App</strong> using <strong>CampStatsMgr</strong>.</p>' +
      '<p>Log Buck AM, Doe AM, Buck PM, and Doe PM counts by stand. Synced sightings will appear here in the <strong>Deer Analytics Map</strong>.</p>',
      true
    );
  }

  function openExportMap() {
    openDialog(
      "Export Map",
      '<p>Choose the map you want to prepare in <strong>Scout Elite</strong>. From there, use <strong>Poster Preview</strong> and export the map as PDF or PNG.</p>' +
      '<p><a class="maps-stand-open" href="#" data-scout-builder="stand">Stand Map</a> ' +
      '<a class="maps-stand-open" href="#" data-scout-builder="drive">Drive Map</a></p>',
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
    const scoutBuilderLink = event.target.closest("[data-scout-builder]");

    if (scoutBuilderLink) {
      event.preventDefault();
      closeDialog();
      await openScoutBuilder(scoutBuilderLink.dataset.scoutBuilder);
      return;
    }

    const button = event.target.closest("[data-action-id]");

    if (!button) return;

    const actionId = String(button.dataset.actionId || "");

    if (actionId === "create-stand-map") {
      await openScoutBuilder("stand");
      return;
    }

    if (actionId === "create-drive-map") {
      await openScoutBuilder("drive");
      return;
    }

    if (actionId === "stand-maps") {
      await openStandMaps();
      return;
    }

    if (actionId === "drive-maps") {
      await openDriveMaps();
      return;
    }

    if (actionId === "deer-analytics") {
      await openDeerAnalytics();
      return;
    }

    if (actionId === "record-deer-count") {
      openRecordDeerCount();
      return;
    }

    if (actionId === "export-map") {
      openExportMap();
    }
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
