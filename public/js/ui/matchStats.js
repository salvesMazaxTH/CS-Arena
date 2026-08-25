/**
 * End-of-match statistics panel: ranks the champions on the field by combat
 * metrics (damage, healing, raw taken, mitigated) across tabbed tables. Reads
 * the live champion list and the local player's team; writes only to the DOM.
 */
export function createMatchStatsPanel({ activeChampions }) {
  const statsTabKeys = [
    "damage",
    "healingReceived",
    "healingDone",
    "rawTaken",
    "damageMitigated",
  ];

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function getSnapshotStatsEntry(champion) {
    if (!champion) return null;

    const backendStats = champion.matchStats || {};

    return {
      championId: champion.id,
      name: champion.name || `ID ${champion.id}`,
      portrait: champion.portrait || "",
      team: champion.team,
      damage: Math.max(0, toNumber(backendStats.damage)),
      healingReceived: Math.max(0, toNumber(backendStats.healingReceived)),
      healingDone: Math.max(0, toNumber(backendStats.healingDone)),
      rawTaken: Math.max(0, toNumber(backendStats.rawTaken)),
      damageMitigated: Math.max(0, toNumber(backendStats.damageMitigated)),
    };
  }

  function sortEntriesBy(metricKey) {
    const entries = Array.from(activeChampions.values())
      .map(getSnapshotStatsEntry)
      .filter(Boolean);

    return entries.sort((a, b) => {
      const valueDiff = (b[metricKey] || 0) - (a[metricKey] || 0);
      if (valueDiff !== 0) return valueDiff;

      const teamA = typeof a.team === "number" ? a.team : 99;
      const teamB = typeof b.team === "number" ? b.team : 99;
      if (teamA !== teamB) return teamA - teamB;

      return String(a.championId || "").localeCompare(
        String(b.championId || ""),
      );
    });
  }

  function renderStatsRows(tbodyId, metricKey) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const entries = sortEntriesBy(metricKey);

    if (!entries.length) {
      tbody.innerHTML =
        '<tr><td colspan="3" class="match-stats-empty">No combat data.</td></tr>';
      return;
    }

    tbody.innerHTML = entries
      .map((entry, index) => {
        const safePortrait = escapeHtml(entry.portrait);
        const safeName = escapeHtml(entry.name || `ID ${entry.championId}`);
        const localTeam = Number(window.playerTeam);
        const relationClass =
          Number.isFinite(localTeam) && typeof entry.team === "number"
            ? entry.team === localTeam
              ? "ally"
              : "enemy"
            : "neutral";
        const value = Math.round(Math.max(0, toNumber(entry[metricKey])));
        return `
          <tr>
            <td>${index + 1}</td>
            <td>
              <span class="match-stats-avatar-wrap ${relationClass}" title="${safeName}">
                <img class="match-stats-portrait" src="${safePortrait}" alt="${safeName}">
              </span>
            </td>
            <td>${value}</td>
          </tr>
        `;
      })
      .join("");
  }

  function setStatsTab(tabKey) {
    const panel = document.getElementById("matchStatsPanel");
    if (!panel) return;

    panel.querySelectorAll(".match-stats-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });

    panel.querySelectorAll(".match-stats-tab-panel").forEach((panelEl) => {
      panelEl.classList.toggle("active", panelEl.dataset.tabPanel === tabKey);
    });
  }

  function bindStatsPanelTabs() {
    const panel = document.getElementById("matchStatsPanel");
    if (!panel || panel.dataset.bound === "true") return;

    panel.dataset.bound = "true";

    panel.querySelectorAll(".match-stats-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabKey = btn.dataset.tab;
        if (statsTabKeys.includes(tabKey)) {
          setStatsTab(tabKey);
        }
      });
    });
  }

  function render() {
    bindStatsPanelTabs();

    renderStatsRows("matchStatsDamageBody", "damage");
    renderStatsRows("matchStatsHealingReceivedBody", "healingReceived");
    renderStatsRows("matchStatsHealingDoneBody", "healingDone");
    renderStatsRows("matchStatsRawTakenBody", "rawTaken");
    renderStatsRows("matchStatsDamageMitigatedBody", "damageMitigated");
    setStatsTab("damage");
  }

  function show() {
    const panel = document.getElementById("matchStatsPanel");
    if (!panel) return;
    render();
    panel.classList.remove("hidden");
    panel.classList.add("active");
  }

  function hide() {
    const panel = document.getElementById("matchStatsPanel");
    if (!panel) return;
    panel.classList.remove("active");
    panel.classList.add("hidden");
  }

  return { show, reset: hide };
}
