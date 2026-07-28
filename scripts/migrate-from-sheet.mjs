#!/usr/bin/env node
/**
 * One-off migration: Google Spreadsheet (previous data storage) -> SpacetimeDB.
 *
 * The spreadsheet is the current source of truth, so this import *overrides*
 * what is already in the database: spots are replaced by the spreadsheet's
 * columns and every reservation on a date covered by the spreadsheet is deleted
 * before the spreadsheet's reservations are inserted.
 *
 * Spreadsheet layout (one tab per year, named after the year):
 *
 *   |            |     | -1/070 |  X  | -1/067 | ...   <- header row: spot names
 *   | 2026-01-01 | Thu |        |  X  | Matěj  | ...
 *   ^ date         ^ day  ^ occupant cells
 *
 * Columns whose header is "X" are visual dividers in the sheet, not spots, and
 * are skipped. Empty cells mean the spot is free.
 *
 * Usage:
 *   node scripts/migrate-from-sheet.mjs                  # dry run for the current year
 *   node scripts/migrate-from-sheet.mjs --year 2026      # dry run for a given year
 *   node scripts/migrate-from-sheet.mjs --apply          # actually write to the database
 *   node scripts/migrate-from-sheet.mjs --apply --wipe   # also delete reservations on dates
 *                                                        #   the spreadsheet does not cover
 *   node scripts/migrate-from-sheet.mjs --csv ./2026.csv # read a downloaded CSV instead
 *   node scripts/migrate-from-sheet.mjs --server local   # target a local SpacetimeDB
 *
 * Requires the `spacetime` CLI, logged in with an identity that may call the
 * module's reducers (`spacetime login`).
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** The legacy spreadsheet. Was `GOOGLE_SHEET_ID` before the SpacetimeDB migration. */
const SHEET_ID = "1iBTebUuupU9v9FFKdmU5ULozFy_enTDsKNxmRzLYiPk";

/**
 * Spreadsheet columns to leave out of the database, by spot code.
 *
 * Matched against the code part of a header cell, so an annotated header
 * ("♿️\n-1/069") is ignored just the same as a plain one.
 */
const IGNORED_SPOTS = ["-1/069", "-1/068"];

/** Reservations per `importReservations` call. Keeps each transaction small. */
const BATCH_SIZE = 200;

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    year: new Date().getFullYear(),
    apply: false,
    wipe: false,
    removeMissingSpots: false,
    csv: null,
    module: process.env.PUBLIC_SPACETIMEDB_MODULE || "nice-parking",
    server: null,
  };

  // A missing or flag-shaped value would otherwise be swallowed silently —
  // `--csv --apply` must not read the live sheet *and* turn off --apply.
  const value = (flag, next) => {
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`${flag} needs a value`);
    }
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--apply":
        opts.apply = true;
        break;
      case "--wipe":
        opts.wipe = true;
        break;
      case "--remove-missing-spots":
        opts.removeMissingSpots = true;
        break;
      case "--year":
        opts.year = Number(value(arg, argv[++i]));
        break;
      case "--csv":
        opts.csv = value(arg, argv[++i]);
        break;
      case "--module":
        opts.module = value(arg, argv[++i]);
        break;
      case "--server":
        opts.server = value(arg, argv[++i]);
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(opts.year) || opts.year < 2000 || opts.year > 2100) {
    throw new Error(`--year must be a 4-digit year`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Reading the spreadsheet
// ---------------------------------------------------------------------------

/**
 * Fetch one year tab as CSV.
 *
 * Uses the sheet's CSV export endpoint, which needs no OAuth as long as the
 * spreadsheet is link-shared — the app itself no longer holds a Sheets scope.
 */
async function fetchSheetCsv(sheetId, year) {
  // headers=1 pins the first row as the header instead of letting Google guess:
  // a wrong guess would shift every row and turn the spot list into junk.
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=out:csv&headers=1&sheet=${encodeURIComponent(String(year))}`;

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Could not read the spreadsheet (HTTP ${res.status}). Check that the ` +
        `sheet is link-shared and that a tab named "${year}" exists, or pass ` +
        `--csv with a downloaded export.`,
    );
  }

  const body = await res.text();
  if (body.trimStart().startsWith("<")) {
    throw new Error(
      "The spreadsheet returned an HTML page instead of CSV — it is probably " +
        "not link-shared. Download the tab as CSV and pass it with --csv.",
    );
  }
  return body;
}

