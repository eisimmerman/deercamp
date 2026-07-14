/**
 * DeerCamp biweekly nationwide deer opener updater
 *
 * Batch 1 automated official-source states:
 * - Iowa
 * - Illinois
 * - Minnesota
 * - Wisconsin
 *
 * Safety rules:
 * - State wildlife agencies are the source of truth.
 * - Publish only dates confirmed on official agency pages.
 * - Partial state results are allowed.
 * - Never delete previously verified data because a page fetch or parser fails.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OPENERS_PATH = path.join(
  ROOT,
  "data",
  "us-state-deer-openers.json"
);

const TARGET_YEAR = new Date().getFullYear();
const ALLOWED_TYPES = new Set([
  "archery",
  "firearm",
  "muzzleloader"
]);

const ICONS = {
  archery: "\u{1F3F9}",
  firearm: "\u{1F52B}",
  muzzleloader: "\u{1F4A5}"
};

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function monthIndex(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");

  const months = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };

  return months[key] || 0;
}

function toIsoDate(year, month, day) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseNamedDate(value, fallbackYear = TARGET_YEAR) {
  const match = String(value || "").match(
    /([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/
  );

  if (!match) return null;

  const month = monthIndex(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3] || fallbackYear);

  if (!month || !day || !year) return null;

  return toIsoDate(year, month, day);
}

function parseSlashDate(value) {
  const match = String(value || "").match(
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/
  );

  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  return toIsoDate(year, month, day);
}

function normalizeSeason(season) {
  const type = String(season?.type || "")
    .trim()
    .toLowerCase();

  return {
    ...season,
    type,
    date: String(season?.date || "").trim(),
    title: String(season?.title || "").trim(),
    description: String(season?.description || "").trim(),
    icon: ICONS[type] || String(season?.icon || "").trim(),
    sourceUrl: String(season?.sourceUrl || "").trim(),
    ...(season?.scopeNote
      ? { scopeNote: String(season.scopeNote).trim() }
      : {})
  };
}

function validateStateEntry(stateCode, stateEntry) {
  if (!stateEntry || typeof stateEntry !== "object") {
    throw new Error(
      `State ${stateCode}: entry must be an object`
    );
  }

  const seasons = Array.isArray(stateEntry.seasons)
    ? stateEntry.seasons
    : [];

  for (const season of seasons) {
    const type = String(season?.type || "")
      .trim()
      .toLowerCase();

    if (!ALLOWED_TYPES.has(type)) {
      throw new Error(
        `State ${stateCode}: invalid season type "${season?.type}"`
      );
    }

    if (!isIsoDate(season?.date)) {
      throw new Error(
        `State ${stateCode}: invalid date "${season?.date}"`
      );
    }
  }
}

function uniqueSeasons(seasons) {
  const byType = new Map();

  seasons
    .map(normalizeSeason)
    .filter((season) => {
      return (
        ALLOWED_TYPES.has(season.type) &&
        isIsoDate(season.date) &&
        season.title
      );
    })
    .forEach((season) => {
      if (!byType.has(season.type)) {
        byType.set(season.type, season);
      }
    });

  return [...byType.values()];
}

function makeStateEntry({
  currentEntry,
  stateName,
  source,
  sourceUrl,
  validationStatus = "verified_official_statewide",
  seasons
}) {
  const confirmedSeasons = uniqueSeasons(seasons);

  if (!confirmedSeasons.length) {
    throw new Error(
      `${stateName}: no official opener dates were confirmed.`
    );
  }

  const existingSeasons = uniqueSeasons(
    Array.isArray(currentEntry?.seasons)
      ? currentEntry.seasons
      : []
  );

  const mergedByType = new Map(
    existingSeasons.map((season) => [
      season.type,
      season
    ])
  );

  confirmedSeasons.forEach((season) => {
    mergedByType.set(season.type, season);
  });

  const mergedSeasons = [
    "archery",
    "firearm",
    "muzzleloader"
  ]
    .map((type) => mergedByType.get(type))
    .filter(Boolean);

  return {
    ...currentEntry,
    stateName,
    source,
    sourceUrl,
    validatedAt: new Date().toISOString().slice(0, 10),
    validationStatus,
    seasons: mergedSeasons,
    zipOverrides:
      currentEntry?.zipOverrides &&
      typeof currentEntry.zipOverrides === "object"
        ? currentEntry.zipOverrides
        : {}
  };
}

async function readOpenersFile() {
  const raw = await fs.readFile(OPENERS_PATH, "utf8");
  return JSON.parse(raw);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "DeerCamp official deer opener updater/2.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Request failed ${response.status} for ${url}`
    );
  }

  return response.text();
}

async function fetchWisconsinStatewideOpeners(currentEntry) {
  const sourceUrl =
    "https://dnr.wisconsin.gov/topic/hunt/dates";

  const text = cleanText(await fetchText(sourceUrl));

  const archeryMatch = text.match(
    /Archery and Crossbow\*?\s+([A-Za-z]+\.*\s+\d{1,2})\s*[-–]/
  );

  const firearmMatch = text.match(
    /(?:^|\s)Gun\s+([A-Za-z]+\.*\s+\d{1,2})\s*[-–]/
  );

  const muzzleloaderMatch = text.match(
    /Muzzleloader\s+([A-Za-z]+\.*\s+\d{1,2})\s*[-–]/
  );

  const seasons = [];

  if (archeryMatch) {
    seasons.push({
      type: "archery",
      date: parseNamedDate(archeryMatch[1]),
      title: "Wisconsin Archery / Crossbow Deer Opener",
      description:
        `Official Wisconsin DNR statewide archery and crossbow deer opener for ${TARGET_YEAR}.`,
      sourceUrl
    });
  }

  if (firearmMatch) {
    seasons.push({
      type: "firearm",
      date: parseNamedDate(firearmMatch[1]),
      title: "Wisconsin Gun Deer Opener",
      description:
        `Official Wisconsin DNR gun deer opener for ${TARGET_YEAR}.`,
      sourceUrl
    });
  }

  if (muzzleloaderMatch) {
    seasons.push({
      type: "muzzleloader",
      date: parseNamedDate(muzzleloaderMatch[1]),
      title: "Wisconsin Muzzleloader Deer Opener",
      description:
        `Official Wisconsin DNR muzzleloader deer opener for ${TARGET_YEAR}.`,
      sourceUrl
    });
  }

  return makeStateEntry({
    currentEntry,
    stateName: "Wisconsin",
    source:
      "Wisconsin Department of Natural Resources hunting season dates",
    sourceUrl,
    seasons
  });
}

async function fetchMinnesotaStatewideOpeners(currentEntry) {
  const sourceUrl =
    "https://www.dnr.state.mn.us/hunting/seasons.html";

  const text = cleanText(await fetchText(sourceUrl));
  const shortYear = String(TARGET_YEAR).slice(2);

  const datePattern =
    `(\\d{1,2}\\/\\d{1,2}\\/(?:${shortYear}|${TARGET_YEAR}))`;

  const archeryMatch = text.match(
    new RegExp(
      `${datePattern}\\s*[-–]\\s*\\d{1,2}\\/\\d{1,2}\\/(?:\\d{2}|\\d{4})\\s*Deer\\s*[-–]\\s*Archery\\s*Statewide`,
      "i"
    )
  );

  const muzzleloaderMatch = text.match(
    new RegExp(
      `${datePattern}\\s*[-–]\\s*\\d{1,2}\\/\\d{1,2}\\/(?:\\d{2}|\\d{4})\\s*Deer\\s*[-–]\\s*Muzzleloader\\s*Statewide`,
      "i"
    )
  );

  const firearmMatches = [
    ...text.matchAll(
      new RegExp(
        `${datePattern}\\s*[-–]\\s*\\d{1,2}\\/\\d{1,2}\\/(?:\\d{2}|\\d{4})\\s*Deer\\s*[-–]\\s*Firearm\\s*\\(Season A\\)`,
        "ig"
      )
    )
  ];

  const firearmDates = firearmMatches
    .map((match) => parseSlashDate(match[1]))
    .filter(Boolean)
    .sort();

  const seasons = [];

  if (archeryMatch) {
    seasons.push({
      type: "archery",
      date: parseSlashDate(archeryMatch[1]),
      title: "Minnesota Archery Deer Opener",
      description:
        `Official Minnesota DNR statewide archery deer opener for ${TARGET_YEAR}.`,
      sourceUrl
    });
  }

  if (firearmDates.length) {
    seasons.push({
      type: "firearm",
      date: firearmDates[0],
      title: "Minnesota Firearm Deer Opener",
      description:
        `Official Minnesota DNR earliest regular Season A firearm deer opener for ${TARGET_YEAR}; closing dates vary by permit area.`,
      sourceUrl
    });
  }

  if (muzzleloaderMatch) {
    seasons.push({
      type: "muzzleloader",
      date: parseSlashDate(muzzleloaderMatch[1]),
      title: "Minnesota Muzzleloader Deer Opener",
      description:
        `Official Minnesota DNR statewide muzzleloader deer opener for ${TARGET_YEAR}.`,
      sourceUrl
    });
  }

  return makeStateEntry({
    currentEntry,
    stateName: "Minnesota",
    source:
      "Minnesota Department of Natural Resources hunting season dates",
    sourceUrl,
    seasons
  });
}

async function fetchIowaStatewideOpeners(currentEntry) {
  const sourceUrl =
    "https://www.iowadnr.gov/things-do/hunting-trapping/iowa-hunting-seasons";

  const text = cleanText(await fetchText(sourceUrl));

  const archeryMatch = text.match(
    /Archery,\s*Early Split\s+([A-Za-z]+\s+\d{1,2})\s*[-–]/
  );

  const muzzleloaderMatch = text.match(
    /Early Muzzleloader\s+([A-Za-z]+\s+\d{1,2})\s*[-–]/
  );

  const shotgunMatch = text.match(
    /Shotgun 1\s+([A-Za-z]+\s+\d{1,2})\s*[-–]/
  );

  const seasons = [];

  if (archeryMatch) {
    seasons.push({
      type: "archery",
      date: parseNamedDate(archeryMatch[1]),
      title: "Iowa Archery Deer Opener",
      description:
        `Official Iowa DNR early-split archery deer opener for ${TARGET_YEAR}/${String(TARGET_YEAR + 1).slice(2)}.`,
      sourceUrl
    });
  }

  if (shotgunMatch) {
    seasons.push({
      type: "firearm",
      date: parseNamedDate(shotgunMatch[1]),
      title: "Iowa Shotgun 1 Deer Opener",
      description:
        `Official Iowa DNR Shotgun 1 deer opener for ${TARGET_YEAR}; DeerCamp maps Shotgun 1 to the gun/rifle calendar slot.`,
      sourceUrl
    });
  }

  if (muzzleloaderMatch) {
    seasons.push({
      type: "muzzleloader",
      date: parseNamedDate(muzzleloaderMatch[1]),
      title: "Iowa Early Muzzleloader Deer Opener",
      description:
        `Official Iowa DNR early muzzleloader deer opener for ${TARGET_YEAR}.`,
      sourceUrl
    });
  }

  return makeStateEntry({
    currentEntry,
    stateName: "Iowa",
    source:
      "Iowa Department of Natural Resources hunting seasons",
    sourceUrl,
    seasons
  });
}

async function fetchIllinoisStatewideOpeners(currentEntry) {
  const archeryUrl =
    "https://dnr.illinois.gov/hunting/deerarcheryinformation.html";

  const firearmUrl =
    "https://dnr.illinois.gov/hunting/deerfirearmmuzzleloader.html";

  const [archeryText, firearmText] = await Promise.all([
    fetchText(archeryUrl).then(cleanText),
    fetchText(firearmUrl).then(cleanText)
  ]);

  const archeryMatch = archeryText.match(
    /October\s+(\d{1,2})\s*[-–]\s*November\s+\d{1,2},\s*(\d{4})/
  );

  const firearmMatch = firearmText.match(
    /First Firearm Deer Season:\s*([A-Za-z]+\s+\d{1,2})[^0-9]+(\d{4})/
  );

  const muzzleloaderMatch = firearmText.match(
    /Muzzleloader-Only Deer Season:\s*([A-Za-z]+\s+\d{1,2})[^0-9]+(\d{4})/
  );

  const seasons = [];

  if (archeryMatch) {
    seasons.push({
      type: "archery",
      date: toIsoDate(
        Number(archeryMatch[2]),
        10,
        Number(archeryMatch[1])
      ),
      title: "Illinois Archery Deer Opener",
      description:
        `Official Illinois DNR archery deer opener for ${TARGET_YEAR}/${String(TARGET_YEAR + 1).slice(2)}.`,
      sourceUrl: archeryUrl
    });
  }

  if (firearmMatch) {
    seasons.push({
      type: "firearm",
      date: parseNamedDate(
        `${firearmMatch[1]}, ${firearmMatch[2]}`
      ),
      title: "Illinois Firearm Deer Opener",
      description:
        `Official Illinois DNR First Firearm Deer Season opener for ${TARGET_YEAR}.`,
      sourceUrl: firearmUrl
    });
  }

  if (muzzleloaderMatch) {
    seasons.push({
      type: "muzzleloader",
      date: parseNamedDate(
        `${muzzleloaderMatch[1]}, ${muzzleloaderMatch[2]}`
      ),
      title: "Illinois Muzzleloader-Only Deer Opener",
      description:
        `Official Illinois DNR muzzleloader-only deer opener for ${TARGET_YEAR}.`,
      sourceUrl: firearmUrl
    });
  }

  return makeStateEntry({
    currentEntry,
    stateName: "Illinois",
    source:
      "Illinois Department of Natural Resources deer hunting pages",
    sourceUrl:
      "https://dnr.illinois.gov/hunting/deerhunting.html",
    validationStatus:
      "verified_official_statewide_with_county_notes",
    seasons
  });
}

const stateFetchers = {
  IA: fetchIowaStatewideOpeners,
  IL: fetchIllinoisStatewideOpeners,
  MN: fetchMinnesotaStatewideOpeners,
  WI: fetchWisconsinStatewideOpeners
};

async function updateStates(existingStates) {
  const nextStates = { ...existingStates };

  for (const [stateCode, fetcher] of Object.entries(
    stateFetchers
  )) {
    const currentEntry = existingStates[stateCode] || {
      seasons: [],
      zipOverrides: {}
    };

    try {
      const updated = await fetcher(currentEntry);
      validateStateEntry(stateCode, updated);
      nextStates[stateCode] = updated;

      console.log(
        `Updated ${stateCode}: ${updated.seasons.length} verified opener date(s).`
      );
    } catch (error) {
      console.warn(
        `Skipped ${stateCode}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  return nextStates;
}

async function main() {
  const current = await readOpenersFile();

  if (!current || typeof current !== "object") {
    throw new Error(
      "us-state-deer-openers.json must contain a top-level object"
    );
  }

  const currentStates =
    current.states && typeof current.states === "object"
      ? current.states
      : {};

  for (const [stateCode, stateEntry] of Object.entries(
    currentStates
  )) {
    validateStateEntry(stateCode, stateEntry);
  }

  const nextStates = await updateStates(currentStates);

  const next = {
    ...current,
    updatedAt: new Date().toISOString().slice(0, 10),
    states: nextStates
  };

  const before = stableStringify(current);
  const after = stableStringify(next);

  if (before === after) {
    console.log("No deer opener changes found.");
    return;
  }

  await fs.writeFile(OPENERS_PATH, after, "utf8");

  console.log(
    "Updated data/us-state-deer-openers.json"
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

