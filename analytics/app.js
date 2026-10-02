import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { championDB } from "../shared/data/championDB.js";
import { EMBLEMS } from "../shared/data/emblems/index.js";
import { PREBUILT_TEAMS } from "../shared/data/teams/index.js";
import { escapeHtml } from "../shared/ui/formatters.js";

const REFRESH_INTERVAL_MS = 30_000;

const emblemNameByKey = new Map(EMBLEMS.map((e) => [e.key, e.name]));

function championName(key) {
  return championDB[key]?.name || key;
}

// A transformation has its own row, labelled with the drafted champion that took it.
function championLabel(row) {
  const name = championName(row.champion_key);
  return row.form_of ? `${name} (forma de ${championName(row.form_of)})` : name;
}

// A comp is the same comp no matter what order its champions were picked
// in, so every grouping/lookup key goes through this canonical form.
function canonicalCompKey(compKey) {
  return compKey.split("|").filter(Boolean).sort().join("|");
}

const prebuiltNameByCompKey = new Map(
  PREBUILT_TEAMS.map((team) => [canonicalCompKey(team.champions.join("|")), team.name]),
);

function compChampionList(compKey) {
  return canonicalCompKey(compKey)
    .split("|")
    .map(championName)
    .join(", ");
}

function compLabel(compKey) {
  return prebuiltNameByCompKey.get(canonicalCompKey(compKey)) || compChampionList(compKey);
}