/** Parse CSV, honouring quoted fields (cells contain commas and newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Normalise a header cell into a spot name.
 *
 * Header cells wrap onto several lines and may carry an annotation such as the
 * accessible-spot emoji; the spot code is put first so names match what the
 * database already uses (e.g. "♿️\n-1/063" -> "-1/063 ♿️").
 */
function normaliseSpotName(header) {
  const parts = header
    .split("\n")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);

  if (parts.length <= 1) return parts[0] ?? "";

  const codeIndex = parts.findIndex((part) => /^-?\d+\/\d+$/.test(part));
  if (codeIndex === -1) return parts.join(" ");

  const [code] = parts.splice(codeIndex, 1);
  return [code, ...parts].join(" ");
}

/** The bare spot code of a normalised name ("-1/063 ♿️" -> "-1/063"). */
function spotCode(name) {
  return name.split(" ")[0];
}

/** Build YYYY-MM-DD, rejecting anything that is not a real calendar date. */
function toIsoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));

  // Catches month 13, 31 February, and similar
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Normalise a date cell to YYYY-MM-DD.
 *
 * Returns null for a cell that is not a date at all, and throws for one that
 * looks like a date but cannot be read unambiguously — guessing there would
 * silently store reservations on the wrong day.
 */
function normaliseDate(value) {
  const raw = value.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const date = toIsoDate(y, m, d);
    if (!date) throw new Error(`"${raw}" is not a real date`);
    return date;
  }

  // Czech locale export: D.M.YYYY
  const dotted = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (dotted) {
    const [, d, m, y] = dotted;
    const date = toIsoDate(y, m, d);
    if (!date) throw new Error(`"${raw}" is not a real date (read as D.M.Y)`);
    return date;
  }

  // A/B/YYYY is ambiguous between D/M/Y and M/D/Y. Only accept it when one of
  // the two parts cannot be a month; otherwise refuse rather than transpose.
  const slashed = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashed) {
    const [, a, b, y] = slashed;
    const first = Number(a);
    const second = Number(b);

    if (first > 12 && second <= 12) {
      const date = toIsoDate(y, second, first); // D/M/Y
      if (!date) throw new Error(`"${raw}" is not a real date`);
      return date;
    }
    if (second > 12 && first <= 12) {
      const date = toIsoDate(y, first, second); // M/D/Y
      if (!date) throw new Error(`"${raw}" is not a real date`);
      return date;
    }
    throw new Error(
      `"${raw}" is ambiguous (D/M/Y or M/D/Y?) — re-export the sheet with ` +
        `ISO dates (YYYY-MM-DD), or fix the cell`,
    );
  }

  return null;
}

/**
 * Turn the sheet's rows into the spot list and the reservations to import.
 */
