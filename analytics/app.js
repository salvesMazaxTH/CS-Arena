import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { championDB } from "../shared/data/championDB.js";
import { EMBLEMS } from "../shared/data/emblems/index.js";
import { PREBUILT_TEAMS } from "../shared/data/teams/index.js";

const REFRESH_INTERVAL_MS = 30_000;

const emblemNameByKey = new Map(EMBLEMS.map((e) => [e.key, e.name]));

function championName(key) {
  return championDB[key]?.name || key;
}

// A comp is the same comp no matter what order its champions were picked
// in, so every grouping/lookup key goes through this canonical form.
function canonicalCompKey(compKey) {
  return compKey.split("|").filter(Boolean).sort().join("|");
}

const prebuiltNameByCompKey = new Map(
  PREBUILT_TEAMS.map((team) => [canonicalCompKey(team.champions.join("|")), team.name]),
);

function compLabel(compKey) {
  const canonical = canonicalCompKey(compKey);
  const prebuiltName = prebuiltNameByCompKey.get(canonical);
  if (prebuiltName) return prebuiltName;
  return canonical
    .split("|")
    .map(championName)
    .join(", ");
}

// Historical rows may have been stored before comp_key was normalized
// order-independently, so merge duplicates here rather than trust the DB grouping.
function mergeComps(rows) {
  const merged = new Map();
  for (const row of rows) {
    const key = canonicalCompKey(row.comp_key);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { comp_key: key, matches_played: 0, wins: 0 });
    }
    const entry = merged.get(key);
    entry.matches_played += Number(row.matches_played) || 0;
    entry.wins += Number(row.wins) || 0;
  }
  return Array.from(merged.values()).map((entry) => ({
    ...entry,
    win_rate: entry.matches_played > 0 ? entry.wins / entry.matches_played : null,
  }));
}

function pct(ratio) {
  if (ratio === null || ratio === undefined) return "—";
  return `${(Number(ratio) * 100).toFixed(1)}%`;
}

function winRateClass(ratio) {
  if (ratio === null || ratio === undefined) return "";
  return Number(ratio) >= 0.5 ? "good" : "bad";
}

function num(value) {
  return Math.round(Number(value) || 0).toLocaleString("pt-BR");
}

const statusLine = document.getElementById("statusLine");
const refreshBtn = document.getElementById("refreshBtn");

function setStatus(text, isError = false) {
  statusLine.textContent = text;
  statusLine.classList.toggle("error", isError);
}

let supabase = null;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  setStatus(
    "Configuração ausente: preencha analytics/config.js com a URL e a anon key do Supabase.",
    true,
  );
} else {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

// ----- tabs -----
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ----- sortable tables -----
const sortState = new Map(); // tableId -> { key, dir }
const rowsByTable = new Map(); // tableId -> raw rows array

function attachSorting(tableId, renderFn) {
  const table = document.getElementById(tableId);
  table.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      const current = sortState.get(tableId) || {};
      const dir = current.key === key && current.dir === "desc" ? "asc" : "desc";
      sortState.set(tableId, { key, dir });
      updateSortIndicators(tableId);
      renderFn();
    });
  });
  updateSortIndicators(tableId);
}

