import { championDB } from "/shared/data/championDB.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";
import { validateTeamComposition } from "/shared/data/teams/index.js";
import { applyIdentityPaletteCssVariables } from "/shared/ui/identityPalette.js";
import { TeamStore } from "./teamsManager/TeamStore.js";
import { TeamBuilder } from "./teamsManager/TeamBuilder.js";
import { escapeHtml } from "./teamsManager/championCardMarkup.js";
import { renderTeamSummary } from "./ui/teamCard.js";
import { readMirroredEditMode } from "./editModeMirror.js";
import { getSession, supabase } from "./auth/session.js";
import { getLocale, setLocale } from "./i18n/clientLocale.js";

applyIdentityPaletteCssVariables(document.documentElement);

// The Team Manager has no socket, so it reads the UI-safe editMode the game
// client mirrored to localStorage — this is what lets unreleased champions be
// drafted while `unavailableChampions` is on for testing.
const clientEditMode = readMirroredEditMode();
const store = new TeamStore();

const listView = document.getElementById("tm-list-view");
const builderView = document.getElementById("tm-builder-view");
const prebuiltGrid = document.getElementById("tm-prebuilt-grid");
const customGrid = document.getElementById("tm-custom-grid");
const customEmpty = document.getElementById("tm-custom-empty");
const newTeamBtn = document.getElementById("tm-new-team");
const toast = document.getElementById("tm-toast");

const builder = new TeamBuilder({
  root: builderView,
  editMode: clientEditMode,
  onSave: (team) => {
    const saved = store.saveCustom(team);
    if (!saved) {
      flashToast(teamLimitMessage());
      return;
    }
    store.setSelectedId(saved.id);
    showList();
    flashToast(`"${saved.name}" saved.`);
  },
  onCancel: showList,
  onNotify: flashToast,
});

function teamValidity(team) {
  return validateTeamComposition(team, {
    championDB,
    emblems: EMBLEMS,
    editMode: clientEditMode,
  });
}

// team id -> { matches, wins, losses, draws }, filled from the account.
let teamStats = new Map();

async function loadTeamStats() {
  const { data, error } = await supabase.rpc("my_team_stats");
  if (error) throw error;
  teamStats = new Map((data ?? []).map((row) => [row.team_id, row]));
}

// Dev preview: fill every card with made-up records to check the layout
// without playing matches. Nothing is written to the account.
if (clientEditMode.enabled) {
  window.previewTeamStats = () => {
    const samples = [
      { matches: 12, wins: 7, losses: 5, draws: 0 },
      { matches: 1, wins: 1, losses: 0, draws: 0 },
      { matches: 9, wins: 2, losses: 6, draws: 1 },
      { matches: 2, wins: 0, losses: 0, draws: 2 },
      null,
    ];
    teamStats = new Map(
      store
        .getAll()
        .map((team, i) => [team.id, samples[i % samples.length]])
        .filter(([, stats]) => stats),
    );
    renderList();
  };
  window.resetTeamStats = () => loadTeamStats().then(renderList);
}

function renderTeamStats(team) {
  const stats = teamStats.get(team.id);
  if (!stats || !stats.matches) {
    return `<div class="tm-record is-empty">No matches played with this team yet.</div>`;
  }
  const decisive = stats.wins + stats.losses;
  const winrate = decisive ? Math.round((stats.wins / decisive) * 100) : null;
  const draws = stats.draws ? `, ${stats.draws} ${stats.draws === 1 ? "draw" : "draws"}` : "";
  const matchWord = stats.matches === 1 ? "match" : "matches";
  return `
    <div class="tm-record" aria-label="${winrate ?? 0}% winrate over ${stats.matches} ${matchWord}">
      <strong class="tm-record-rate">${winrate === null ? "–" : `${winrate}%`}</strong>
      <div class="tm-record-detail">
        <div class="tm-record-bar${decisive ? "" : " is-neutral"}" style="--win: ${decisive ? stats.wins / decisive : 0}">
          <span class="tm-record-bar-win"></span>
        </div>
        <span class="tm-record-line">
          <b class="is-win">${stats.wins}W</b>
          <b class="is-loss">${stats.losses}L</b>
          <span>in ${stats.matches} ${matchWord}${draws}</span>
        </span>
      </div>
    </div>`;
}

