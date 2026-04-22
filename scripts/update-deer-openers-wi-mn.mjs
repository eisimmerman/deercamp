\
#!/usr/bin/env node

/**
 * DeerCamp monthly deer opener updater
 *
 * Draft status:
 * - Wisconsin fetcher: implemented against Wisconsin DNR deer season page
 * - Minnesota fetcher: implemented against Minnesota DNR season pages
 * - Other states: placeholders
 *
 * Safety rules for this updater:
 * - Only write officially published statewide opener dates
 * - Do not invent or extrapolate unpublished dates
 * - Preserve existing state data if a fetcher cannot confirm replacements
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OPENERS_PATH = path.join(ROOT, "data", "us-state-deer-openers.json");

const ALLOWED_TYPES = new Set(["archery", "firearm", "muzzleloader"]);

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function currentSeasonYear() {
  return new Date().getFullYear();
}

function normalizeSeason(season) {
  return {
    type: String(season?.type || "").trim().toLowerCase(),
    date: String(season?.date || "").trim(),
    title: String(season?.title || "").trim(),
    description: String(season?.description || "").trim(),
    icon: String(season?.icon || "").trim(),
    ...(season?.scopeNote ? { scopeNote: String(season.scopeNote).trim() } : {})
  };
}

function validateStateEntry(stateCode, stateEntry) {
  if (!stateEntry || typeof stateEntry !== "object") {
    throw new Error(`State ${stateCode}: entry must be an object`);
  }

  const seasons = Array.isArray(stateEntry.seasons) ? stateEntry.seasons : [];

  for (const season of seasons) {
    if (!ALLOWED_TYPES.has(String(season?.type || "").trim().toLowerCase())) {
      throw new Error(`State ${stateCode}: invalid season type "${season?.type}"`);
    }
    if (!isIsoDate(season?.date)) {
      throw new Error(`State ${stateCode}: invalid date "${season?.date}"`);
    }
  }
}

async function readOpenersFile() {
  const raw = await fs.readFile(OPENERS_PATH, "utf8");
  return JSON.parse(raw);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "DeerCamp opener updater/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return response.text();
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function monthIndex(value) {
  const key = String(value || "").trim().toLowerCase().replace(/\./g, "");
  const map = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };
  return map[key] || 0;
}

function toIsoDate(year, month, day) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseMonthDay(dateText, year) {
  const match = String(dateText || "").match(/([A-Za-z]+)\.?\s+(\d{1,2})/);
  if (!match) return null;
  const month = monthIndex(match[1]);
  const day = Number(match[2]);
  if (!month || !day) return null;
  return toIsoDate(year, month, day);
}

function parseSlashDate(dateText, fallbackCentury = 2000) {
  const match = String(dateText || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? fallbackCentury + rawYear : rawYear;
  return toIsoDate(year, month, day);
}

function uniqueSeasons(seasons) {
  const seen = new Set();
  return seasons.filter((season) => {
    const key = `${season.type}|${season.date}|${season.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchWisconsinStatewideOpeners(currentEntry) {
  const targetYear = currentSeasonYear();
  const url = "https://dnr.wisconsin.gov/topic/hunt/deer";
  const html = await fetchText(url);
  const text = cleanText(html);

  const yearSectionMatch = text.match(new RegExp(`${targetYear}\\s+Season Dates(.*?)(Regulations|Hours|Purchase A Hunting License)`, "i"));
  const section = yearSectionMatch ? yearSectionMatch[1] : text;

  const archeryMatch = section.match(/Archery and Crossbow\*?\s*([A-Za-z]+\.*\s+\d{1,2})\s*-\s*[A-Za-z0-9,\s]+/i);
  const gunMatch = section.match(/Gun\s+([A-Za-z]+\.*\s+\d{1,2})\s*-\s*\d{1,2}/i);
  const muzzleloaderMatch = section.match(/Muzzleloader\s+([A-Za-z]+\.*\s+\d{1,2})\s*-\s*\d{1,2}/i);

  if (!archeryMatch || !gunMatch || !muzzleloaderMatch) {
    throw new Error("Wisconsin opener parser could not confirm all three statewide opener dates.");
  }

  const archeryDate = parseMonthDay(archeryMatch[1], targetYear);
  const firearmDate = parseMonthDay(gunMatch[1], targetYear);
  const muzzleloaderDate = parseMonthDay(muzzleloaderMatch[1], targetYear);

  if (!archeryDate || !firearmDate || !muzzleloaderDate) {
    throw new Error("Wisconsin opener parser found text but could not convert one or more dates.");
  }

  return {
    stateName: "Wisconsin",
    source: "Wisconsin DNR deer season dates",
    seasons: uniqueSeasons([
      {
        type: "archery",
        date: archeryDate,
        title: "Wisconsin Archery / Crossbow Deer Opener",
        description: "Statewide archery and crossbow deer opener.",
        icon: "🏹"
      },
      {
        type: "firearm",
        date: firearmDate,
        title: "Wisconsin Gun Deer Opener",
        description: "Statewide gun deer opener.",
        icon: "🔫"
      },
      {
        type: "muzzleloader",
        date: muzzleloaderDate,
        title: "Wisconsin Muzzleloader Deer Opener",
        description: "Statewide muzzleloader deer opener.",
        icon: "💥"
      }
    ]),
    zipOverrides: currentEntry?.zipOverrides || {}
  };
}

async function fetchMinnesotaStatewideOpeners(currentEntry) {
  const targetYear = currentSeasonYear();

  const seasonsUrl = "https://www.dnr.state.mn.us/hunting/seasons.html";
  const firearmsUrl = "https://www.dnr.state.mn.us/gohunting/firearms-deer-hunting.html";

  const seasonsText = cleanText(await fetchText(seasonsUrl));
  const firearmsText = cleanText(await fetchText(firearmsUrl));

  const archeryRegex = new RegExp(String.raw`(\d{1,2}\/\d{1,2}\/${String(targetYear).slice(2)}|\d{1,2}\/\d{1,2}\/${targetYear})\s*-\s*\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})\s*Deer\s*-\s*Archery\s*Statewide`, "i");
  const muzzleRegex = new RegExp(String.raw`(\d{1,2}\/\d{1,2}\/${String(targetYear).slice(2)}|\d{1,2}\/\d{1,2}\/${targetYear})\s*-\s*\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})\s*Deer\s*-\s*Muzzleloader\s*Statewide`, "i");
  const firearmRegex = new RegExp(String.raw`(\d{1,2}\/\d{1,2}\/${String(targetYear).slice(2)}|\d{1,2}\/\d{1,2}\/${targetYear})\s*-\s*\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})\s*Deer\s*-\s*Firearm\s*\(Season A\)`, "i");

  const archeryMatch = seasonsText.match(archeryRegex);
  const muzzleMatch = seasonsText.match(muzzleRegex);

  const firearmMatches = [...firearmsText.matchAll(new RegExp(String.raw`(\d{1,2}\/\d{1,2}\/${String(targetYear).slice(2)}|\d{1,2}\/\d{1,2}\/${targetYear})\s*-\s*\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})\s*Deer\s*-\s*Firearm\s*\(Season A\)`, "ig"))];

  const fallbackFirearmMatch = seasonsText.match(firearmRegex);

  if (!archeryMatch || !muzzleMatch || (!firearmMatches.length && !fallbackFirearmMatch)) {
    throw new Error("Minnesota opener parser could not confirm all three statewide deer opener dates.");
  }

  const archeryDate = parseSlashDate(archeryMatch[1]);
  const muzzleloaderDate = parseSlashDate(muzzleMatch[1]);

  const firearmStartDates = firearmMatches.length
    ? firearmMatches.map((match) => parseSlashDate(match[1])).filter(Boolean)
    : [parseSlashDate(fallbackFirearmMatch[1])].filter(Boolean);

  const firearmDate = [...firearmStartDates].sort()[0] || null;

  if (!archeryDate || !firearmDate || !muzzleloaderDate) {
    throw new Error("Minnesota opener parser found text but could not convert one or more dates.");
  }

  return {
    stateName: "Minnesota",
    source: "Minnesota DNR hunting season dates",
    seasons: uniqueSeasons([
      {
        type: "archery",
        date: archeryDate,
        title: "Minnesota Archery Deer Opener",
        description: "Statewide deer archery opener.",
        icon: "🏹"
      },
      {
        type: "firearm",
        date: firearmDate,
        title: "Minnesota Firearms Deer Opener",
        description: "Earliest statewide firearms deer opener shown for Season A permit areas.",
        icon: "🔫"
      },
      {
        type: "muzzleloader",
        date: muzzleloaderDate,
        title: "Minnesota Muzzleloader Deer Opener",
        description: "Statewide muzzleloader deer opener.",
        icon: "💥"
      }
    ]),
    zipOverrides: currentEntry?.zipOverrides || {}
  };
}

const stateFetchers = {
  async MN(current) {
    return fetchMinnesotaStatewideOpeners(current);
  },
  async WI(current) {
    return fetchWisconsinStatewideOpeners(current);
  },
  async PA(current) {
    return null;
  },
  async TX(current) {
    return null;
  }
};

async function updateStates(existingStates) {
  const nextStates = { ...existingStates };

  for (const [stateCode, currentEntry] of Object.entries(existingStates)) {
    const fetcher = stateFetchers[stateCode];
    if (!fetcher) continue;

    try {
      const updated = await fetcher(currentEntry);
      if (!updated) continue;

      const normalized = {
        stateName: String(updated.stateName || currentEntry.stateName || "").trim(),
        source: String(updated.source || currentEntry.source || "").trim(),
        seasons: (Array.isArray(updated.seasons) ? updated.seasons : [])
          .map(normalizeSeason)
          .filter((season) => season.type && season.date && season.title),
        zipOverrides:
          updated.zipOverrides && typeof updated.zipOverrides === "object"
            ? updated.zipOverrides
            : (currentEntry.zipOverrides || {})
      };

      validateStateEntry(stateCode, normalized);
      nextStates[stateCode] = normalized;
      console.log(`Updated ${stateCode} opener data.`);
    } catch (error) {
      console.warn(`Skipped ${stateCode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return nextStates;
}

async function main() {
  const current = await readOpenersFile();

  if (!current || typeof current !== "object") {
    throw new Error("us-state-deer-openers.json must contain a top-level object");
  }

  const currentStates = current.states && typeof current.states === "object" ? current.states : {};

  for (const [stateCode, stateEntry] of Object.entries(currentStates)) {
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
  console.log("Updated data/us-state-deer-openers.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
