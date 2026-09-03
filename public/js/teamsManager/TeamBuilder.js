import { championDB } from "/shared/data/championDB.js";
import { DuoLayout, duoDB, getDuoForCore } from "/shared/data/duos.js";
import { isChampionDraftable } from "/shared/data/draftEligibility.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";
import {
  ELEMENT_IDENTITIES,
  CLASS_IDENTITIES,
} from "/shared/ui/identityPalette.js";
import { TEAM_SIZE, validateTeamComposition } from "/shared/data/teams/index.js";
import {
  escapeHtml,
  renderChampionIdentityBadgesMarkup,
  normalizeChampionClassKey,
  sortChampionKeysAlphabetically,
} from "./championCardMarkup.js";
import {
  renderChampionInspector,
  renderInspectorEmpty,
} from "./championInspector.js";
import { renderEmblemPanel } from "./emblemPanel.js";

const ZONES = ["roster", "inspector", "team"];

function championAffinityKeys(champion) {
  const raw = Array.isArray(champion.elementalAffinities)
    ? champion.elementalAffinities
    : champion.elementalAffinities
      ? [champion.elementalAffinities]
      : [];
  return raw.map((entry) => String(entry).trim().toLowerCase());
}

/**
 * The team-building workbench: a browsable roster on the left, one champion's
 * full kit in the centre, and the ordered line-up plus Emblems on the right.
 */
export class TeamBuilder {
  constructor({ root, onSave, onCancel, editMode = {} }) {
    this.root = root;
    this.onSave = onSave;
    this.onCancel = onCancel;
    this.editMode = editMode;
    this.draft = null;
    this.focusKey = null;
    this.filters = { element: null, klass: null, text: "" };
    this._draggedKey = null;
    this._draggedFromSlot = -1;
  }

  open(team) {
    const champions = Array.from(
      { length: TEAM_SIZE },
      (_, index) => team?.champions?.[index] ?? null,
    );
    this.draft = {
      id: team?.id ?? null,
      name: team?.name ?? "",
      tagline: team?.tagline ?? "",
      champions,
      emblems: Array.isArray(team?.emblems) ? [...team.emblems] : [],
      derivedFrom: team?.derivedFrom ?? null,
    };
    this.filters = { element: null, klass: null, text: "" };
    this.focusKey =
      champions.find(Boolean) ?? this._rosterKeys()[0] ?? null;

    this._renderShell();
    this._renderRoster();
    this._refresh();
  }

  // --- shell ---

  _renderShell() {
    this.root.innerHTML = `
      <div class="tm-builder">
        <div class="tm-builder-bar">
          <input class="tm-name-input" type="text" maxlength="40" placeholder="Name this team"
            aria-label="Team name" value="${escapeHtml(this.draft.name)}">
          <div class="tm-builder-actions">
            <button type="button" class="secondary-action-btn" data-act="cancel">Cancel</button>
            <button type="button" class="tm-primary-btn" data-act="save">Save team</button>
          </div>
        </div>

        <div class="tm-zone-tabs" role="tablist">
          ${ZONES.map(
            (zone) =>
              `<button type="button" class="tm-zone-tab" data-zone="${zone}">${zone[0].toUpperCase()}${zone.slice(1)}</button>`,
          ).join("")}
        </div>

        <div class="tm-workbench" data-active-zone="roster">
          <aside class="tm-roster" data-zone="roster">
            <div class="tm-roster-filters">
              <input class="tm-roster-search" type="search" placeholder="Search by name"
                aria-label="Search champions by name">
              <div class="tm-filter-row" data-facet="element"></div>
              <div class="tm-filter-row" data-facet="klass"></div>
            </div>
            <div class="tm-roster-grid" data-ref="roster"></div>
          </aside>

          <section class="tm-inspector" data-zone="inspector" data-ref="inspector"></section>

          <aside class="tm-team" data-zone="team">
            <div class="tm-team-head">
              <h4>Line-up order</h4>
              <button type="button" class="secondary-action-btn tm-autofill-btn" data-act="autofill">
                <i class="bx bx-dice-5"></i> Fill rest randomly
              </button>
            </div>
            <div class="tm-lineup" data-ref="lineup"></div>

            <div class="tm-team-emblems">
              <div class="tm-team-emblems-head">
                <h4>Emblems</h4>
                <span class="tm-emblem-count"><span data-ref="emblemCount">0</span>/2</span>
              </div>
              <div class="tm-emblem-chosen" data-ref="emblemChosen"></div>
              <button type="button" class="secondary-action-btn tm-add-emblem" data-act="add-emblem">
                <i class="bx bx-plus"></i> Add Emblem
              </button>
            </div>

            <ul class="tm-validation" data-ref="validation"></ul>
          </aside>
        </div>

        <div class="tm-emblem-overlay hidden" data-ref="emblemOverlay">
          <div class="tm-emblem-overlay-panel" role="dialog" aria-label="Choose Emblems">
            <div class="tm-emblem-overlay-head">
              <h3>Emblems <span class="tm-emblem-count"><span data-ref="emblemCountOverlay">0</span>/2</span></h3>
              <button type="button" class="tm-emblem-overlay-close" data-act="close-emblem" aria-label="Close">✕</button>
            </div>
            <div class="emblem-selection-list" data-ref="emblemList"></div>
          </div>
        </div>
      </div>
    `;

    this.refs = {};
    this.root
      .querySelectorAll("[data-ref]")
      .forEach((el) => (this.refs[el.dataset.ref] = el));

    this.workbench = this.root.querySelector(".tm-workbench");
    this.nameInput = this.root.querySelector(".tm-name-input");
    this.saveBtn = this.root.querySelector('[data-act="save"]');

    this.nameInput.addEventListener("input", () => {
      this.draft.name = this.nameInput.value;
      this._renderValidation();
    });
    this.root
      .querySelector('[data-act="cancel"]')
      .addEventListener("click", () => this.onCancel?.());
    this.saveBtn.addEventListener("click", () => {
      if (!this.saveBtn.disabled) this.onSave?.(this._collectTeam());
    });
    this.root
      .querySelector('[data-act="autofill"]')
      .addEventListener("click", () => this._autofill());

    this._wireFilters();
    this._wireZoneTabs();
    this._wireEmblemOverlay();
  }

