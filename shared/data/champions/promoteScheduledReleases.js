import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const CHAMPIONS_DIR = path.dirname(fileURLToPath(import.meta.url));

const UNRELEASED_LINE = /^[ \t]*unreleased:\s*true,\s*$/;
const RELEASE_DATE = /releaseDate:\s*"(\d{4}-\d{2}-\d{2})"/;

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Strips the `unreleased: true` line from a champion's data.js once its
 * releaseDate has arrived. Also collapses the now-redundant blank line so
 * the file reads the same as a champion that was never gated at all.
 */
function promoteFile(filePath, today) {
  const content = fs.readFileSync(filePath, "utf8");

  const releaseDateMatch = content.match(RELEASE_DATE);
  if (!releaseDateMatch || releaseDateMatch[1] > today) return false;

  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r\n|\n/);
  const idx = lines.findIndex((line) => UNRELEASED_LINE.test(line));
  if (idx === -1) return false;

  lines.splice(idx, 1);
  const prevBlank = idx > 0 && lines[idx - 1].trim() === "";
  const nextBlank = idx < lines.length && lines[idx].trim() === "";
  if (prevBlank && nextBlank) lines.splice(idx, 1);

  fs.writeFileSync(filePath, lines.join(eol), "utf8");
  return true;
}

/**
 * Scans every champion's data.js at boot and auto-promotes the ones whose
 * releaseDate has arrived, rewriting the file to drop `unreleased: true`.
 * Must run before championDB.js is imported so the promotion is reflected
 * in the same boot that performs it.
 */
export function promoteScheduledReleases() {
  const today = todayDateString();
  const promoted = [];

  for (const entry of fs.readdirSync(CHAMPIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dataPath = path.join(CHAMPIONS_DIR, entry.name, "data.js");
    if (!fs.existsSync(dataPath)) continue;
    if (promoteFile(dataPath, today)) promoted.push(entry.name);
  }

  if (promoted.length > 0) {
    console.log(
      `[release] Auto-promoted ${promoted.length} champion(s) scheduled for today or earlier: ${promoted.join(", ")}`,
    );
  }
}

promoteScheduledReleases();
