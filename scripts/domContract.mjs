// Lists the DOM contract the client JS expects: element ids, selectors and class names.
// Usage: node scripts/domContract.mjs [--missing]
//   (no flag)  prints every id / selector / class the JS touches, grouped by file
//   --missing  prints only ids that public/index.html does not define yet
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dirs = ["public/js", "shared"].map((d) => path.join(root, d));
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".js")) files.push(p);
  }
};
dirs.forEach(walk);

const idxPath = path.join(root, "public/index.html");
const indexHtml = fs.existsSync(idxPath) ? fs.readFileSync(idxPath, "utf8") : "";
const definedIds = new Set([...indexHtml.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));

const byFile = new Map();
const add = (file, kind, value) => {
  if (!byFile.has(file)) byFile.set(file, new Map());
  const m = byFile.get(file);
  const key = `${kind}\t${value}`;
  m.set(key, (m.get(key) || 0) + 1);
};

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const rel = path.relative(root, f).replaceAll("\\", "/");
  for (const m of src.matchAll(/getElementById\(\s*["'`]([^"'`$]+)["'`]\s*\)/g)) add(rel, "id", m[1]);
  for (const m of src.matchAll(/querySelector(?:All)?\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) add(rel, "selector", m[1]);
  for (const m of src.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*([^)]*)\)/g))
    for (const c of m[1].matchAll(/["']([\w-]+)["']/g)) add(rel, "class", c[1]);
  for (const m of src.matchAll(/\bclass(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g))
    for (const c of m[1].split(/\s+/)) if (/^[\w-]+$/.test(c)) add(rel, "class", c);
  for (const m of src.matchAll(/\bid=["']([\w-]+)["']/g)) add(rel, "id", m[1]);
}

const missingOnly = process.argv.includes("--missing");
for (const [file, entries] of [...byFile].sort()) {
  const rows = [...entries]
    .map(([k, n]) => [...k.split("\t"), n])
    .filter(([kind, value]) => !missingOnly || (kind === "id" && !definedIds.has(value)))
    .sort();
  if (!rows.length) continue;
  console.log(`\n# ${file}`);
  for (const [kind, value, n] of rows) console.log(`  ${kind.padEnd(8)} ${value}${n > 1 ? `  (x${n})` : ""}`);
}