function renderTeamCard(team) {
  const validity = teamValidity(team);
  const isPrebuilt = team.origin === "prebuilt";

  const actions = isPrebuilt
    ? `<button type="button" class="tm-primary-btn" data-act="duplicate" data-id="${escapeHtml(team.id)}">Duplicate &amp; edit</button>`
    : `
      <button type="button" class="tm-primary-btn" data-act="edit" data-id="${escapeHtml(team.id)}">Edit</button>
      <button type="button" class="secondary-action-btn" data-act="duplicate" data-id="${escapeHtml(team.id)}">Duplicate</button>
      <button type="button" class="tm-danger-btn" data-act="delete" data-id="${escapeHtml(team.id)}">Delete</button>
    `;

  return `
    <article class="tm-team-card ${validity.ok ? "" : "is-invalid"}">
      ${renderTeamSummary(team)}
      ${renderTeamStats(team)}
      ${validity.ok ? "" : `<span class="tm-invalid-flag" title="${escapeHtml(validity.errors.join(" "))}">Needs fixing</span>`}
      <div class="tm-team-card-actions">${actions}</div>
    </article>
  `;
}

function renderList() {
  prebuiltGrid.innerHTML = store
    .getPrebuilt()
    .map(renderTeamCard)
    .join("");

  const custom = store.getCustom();
  customGrid.innerHTML = custom.map(renderTeamCard).join("");
  customEmpty.hidden = custom.length > 0;
}

function showList() {
  builderView.hidden = true;
  builderView.innerHTML = "";
  listView.hidden = false;
  renderList();
}

function showBuilder(team) {
  listView.hidden = true;
  builderView.hidden = false;
  builder.open(team);
}

let toastTimer = null;
function flashToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 2600);
}

function onGridClick(event) {
  const button = event.target.closest("button[data-act]");
  if (!button) return;
  const { act, id } = button.dataset;

  if (act === "edit") {
    const team = store.getById(id);
    if (team) showBuilder(team);
  } else if (act === "duplicate") {
    if (store.isFull()) {
      flashToast(teamLimitMessage());
      return;
    }
    const copy = store.duplicate(id);
    if (copy) showBuilder(copy);
  } else if (act === "delete") {
    const team = store.getById(id);
    if (team && confirm(`Delete "${team.name}"? This cannot be undone.`)) {
      store.deleteCustom(id);
      renderList();
      flashToast("Team deleted.");
    }
  }
}

const localeSelect = document.getElementById("tm-locale-select");
localeSelect.value = getLocale();
localeSelect.addEventListener("change", (e) => {
  setLocale(e.target.value);
  builder.refreshLocale();
});

prebuiltGrid.addEventListener("click", onGridClick);
customGrid.addEventListener("click", onGridClick);

function teamLimitMessage() {
  return `You can save up to ${store.maxCustomTeams} teams. Delete one to make room.`;
}

newTeamBtn.addEventListener("click", () => {
  if (store.isFull()) {
    flashToast(teamLimitMessage());
    return;
  }
  showBuilder({ name: "", champions: [], emblems: [], derivedFrom: null });
});

store.onSyncError = () => flashToast("Could not sync with your account. Check your connection.");

// Another device or tab may have changed the account's teams meanwhile.
async function refreshFromAccount() {
  if (!store.userId || listView.hidden) return;
  try {
    await Promise.all([store.load(store.userId), loadTeamStats().catch(() => {})]);
    renderList();
  } catch {
    /* keep showing the cached teams */
  }
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshFromAccount();
});

async function start() {
  const session = await getSession();
  if (session) {
    await store.load(session.user.id);
    // Stats are a bonus: a failed fetch just leaves the cards without them.
    loadTeamStats().then(() => !listView.hidden && renderList(), () => {});
  } else if (!(clientEditMode.enabled && clientEditMode.autoLogin)) {
    location.href = "/";
    return;
  }
  showList();
}

start();