function extractData(rows, year) {
  if (rows.length < 2) {
    throw new Error("The sheet has no data rows");
  }

  const header = rows[0];
  const warnings = [];

  // Columns C onwards hold spots; header "X" marks a divider, not a spot.
  const spotColumns = [];
  const ignored = [];
  for (let col = 2; col < header.length; col++) {
    const name = normaliseSpotName(header[col]);
    if (!name || name === "X") continue;
    if (IGNORED_SPOTS.includes(spotCode(name))) {
      ignored.push(name);
      continue;
    }
    spotColumns.push({ col, name });
  }

  if (spotColumns.length === 0) {
    throw new Error("No spot columns found in the header row");
  }

  const duplicates = spotColumns
    .map((s) => s.name)
    .filter((name, i, all) => all.indexOf(name) !== i);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate spot names in the header: ${duplicates.join(", ")}`,
    );
  }

  const dates = [];
  const seenDates = new Set();

  // Keyed per (spot, date) so a later duplicate row genuinely wins, including
  // when its cell is blank. Spot names contain spaces, hence the \0 separator.
  const entries = new Map();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const raw = (row[0] ?? "").trim();

    let date;
    try {
      date = normaliseDate(raw);
    } catch (err) {
      throw new Error(`Row ${r + 1}: ${err.message}`);
    }

    if (!date) {
      if (raw) {
        warnings.push(`Row ${r + 1}: unrecognised date "${raw}" — skipped`);
      }
      continue;
    }
    if (!date.startsWith(`${year}-`)) {
      throw new Error(
        `Row ${r + 1}: date ${date} is not in ${year} — wrong tab, or the ` +
          `sheet's date format was misread`,
      );
    }
    if (seenDates.has(date)) {
      warnings.push(`Row ${r + 1}: duplicate date ${date} — later row wins`);
    } else {
      seenDates.add(date);
      dates.push(date);
    }

    for (const { col, name } of spotColumns) {
      const occupant = (row[col] ?? "").replace(/\s+/g, " ").trim();
      const key = `${name}\0${date}`;

      // A blank cell means free — and on a duplicate date it has to clear what
      // an earlier row put there, or the import becomes a merge of both rows.
      if (!occupant) {
        entries.delete(key);
        continue;
      }

      // "X" in a cell means the spot was blocked out, not reserved by someone.
      if (occupant === "X") {
        warnings.push(`${date} ${name}: cell is "X" (blocked) — skipped`);
        entries.delete(key);
        continue;
      }

      entries.set(key, { spotName: name, date, occupant });
    }
  }

  if (dates.length === 0) {
    throw new Error(
      "No dated rows found — is the first column of the sheet the date?",
    );
  }

  return {
    spots: spotColumns.map((s) => s.name),
    ignored,
    dates,
    entries: [...entries.values()],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Writing to SpacetimeDB
// ---------------------------------------------------------------------------

/**
 * Build a `spacetime` argument list. Flags have to come after the subcommand,
 * and an explicit --server also means ignoring the project's spacetime.json
 * (which pins the server and its database names).
 */
function spacetimeArgs(opts, subcommand, rest) {
  return [
    subcommand,
    // -y: execFile gives the CLI no usable stdin, so a prompt would hang or die
    "-y",
    ...(opts.server ? ["--server", opts.server, "--no-config"] : []),
    ...rest,
  ];
}

async function callReducer(opts, reducer, args) {
  const cliArgs = spacetimeArgs(opts, "call", [
    opts.module,
    reducer,
    ...args.map((arg) => JSON.stringify(arg)),
  ]);

  try {
    // A full year of reservations is well under the argv limit once batched.
    const { stderr } = await execFileAsync("spacetime", cliArgs, {
      maxBuffer: 32 * 1024 * 1024,
    });
    const noise = (stderr || "")
      .split("\n")
      .filter(
        (line) =>
          line.trim() &&
          !line.includes("new version of SpacetimeDB") &&
          !line.includes("spacetime version upgrade") &&
          !line.includes("UNSTABLE"),
      );
    if (noise.length > 0) console.log(noise.join("\n"));
  } catch (err) {
    const detail = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `spacetime call ${reducer} failed:\n${detail || err.message}`,
    );
  }
}

/** Run a read-only query and return its rows as arrays of cell strings. */
async function query(opts, sql) {
  const cliArgs = spacetimeArgs(opts, "sql", [opts.module, sql]);
  const { stdout } = await execFileAsync("spacetime", cliArgs, {
    maxBuffer: 64 * 1024 * 1024,
  });

  // Output is a text table: header row, a ---+--- separator, then the rows.
  const lines = stdout.split("\n");
  const separator = lines.findIndex(
    (line) =>
      /^[\s-]*-[\s-]*$/.test(line.replace(/\+/g, "-")) && line.includes("-"),
  );
  if (separator === -1) return [];

  return lines
    .slice(separator + 1)
    .filter((line) => line.trim())
    .map((line) =>
      line.split("|").map((cell) => cell.trim().replace(/^"|"$/g, "")),
    );
}