// Historical rows may have been stored before comp_key was normalized
// order-independently, so merge duplicates here rather than trust the DB grouping.
function mergeComps(rows) {
  const merged = new Map();
  for (const row of rows) {
    const key = canonicalCompKey(row.comp_key);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { comp_key: key, matches_played: 0, wins: 0, decisive_matches: 0 });
    }
    const entry = merged.get(key);
    entry.matches_played += Number(row.matches_played) || 0;
    entry.wins += Number(row.wins) || 0;
    entry.decisive_matches += Number(row.decisive_matches) || 0;
  }
  // Draws are neither wins nor losses, matching the database views.
  return Array.from(merged.values()).map((entry) => ({
    ...entry,
    win_rate: entry.decisive_matches > 0 ? entry.wins / entry.decisive_matches : null,
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

function countOf(value, singular, plural) {
  return `${num(value)} ${Number(value) === 1 ? singular : plural}`;
}

function cardMarkup({ label, value, detail = "", valueClass = "", cardClass = "" }) {
  return `<div class="card ${cardClass}">
    <div class="label">${label}</div>
    <div class="value ${valueClass}">${value}</div>
    ${detail ? `<div class="detail">${detail}</div>` : ""}
  </div>`;
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
function showTab(tab) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document
    .querySelectorAll(".tab-panel")
    .forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
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
// Several players can share the lead, so every one of them is named.
function topWinnerCard(players) {
  const label = "Jogador com mais vitórias";
  const mostWins = Math.max(0, ...players.map((p) => Number(p.wins) || 0));
  if (mostWins === 0) return { label, value: "—" };

  const leaders = players.filter((p) => Number(p.wins) === mostWins);
  const wins = countOf(mostWins, "vitória", "vitórias");
  return {
    label,
    value: leaders.map((p) => escapeHtml(p.username)).join(" e "),
    valueClass: "text",
    detail:
      leaders.length === 1
        ? `${wins} · ${pct(leaders[0].win_rate)} de win rate`
        : `${wins} cada`,
  };
}

function renderOverview(row, players) {
  const container = document.getElementById("overviewCards");
  if (!row) {
    container.innerHTML = `<div class="card"><div class="label">Sem dados</div></div>`;
    return;
  }
  const cards = [
    { label: "Partidas totais", value: num(row.total_matches) },
    { label: "Empates", value: num(row.draws) },
    topWinnerCard(players),
  ];
  container.innerHTML = cards.map(cardMarkup).join("");
}

// ----- champions -----
function renderChampionTable() {
  const rows = rowsByTable.get("championTable") || [];
  const search = document.getElementById("championSearch").value.trim().toLowerCase();
  const enriched = rows.map((r) => ({ ...r, name: championLabel(r) }));
  const filtered = search
    ? enriched.filter((r) => r.name.toLowerCase().includes(search))
    : enriched;
  const sorted = sortRows("championTable", filtered);

  document.getElementById("championTableBody").innerHTML = sorted
    .map(
      (r, i) => `<tr>
        <td class="rank-col">${i + 1}</td>
        <td>${
          r.form_of
            ? `${championName(r.champion_key)} <span class="form-of">(forma de ${championName(r.form_of)})</span>`
            : r.name
        }</td>
        <td>${r.form_of ? "—" : num(r.matches_in_roster)}</td>
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
        <td><button type="button" class="link-btn" data-player-key="${escapeHtml(r.player_key)}">${escapeHtml(r.username)}</button></td>
        <td>${num(r.matches_played)}</td>
        <td>${num(r.wins)}</td>
        <td class="win-rate ${winRateClass(r.win_rate)}">${pct(r.win_rate)}</td>
      </tr>`,
    )
    .join("");
}

// ----- profile -----
let selectedPlayerKey = null;
const profilePlayerSelect = document.getElementById("profilePlayer");

function favoriteChampionCard(profile) {
  const label = "Campeões favoritos";
  const champions = profile.favorite_champions || [];
  if (!champions.length) return { label, value: "—" };
  return {
    label,
    value: champions.map((c) => escapeHtml(championName(c.champion_key))).join(" · "),
    valueClass: "text",
    detail: champions
      .map(
        (c) =>
          `${escapeHtml(championName(c.champion_key))}: ${countOf(c.on_field, "partida", "partidas")} em campo · ${num(c.in_roster)} no roster`,
      )
      .join("<br>"),
  };
}

// Named after the player's own saved team holding exactly this comp, else
// after a prebuilt team, else listed champion by champion.
function favoriteTeamCard(profile) {
  const label = "Time favorito";
  if (!profile.favorite_comp_key) return { label, value: "—", cardClass: "wide" };

  const record = `${countOf(profile.favorite_comp_matches, "partida", "partidas")} · ${countOf(profile.favorite_comp_wins, "vitória", "vitórias")} · ${pct(profile.favorite_comp_win_rate)} de win rate`;
  const teamName =
    profile.favorite_team_name ||
    prebuiltNameByCompKey.get(canonicalCompKey(profile.favorite_comp_key));
  const championList = compChampionList(profile.favorite_comp_key);
  return {
    label,
    value: teamName ? escapeHtml(teamName) : championList,
    valueClass: "text",
    detail: teamName ? `${championList}<br>${record}` : record,
    cardClass: "wide",
  };
}

function renderProfile() {
  const profiles = rowsByTable.get("profiles") || [];
  const container = document.getElementById("profileCards");
  if (!profiles.some((p) => p.player_key === selectedPlayerKey)) {
    selectedPlayerKey = profiles[0]?.player_key ?? null;
  }

  profilePlayerSelect.innerHTML = profiles
    .map(
      (p) => `<option value="${escapeHtml(p.player_key)}">${escapeHtml(p.username)}</option>`,
    )
    .join("");
  profilePlayerSelect.value = selectedPlayerKey ?? "";

  const profile = profiles.find((p) => p.player_key === selectedPlayerKey);
  if (!profile) {
    container.innerHTML = `<div class="card"><div class="label">Sem dados</div></div>`;
    return;
  }
  const cards = [
    { label: "Partidas", value: num(profile.matches_played) },
    { label: "Vitórias", value: num(profile.wins) },
    {
      label: "Win rate",
      value: pct(profile.win_rate),
      valueClass: `win-rate ${winRateClass(profile.win_rate)}`,
    },
    favoriteChampionCard(profile),
    favoriteTeamCard(profile),
  ];
  container.innerHTML = cards.map(cardMarkup).join("");
}

profilePlayerSelect.addEventListener("change", () => {
  selectedPlayerKey = profilePlayerSelect.value;
  renderProfile();
});

document.getElementById("playerTableBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-key]");
  if (!button) return;
  selectedPlayerKey = button.dataset.playerKey;
  renderProfile();
  showTab("profile");
});

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
      supabase.from("v_player_profile").select("*"),
    ]);

    const errors = [overview, champions, emblems, comps, players]
      .map((r) => r.error)
      .filter(Boolean);
    if (errors.length > 0) throw errors[0];

    const playerRows = players.data || [];
    renderOverview(overview.data, playerRows);

    rowsByTable.set("championTable", champions.data || []);
    rowsByTable.set("emblemTable", emblems.data || []);
    rowsByTable.set("compTable", mergeComps(comps.data || []));
    rowsByTable.set("playerTable", playerRows);
    rowsByTable.set("profiles", playerRows);

    renderChampionTable();
    renderEmblemTable();
    renderCompTable();
    renderPlayerTable();
    renderProfile();

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