function updateSortIndicators(tableId) {
  const table = document.getElementById(tableId);
  const state = sortState.get(tableId);
  table.querySelectorAll("th[data-sort]").forEach((th) => {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (state && th.dataset.sort === state.key) {
      th.classList.add(state.dir === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}

function sortRows(tableId, rows) {
  const state = sortState.get(tableId);
  if (!state) return rows;
  const { key, dir } = state;
  const sorted = [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "string" || typeof bv === "string") {
      return String(av ?? "").localeCompare(String(bv ?? ""));
    }
    return (Number(av) || 0) - (Number(bv) || 0);
  });
  if (dir === "desc") sorted.reverse();
  return sorted;
}

// ----- overview -----
function renderOverview(row) {
  const container = document.getElementById("overviewCards");
  if (!row) {
    container.innerHTML = `<div class="card"><div class="label">Sem dados</div></div>`;
    return;
  }
  const cards = [
    { label: "Partidas totais", value: num(row.total_matches) },
    { label: "Empates", value: num(row.draws) },
    { label: "Win rate time 1", value: pct(row.team1_win_rate) },
    { label: "Win rate time 2", value: pct(row.team2_win_rate) },
  ];
  container.innerHTML = cards
    .map(
      (c) => `<div class="card"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`,
    )
    .join("");
}

// ----- champions -----
function renderChampionTable() {
  const rows = rowsByTable.get("championTable") || [];
  const search = document.getElementById("championSearch").value.trim().toLowerCase();
  const enriched = rows.map((r) => ({ ...r, name: championName(r.champion_key) }));
  const filtered = search
    ? enriched.filter((r) => r.name.toLowerCase().includes(search))
    : enriched;
  const sorted = sortRows("championTable", filtered);

  document.getElementById("championTableBody").innerHTML = sorted
    .map(
      (r, i) => `<tr>
        <td class="rank-col">${i + 1}</td>
        <td>${r.name}</td>
        <td>${num(r.matches_in_roster)}</td>
        <td class="win-rate ${winRateClass(r.roster_win_rate)}">${pct(r.roster_win_rate)}</td>
        <td>${num(r.matches_materialized)}</td>
        <td class="win-rate ${winRateClass(r.materialized_win_rate)}">${pct(r.materialized_win_rate)}</td>
        <td>${num(r.total_damage)}</td>
        <td>${num(r.total_healing_done)}</td>
        <td>${num(r.total_healing_received)}</td>
        <td>${num(r.total_raw_taken)}</td>
        <td>${num(r.total_damage_mitigated)}</td>
        <td>${num(r.total_points)}</td>
      </tr>`,
    )
    .join("");
}

// ----- emblems -----
function renderEmblemTable() {
  const rows = rowsByTable.get("emblemTable") || [];
  const enriched = rows.map((r) => ({
    ...r,
    name: emblemNameByKey.get(r.emblem_key) || r.emblem_key,
  }));
  const sorted = sortRows("emblemTable", enriched);
  document.getElementById("emblemTableBody").innerHTML = sorted
    .map(
      (r, i) => `<tr>
        <td class="rank-col">${i + 1}</td>
        <td>${r.name}</td>
        <td>${num(r.matches_played)}</td>
        <td>${num(r.wins)}</td>
        <td class="win-rate ${winRateClass(r.win_rate)}">${pct(r.win_rate)}</td>
      </tr>`,
    )
    .join("");
}

// ----- comps -----
function renderCompTable() {
  const rows = rowsByTable.get("compTable") || [];
  const sorted = sortRows("compTable", rows);
  document.getElementById("compTableBody").innerHTML = sorted
    .map(
      (r, i) => `<tr>
        <td class="rank-col">${i + 1}</td>
        <td>${compLabel(r.comp_key)}</td>
        <td>${num(r.matches_played)}</td>
        <td>${num(r.wins)}</td>
        <td class="win-rate ${winRateClass(r.win_rate)}">${pct(r.win_rate)}</td>
      </tr>`,
    )
    .join("");
}

// ----- players -----
function renderPlayerTable() {
  const rows = rowsByTable.get("playerTable") || [];
  const sorted = sortRows("playerTable", rows);
  document.getElementById("playerTableBody").innerHTML = sorted
    .map(
      (r, i) => `<tr>
        <td class="rank-col">${i + 1}</td>
        <td>${r.username}</td>
        <td>${num(r.matches_played)}</td>
        <td>${num(r.wins)}</td>
        <td class="win-rate ${winRateClass(r.win_rate)}">${pct(r.win_rate)}</td>
      </tr>`,
    )
    .join("");
}

attachSorting("championTable", renderChampionTable);
attachSorting("emblemTable", renderEmblemTable);
attachSorting("compTable", renderCompTable);
attachSorting("playerTable", renderPlayerTable);

document
  .getElementById("championSearch")
  .addEventListener("input", renderChampionTable);

async function loadAll() {
  if (!supabase) return;
  setStatus("atualizando...");

  try {
    const [overview, champions, emblems, comps, players] = await Promise.all([
      supabase.from("v_overall_summary").select("*").maybeSingle(),
      supabase.from("v_champion_overall").select("*"),
      supabase.from("v_emblem_winrate").select("*"),
      supabase.from("v_comp_winrate").select("*"),
      supabase.from("v_player_winrate").select("*"),
    ]);

    const errors = [overview, champions, emblems, comps, players]
      .map((r) => r.error)
      .filter(Boolean);
    if (errors.length > 0) throw errors[0];

    renderOverview(overview.data);

    rowsByTable.set("championTable", champions.data || []);
    rowsByTable.set("emblemTable", emblems.data || []);
    rowsByTable.set("compTable", mergeComps(comps.data || []));
    rowsByTable.set("playerTable", players.data || []);

    renderChampionTable();
    renderEmblemTable();
    renderCompTable();
    renderPlayerTable();

    const now = new Date().toLocaleTimeString("pt-BR");
    setStatus(`atualizado às ${now}`);
  } catch (err) {
    console.error("[analytics] falha ao carregar:", err);
    setStatus(`erro ao carregar: ${err.message || err}`, true);
  }
}

refreshBtn.addEventListener("click", loadAll);

if (supabase) {
  loadAll();
  setInterval(loadAll, REFRESH_INTERVAL_MS);
}