/** Row count of a table, or null if the query failed. */
async function countRows(opts, table) {
  try {
    const rows = await query(opts, `SELECT COUNT(*) AS n FROM ${table}`);
    const n = Number(rows[0]?.[0]);
    return Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

/** Names of the spots currently in the database, or null if the query failed. */
async function existingSpotNames(opts) {
  try {
    const rows = await query(opts, "SELECT name FROM spot");
    return rows.map((row) => row[0]).filter((name) => name);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const USAGE = `Migrate the legacy Google Spreadsheet into SpacetimeDB.

  --year <YYYY>    Sheet tab to import (default: current year)
  --csv <path>     Read a downloaded CSV export instead of fetching the sheet
  --apply          Write to the database (without this it is a dry run)
  --wipe           Delete every existing reservation, not just those on
                   dates the sheet covers
  --remove-missing-spots
                   Delete spots that the sheet no longer lists, together with
                   all of their reservations on any date
  --module <name>  Target database (default: $PUBLIC_SPACETIMEDB_MODULE)
  --server <name>  SpacetimeDB server, e.g. "local"
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const source = opts.csv
    ? `CSV file ${opts.csv}`
    : `spreadsheet ${SHEET_ID}, tab "${opts.year}"`;
  console.log(`Reading ${source}`);

  const csv = opts.csv
    ? await readFile(opts.csv, "utf8")
    : await fetchSheetCsv(SHEET_ID, opts.year);

  const { spots, ignored, dates, entries, warnings } = extractData(
    parseCsv(csv),
    opts.year,
  );

  const occupants = new Set(entries.map((e) => e.occupant));
  console.log(`\n  Spots        ${spots.length}: ${spots.join(", ")}`);
  if (ignored.length > 0) {
    console.log(`  Ignored      ${ignored.join(", ")}`);
  }
  console.log(
    `  Dates        ${dates.length} (${dates[0]} … ${dates[dates.length - 1]})`,
  );
  console.log(
    `  Reservations ${entries.length} across ${occupants.size} people`,
  );

  if (warnings.length > 0) {
    console.log(`\n  ${warnings.length} warning(s):`);
    for (const warning of warnings.slice(0, 20))
      console.log(`    - ${warning}`);
    if (warnings.length > 20) {
      console.log(`    … and ${warnings.length - 20} more`);
    }
  }

  const target = `${opts.module}${opts.server ? ` on ${opts.server}` : ""}`;

  // Compare against the database before doing anything destructive.
  const dbSpots = await existingSpotNames(opts);
  const missing = dbSpots ? dbSpots.filter((n) => !spots.includes(n)) : [];

  if (dbSpots && dbSpots.length > 0) {
    const overlap = spots.filter((name) => dbSpots.includes(name));
    if (overlap.length === 0) {
      throw new Error(
        `None of the ${spots.length} parsed spot names match the ${dbSpots.length} ` +
          `already in ${target} (${dbSpots.join(", ")}). That usually means the ` +
          `header row was misread — refusing to touch the database.`,
      );
    }
    if (missing.length > 0) {
      console.log(
        `\n  In the database but not in the sheet: ${missing.join(", ")}` +
          (opts.removeMissingSpots
            ? `\n  --remove-missing-spots: these and ALL their reservations will be deleted.`
            : `\n  These are left untouched. Pass --remove-missing-spots to delete them` +
              ` and all of their reservations.`),
      );
    }
  }

  if (!opts.apply) {
    console.log(
      `\nDry run — nothing written. Re-run with --apply to overwrite ${target}.`,
    );
    return;
  }

  const before = {
    spots: await countRows(opts, "spot"),
    reservations: await countRows(opts, "reservation"),
  };
  console.log(
    `\nTarget ${target} currently holds ` +
      `${before.spots ?? "?"} spots and ${before.reservations ?? "?"} reservations.`,
  );

  console.log(`\nReplacing spots…`);
  await callReducer(opts, "import_spots", [spots, opts.removeMissingSpots]);

  // From here on the database is mid-migration: reservations are deleted before
  // they are re-inserted, and each batch is its own transaction. Re-running the
  // same command repairs a partial run (the clear + insert is idempotent), so
  // say that loudly rather than leaving a half-empty table unexplained.
  let cleared = false;
  try {
    console.log(
      opts.wipe
        ? `Deleting all existing reservations…`
        : `Deleting existing reservations on the ${dates.length} dates covered by the sheet…`,
    );
    await callReducer(opts, "clear_reservations", [
      opts.wipe ? [] : dates,
      opts.wipe,
    ]);
    cleared = true;

    console.log(`Importing ${entries.length} reservations…`);
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      // The HTTP/CLI interface names reducer fields in snake_case.
      const batch = entries.slice(i, i + BATCH_SIZE).map((entry) => ({
        spot_name: entry.spotName,
        date: entry.date,
        occupant: entry.occupant,
      }));
      await callReducer(opts, "import_reservations", [batch]);
      console.log(
        `  ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`,
      );
    }
  } catch (err) {
    if (cleared) {
      err.message +=
        `\n\nThe import stopped part-way: reservations were already deleted but ` +
        `not all were re-inserted, so ${target} is INCOMPLETE right now. ` +
        `Re-run the same command to finish it.`;
    }
    throw err;
  }

  const after = {
    spots: await countRows(opts, "spot"),
    reservations: await countRows(opts, "reservation"),
  };
  console.log(
    `\nDone. ${target} now holds ${after.spots ?? "?"} spots and ` +
      `${after.reservations ?? "?"} reservations.`,
  );

  if (after.reservations !== null && after.reservations < entries.length) {
    console.log(
      `\nWarning: expected at least ${entries.length} reservations — ` +
        `check the reducer output above.`,
    );
  }
}

main().catch((err) => {
  console.error(`\nMigration failed: ${err.message}`);
  process.exitCode = 1;
});