  _wireFilters() {
    const search = this.root.querySelector(".tm-roster-search");
    search.addEventListener("input", () => {
      this.filters.text = search.value.trim();
      this._renderRoster();
    });

    const rows = {
      element: { row: this.root.querySelector('[data-facet="element"]'), palette: ELEMENT_IDENTITIES },
      klass: { row: this.root.querySelector('[data-facet="klass"]'), palette: CLASS_IDENTITIES },
    };

    for (const [facet, { row, palette }] of Object.entries(rows)) {
      for (const [key, identity] of Object.entries(palette)) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tm-filter-chip";
        chip.dataset.key = key;
        chip.style.setProperty("--chip-tint", identity.background);
        chip.innerHTML = `<span class="tm-filter-chip-icon">${identity.icon ?? "•"}</span>${identity.label}`;
        chip.addEventListener("click", () => {
          this.filters[facet] = this.filters[facet] === key ? null : key;
          this._syncFilterChips();
          this._renderRoster();
        });
        row.appendChild(chip);
      }
    }
    this._syncFilterChips();
  }

  _syncFilterChips() {
    this.root.querySelectorAll('[data-facet="element"] .tm-filter-chip').forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.key === this.filters.element);
    });
    this.root.querySelectorAll('[data-facet="klass"] .tm-filter-chip').forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.key === this.filters.klass);
    });
  }

  _wireZoneTabs() {
    this.root.querySelectorAll(".tm-zone-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.workbench.dataset.activeZone = tab.dataset.zone;
        this._syncZoneTabs();
      });
    });
    this._syncZoneTabs();
  }

  _syncZoneTabs() {
    const active = this.workbench.dataset.activeZone;
    this.root.querySelectorAll(".tm-zone-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.zone === active);
    });
  }

  _wireEmblemOverlay() {
    const overlay = this.refs.emblemOverlay;
    this.root
      .querySelector('[data-act="add-emblem"]')
      .addEventListener("click", () => this._openEmblemOverlay());
    this.root
      .querySelector('[data-act="close-emblem"]')
      .addEventListener("click", () => overlay.classList.add("hidden"));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.classList.add("hidden");
    });
    if (!this._escBound) {
      this._escBound = (event) => {
        if (event.key === "Escape") this.refs.emblemOverlay?.classList.add("hidden");
      };
      document.addEventListener("keydown", this._escBound);
    }
  }

  _openEmblemOverlay() {
    this.refs.emblemOverlay.classList.remove("hidden");
    this._renderEmblemPanel();
  }

  // --- roster ---

  _rosterKeys() {
    return sortChampionKeysAlphabetically(
      Object.keys(championDB).filter((key) => this._isGridChampion(key)),
      championDB,
    );
  }

  _isGridChampion(key) {
    const champion = championDB[key];
    if (!isChampionDraftable(champion, this.editMode)) return false;
    return champion.hiddenFromDraftGrid !== true;
  }

  _isDuoOffered(duo) {
    return duo.cores.every((coreKey) => {
      const core = championDB[coreKey];
      if (!core || core.hiddenFromDraftGrid !== true) return false;
      return isChampionDraftable(core, this.editMode);
    });
  }

  _passesFilters(champion) {
    const { element, klass, text } = this.filters;
    if (text && !champion.name.toLowerCase().includes(text.toLowerCase())) {
      return false;
    }
    if (element && !championAffinityKeys(champion).includes(element)) return false;
    if (klass && normalizeChampionClassKey(champion) !== klass) return false;
    return true;
  }

  _renderRoster() {
    const grid = this.refs.roster;
    const visible = this._rosterKeys().filter((key) =>
      this._passesFilters(championDB[key]),
    );

    const tiles = visible.map((key) => this._rosterTileMarkup(key));

    if (!this.filters.text && !this.filters.element && !this.filters.klass) {
      Object.values(duoDB)
        .filter((duo) => this._isDuoOffered(duo))
        .forEach((duo) => tiles.push(this._duoTileMarkup(duo)));
    }

    grid.innerHTML = tiles.join("") || `<p class="tm-roster-empty">No champions match.</p>`;

    grid.querySelectorAll(".tm-roster-tile").forEach((tile) => {
      const { championKey, duoKey } = tile.dataset;
      tile.addEventListener("click", () => {
        if (duoKey) {
          this._handleDuoClick(duoDB[duoKey]);
          this._setFocus(duoDB[duoKey].cores[0]);
        } else {
          this._setFocus(championKey);
        }
      });
      tile.addEventListener("dragstart", (event) => {
        this._draggedKey = duoKey || championKey;
        this._draggedFromSlot = -1;
        event.dataTransfer.setData("text/plain", this._draggedKey);
        tile.classList.add("dragging");
      });
      tile.addEventListener("dragend", () => tile.classList.remove("dragging"));
    });

    this._markRoster();
  }

  _rosterTileMarkup(key) {
    const champion = championDB[key];
    return `
      <button type="button" class="tm-roster-tile" draggable="true"
        data-champion-key="${key}" title="${escapeHtml(champion.name)}">
        <span class="tm-roster-portrait">
          <img src="${escapeHtml(champion.portrait)}" alt="" loading="lazy">
        </span>
        <span class="tm-roster-name">${escapeHtml(champion.name)}</span>
        <span class="tm-roster-dots">${renderChampionIdentityBadgesMarkup(champion)}</span>
      </button>
    `;
  }

  _duoTileMarkup(duo) {
    return `
      <button type="button" class="tm-roster-tile tm-roster-tile-duo" draggable="true"
        data-duo-key="${duo.key}" title="${escapeHtml(duo.name)}">
        <span class="tm-roster-portrait">
          <img src="${escapeHtml(duo.portrait)}" alt="" loading="lazy">
        </span>
        <span class="tm-roster-name">${escapeHtml(duo.name)}</span>
        <span class="tm-roster-dots"><span class="tm-duo-badge">${duo.cores.length} slots</span></span>
      </button>
    `;
  }

  _markRoster() {
    this.refs.roster.querySelectorAll(".tm-roster-tile").forEach((tile) => {
      const { championKey, duoKey } = tile.dataset;
      const inTeam = duoKey
        ? duoDB[duoKey].cores.every((core) => this.draft.champions.includes(core))
        : this.draft.champions.includes(championKey);
      const focused = duoKey
        ? duoDB[duoKey].cores.includes(this.focusKey)
        : championKey === this.focusKey;
      tile.classList.toggle("is-selected", inTeam);
      tile.classList.toggle("is-focused", focused);
    });
  }

  // --- inspector ---

  _setFocus(key) {
    this.focusKey = key;
    this._renderInspector();
    this._markRoster();
  }

  _renderInspector() {
    const champion = championDB[this.focusKey];
    if (!champion) {
      this.refs.inspector.innerHTML = renderInspectorEmpty();
      return;
    }

    const duo = getDuoForCore(this.focusKey) ?? null;
    const inTeam = duo
      ? duo.cores.every((core) => this.draft.champions.includes(core))
      : this.draft.champions.includes(this.focusKey);
    const partnerNames = duo
      ? duo.cores
          .filter((core) => core !== this.focusKey)
          .map((core) => championDB[core]?.name ?? core)
          .join(", ")
      : "";

    this.refs.inspector.innerHTML = renderChampionInspector(champion, {
      inTeam,
      duo,
      partnerNames,
    });
    this.refs.inspector
      .querySelector('[data-act="toggle-team"]')
      ?.addEventListener("click", () => {
        if (duo) this._handleDuoClick(duo);
        else this._addChampion(this.focusKey);
      });
  }

  // --- line-up ---

  _layout() {
    return new DuoLayout(this.draft.champions, TEAM_SIZE);
  }

  _renderLineup() {
    const list = this.refs.lineup;
    list.innerHTML = "";
    const layout = this._layout();

    for (let index = 0; index < TEAM_SIZE; index += 1) {
      const row = document.createElement("div");
      row.className = "tm-lineup-row";
      row.dataset.slotIndex = index;
      row.addEventListener("dragover", (e) => this._onDragOver(e));
      row.addEventListener("drop", (e) => this._onDrop(e));
      row.addEventListener("dragleave", (e) =>
        e.currentTarget.classList.remove("drag-over"),
      );

      const placement = layout.at(index);
      if (placement && placement.start === index) {
        const { duo } = placement;
        const span = duo.cores.length;
        row.classList.add("is-filled", "is-duo");
        row.draggable = true;
        row.innerHTML = `
          <span class="tm-lineup-ord">${index + 1}–${index + span}</span>
          <span class="tm-lineup-portrait"><img src="${escapeHtml(duo.portrait)}" alt=""></span>
          <span class="tm-lineup-name">${escapeHtml(duo.name)}</span>
          <button type="button" class="tm-lineup-remove" data-remove-duo="${duo.key}" aria-label="Remove ${escapeHtml(duo.name)}">✕</button>
        `;
        this._wireLineupRow(row, duo.cores[0], index);
        list.appendChild(row);
        index += span - 1;
        continue;
      }

      const key = this.draft.champions[index];
      if (key) {
        const champion = championDB[key];
        row.classList.add("is-filled");
        row.draggable = true;
        row.innerHTML = `
          <span class="tm-lineup-ord">${index + 1}</span>
          <span class="tm-lineup-portrait"><img src="${escapeHtml(champion.portrait)}" alt=""></span>
          <span class="tm-lineup-name">${escapeHtml(champion.name)}</span>
          <span class="tm-lineup-dots">${renderChampionIdentityBadgesMarkup(champion)}</span>
          <button type="button" class="tm-lineup-remove" data-remove="${index}" aria-label="Remove ${escapeHtml(champion.name)}">✕</button>
        `;
        this._wireLineupRow(row, key, index);
      } else {
        row.innerHTML = `
          <span class="tm-lineup-ord">${index + 1}</span>
          <span class="tm-lineup-empty">Empty slot</span>
        `;
      }
      list.appendChild(row);
    }
  }

  _wireLineupRow(row, championKey, fromSlotIndex) {
    row.addEventListener("dragstart", (event) => {
      this._draggedKey = getDuoForCore(championKey)?.key ?? championKey;
      this._draggedFromSlot = fromSlotIndex;
      event.dataTransfer.setData("text/plain", this._draggedKey);
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));

    row.querySelector("[data-remove]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.draft.champions[Number(event.currentTarget.dataset.remove)] = null;
      this._refresh();
    });
    row.querySelector("[data-remove-duo]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this._layout().remove(duoDB[event.currentTarget.dataset.removeDuo]);
      this._refresh();
    });
    row.addEventListener("click", () => this._setFocus(championKey));
  }

  // --- emblems ---

  _renderEmblemsColumn() {
    const chosen = this.refs.emblemChosen;
    if (!this.draft.emblems.length) {
      chosen.innerHTML = `<p class="tm-emblem-none">None chosen.</p>`;
    } else {
      chosen.innerHTML = this.draft.emblems
        .map((key) => {
          const emblem = EMBLEMS.find((entry) => entry.key === key);
          return `
            <span class="tm-emblem-tag" title="${escapeHtml(emblem?.name ?? key)}">
              ${escapeHtml(emblem?.name ?? key)}
              <button type="button" data-drop-emblem="${key}" aria-label="Remove ${escapeHtml(emblem?.name ?? key)}">✕</button>
            </span>
          `;
        })
        .join("");
      chosen.querySelectorAll("[data-drop-emblem]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.draft.emblems = this.draft.emblems.filter(
            (key) => key !== btn.dataset.dropEmblem,
          );
          this._refresh();
        });
      });
    }

    this.refs.emblemCount.textContent = String(this.draft.emblems.length);
    this.root.querySelector('[data-act="add-emblem"]').disabled =
      this.draft.emblems.length >= 2;
  }

  _renderEmblemPanel() {
    this.refs.emblemCountOverlay.textContent = String(this.draft.emblems.length);
    renderEmblemPanel({
      list: this.refs.emblemList,
      counter: this.refs.emblemCountOverlay,
      selectedKeys: this.draft.emblems,
      rosterKeys: this.draft.champions.filter(Boolean),
      onToggle: (next) => {
        this.draft.emblems = next;
        this._refresh();
        this._renderEmblemPanel();
      },
    });
  }

  // --- validation / collect ---

  _renderValidation() {
    const result = validateTeamComposition(this._collectTeam(), {
      championDB,
      emblems: EMBLEMS,
      editMode: this.editMode,
    });
    const messages = [...result.errors];
    if (!this.draft.name.trim()) messages.push("Give the team a name.");

    this.refs.validation.innerHTML = messages
      .map((message) => `<li>${escapeHtml(message)}</li>`)
      .join("");
    this.saveBtn.disabled = messages.length > 0;
  }

  _collectTeam() {
    return {
      id: this.draft.id,
      name: this.draft.name.trim(),
      tagline: this.draft.tagline,
      champions: [...this.draft.champions],
      emblems: [...this.draft.emblems],
      origin: "custom",
      derivedFrom: this.draft.derivedFrom,
    };
  }

  _refresh() {
    this._renderLineup();
    this._renderEmblemsColumn();
    this._renderValidation();
    this._renderInspector();
    this._markRoster();
  }

  // --- team edits ---

  _addChampion(key) {
    const existing = this.draft.champions.indexOf(key);
    if (existing > -1) {
      this.draft.champions[existing] = null;
    } else {
      const free = this.draft.champions.indexOf(null);
      if (free === -1) return;
      this.draft.champions[free] = key;
    }
    this._refresh();
  }

  _handleDuoClick(duo) {
    const layout = this._layout();
    if (layout.at(this.draft.champions.indexOf(duo.cores[0]))) {
      layout.remove(duo);
    } else {
      const start = layout.findPlacement(duo);
      if (start === -1) return;
      layout.place(duo, start);
    }
    this._refresh();
  }

  _autofill() {
    const next = this.draft.champions.slice();
    const taken = () => next.filter(Boolean);
    for (let index = 0; index < next.length; index += 1) {
      if (next[index] !== null) continue;
      const pool = this._rosterKeys().filter((key) => !taken().includes(key));
      if (!pool.length) break;
      next[index] = pool[Math.floor(Math.random() * pool.length)];
    }
    this.draft.champions = next;
    this._refresh();
  }

  // --- drag & drop onto the line-up ---

  _onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("drag-over");
  }

  _onDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");

    const droppedKey = event.dataTransfer.getData("text/plain");
    const targetSlot = Number(event.currentTarget.dataset.slotIndex);
    if (Number.isNaN(targetSlot)) return;

    const champions = this.draft.champions;
    const layout = this._layout();
    const droppedDuo = duoDB[droppedKey];

    if (droppedDuo) {
      const span = droppedDuo.cores.length;
      const previous = layout.at(champions.indexOf(droppedDuo.cores[0]));
      if (previous) layout.remove(droppedDuo);
      const start = targetSlot - (targetSlot % span);
      if (layout.canPlaceAt(droppedDuo, start)) layout.place(droppedDuo, start);
      else if (previous) layout.place(droppedDuo, previous.start);
      this._finishDrag();
      return;
    }

    if (layout.at(targetSlot)) {
      this._finishDrag();
      return;
    }

    if (champions[targetSlot] === null) {
      champions[targetSlot] = droppedKey;
      if (this._draggedFromSlot !== -1) champions[this._draggedFromSlot] = null;
    } else {
      const displaced = champions[targetSlot];
      champions[targetSlot] = droppedKey;
      if (this._draggedFromSlot !== -1) {
        champions[this._draggedFromSlot] = displaced;
      } else {
        const oldIndex = champions.indexOf(droppedKey);
        if (oldIndex > -1 && oldIndex !== targetSlot) champions[oldIndex] = null;
      }
    }
    this._finishDrag();
  }

  _finishDrag() {
    this._draggedKey = null;
    this._draggedFromSlot = -1;
    this._refresh();
  }
}
