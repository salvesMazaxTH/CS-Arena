import { championDB } from "/shared/data/championDB.js";
import { DuoLayout, duoDB } from "/shared/data/duos.js";
import { isChampionDraftable } from "/shared/data/draftEligibility.js";
import { EMBLEMS } from "/shared/data/emblems/index.js";
import {
  TEAM_SIZE,
  validateTeamComposition,
} from "/shared/data/teams/index.js";
import {
  escapeHtml,
  renderChampionCardContent,
  sortChampionKeysAlphabetically,
} from "./championCardMarkup.js";
import { renderEmblemPanel } from "./emblemPanel.js";

const CLIENT_EDIT_MODE = {};

function renderDuoCardContent(duo) {
  const cores = duo.cores
    .map(
      (coreKey) =>
        `<span class="champion-species-chip">${escapeHtml(championDB[coreKey].name)}</span>`,
    )
    .join("");

  return `
    <div class="champion-card-inner">
      <div class="champion-card-face champion-card-front">
        <img class="champion-card-portrait" src="${duo.portrait}" alt="${escapeHtml(duo.name)}">
        <h3>${escapeHtml(duo.name)}</h3>
        <div class="champion-identity-row">
          <span class="duo-slot-cost">${duo.cores.length} slots</span>
        </div>
        <div class="duo-core-list">${cores}</div>
      </div>
    </div>
  `;
}

/** The team builder widget: champion grid, ordered slots, emblem picker. */
export class TeamBuilder {
  constructor({ root, onSave, onCancel }) {
    this.root = root;
    this.onSave = onSave;
    this.onCancel = onCancel;
    this.draft = null;
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
    this._renderShell();
    this._renderGrid();
    this._refresh();
  }

  // --- rendering ---

  _renderShell() {
    this.root.innerHTML = `
      <div class="tm-builder">
        <div class="tm-builder-head">
          <input class="tm-name-input" type="text" maxlength="40" placeholder="Team name"
            aria-label="Team name" value="${escapeHtml(this.draft.name)}">
          <div class="tm-builder-actions">
            <button type="button" class="secondary-action-btn" data-act="cancel">Cancel</button>
            <button type="button" data-act="save">Save team</button>
          </div>
        </div>

        <div class="emblem-selection-panel">
          <div class="emblem-selection-header">
            <div>
              <span class="eyebrow">Global Passives</span>
              <h3>Emblems</h3>
            </div>
            <span class="emblem-selection-counter"><span data-ref="emblemCount">0</span>/2</span>
          </div>
          <div class="emblem-selection-list" data-ref="emblemList"></div>
        </div>

        <div class="selection-container tm-builder-body">
          <div class="available-champions-grid" data-ref="grid"></div>
          <div class="selected-champions-area">
            <h3>Line-up order</h3>
            <div class="selected-champions-slots" data-ref="slots"></div>
            <div class="selection-actions">
              <button type="button" class="secondary-action-btn" data-act="autofill">Autofill</button>
            </div>
          </div>
        </div>

        <ul class="tm-validation" data-ref="validation"></ul>
      </div>
    `;

    this.refs = {};
    this.root
      .querySelectorAll("[data-ref]")
      .forEach((el) => (this.refs[el.dataset.ref] = el));

    this.nameInput = this.root.querySelector(".tm-name-input");
    this.nameInput.addEventListener("input", () => {
      this.draft.name = this.nameInput.value;
      this._renderValidation();
    });

    this.root.querySelector('[data-act="cancel"]').addEventListener("click", () =>
      this.onCancel?.(),
    );
    this.saveBtn = this.root.querySelector('[data-act="save"]');
    this.saveBtn.addEventListener("click", () => {
      if (this.saveBtn.disabled) return;
      this.onSave?.(this._collectTeam());
    });
    this.root
      .querySelector('[data-act="autofill"]')
      .addEventListener("click", () => this._autofill());
  }

  _renderGrid() {
    const grid = this.refs.grid;
    grid.innerHTML = "";

    const championKeys = sortChampionKeysAlphabetically(
      Object.keys(championDB).filter((key) => this._isGridChampion(key)),
      championDB,
    );

    championKeys.forEach((key) => {
      const card = document.createElement("div");
      card.classList.add("champion-card");
      card.dataset.championKey = key;
      card.draggable = true;
      card.innerHTML = renderChampionCardContent(championDB[key]);
      this._attachCardInteractions(card, key, -1);
      grid.appendChild(card);
    });

    Object.values(duoDB)
      .filter((duo) => this._isDuoOffered(duo))
      .forEach((duo) => {
        const card = document.createElement("div");
        card.classList.add("champion-card", "duo-card");
        card.dataset.duoKey = duo.key;
        card.draggable = true;
        card.innerHTML = renderDuoCardContent(duo);
        this._attachCardInteractions(card, duo.cores[0], -1, duo);
        grid.appendChild(card);
      });
  }

  _refresh() {
    this._renderSlots();
    this._renderEmblems();
    this._renderValidation();
    this._markGridSelection();
  }

  _renderSlots() {
    const slots = this.refs.slots;
    slots.innerHTML = "";
    const layout = this._layout();

    for (let index = 0; index < TEAM_SIZE; index += 1) {
      const slot = document.createElement("div");
      slot.classList.add("champion-slot");
      slot.dataset.slotIndex = index;
      slot.addEventListener("dragover", (e) => this._onDragOver(e));
      slot.addEventListener("drop", (e) => this._onDrop(e));
      slot.addEventListener("dragleave", (e) =>
        e.currentTarget.classList.remove("drag-over"),
      );
      slots.appendChild(slot);

      const placement = layout.at(index);
      if (placement && placement.start === index) {
        const { duo } = placement;
        slot.classList.add("has-champion", "duo-occupied");
        slot.style.gridColumn = `span ${duo.cores.length}`;
        const card = document.createElement("div");
        card.classList.add("champion-card", "duo-card");
        card.dataset.duoKey = duo.key;
        card.draggable = true;
        card.innerHTML = renderDuoCardContent(duo);
        this._attachCardInteractions(card, duo.cores[0], index, duo);
        slot.appendChild(card);
        index += duo.cores.length - 1;
        continue;
      }

      const championKey = this.draft.champions[index];
      if (championKey) {
        slot.classList.add("has-champion");
        const card = document.createElement("div");
        card.classList.add("champion-card");
        card.dataset.championKey = championKey;
        card.draggable = true;
        card.innerHTML = renderChampionCardContent(championDB[championKey]);
        this._attachCardInteractions(card, championKey, index);
        slot.appendChild(card);
      } else {
        slot.textContent = `Slot ${index + 1}`;
      }
    }
  }

  _renderEmblems() {
    renderEmblemPanel({
      list: this.refs.emblemList,
      counter: this.refs.emblemCount,
      selectedKeys: this.draft.emblems,
      rosterKeys: this.draft.champions.filter(Boolean),
      onToggle: (next) => {
        this.draft.emblems = next;
        this._refresh();
      },
    });
  }

  _renderValidation() {
    const result = validateTeamComposition(this._collectTeam(), {
      championDB,
      emblems: EMBLEMS,
      editMode: CLIENT_EDIT_MODE,
    });
    const nameOk = this.draft.name.trim().length > 0;

    const messages = [...result.errors];
    if (!nameOk) messages.push("Give the team a name.");

    this.refs.validation.innerHTML = messages
      .map((message) => `<li>${escapeHtml(message)}</li>`)
      .join("");
    this.refs.validation.classList.toggle("is-clear", messages.length === 0);
    this.saveBtn.disabled = messages.length > 0;
  }

  _markGridSelection() {
    this.refs.grid.querySelectorAll(".champion-card").forEach((card) => {
      const { championKey, duoKey } = card.dataset;
      const selected = duoKey
        ? duoDB[duoKey].cores.every((coreKey) =>
            this.draft.champions.includes(coreKey),
          )
        : this.draft.champions.includes(championKey);
      card.classList.toggle("selected", selected);
    });
  }

  // --- data ---

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

  _layout() {
    return new DuoLayout(this.draft.champions, TEAM_SIZE);
  }

  _isGridChampion(key) {
    const champion = championDB[key];
    if (!isChampionDraftable(champion, CLIENT_EDIT_MODE)) return false;
    return champion.hiddenFromDraftGrid !== true;
  }

  _isDuoOffered(duo) {
    return duo.cores.every((coreKey) => {
      const core = championDB[coreKey];
      if (!core || core.hiddenFromDraftGrid !== true) return false;
      return isChampionDraftable(core, CLIENT_EDIT_MODE);
    });
  }

  _draftableKeys(exclude = []) {
    return Object.keys(championDB).filter(
      (key) => !exclude.includes(key) && this._isGridChampion(key),
    );
  }

  // --- interactions ---

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
    for (let index = 0; index < next.length; index += 1) {
      if (next[index] !== null) continue;
      const pool = this._draftableKeys(next.filter(Boolean));
      if (!pool.length) break;
      next[index] = pool[Math.floor(Math.random() * pool.length)];
    }
    this.draft.champions = next;
    this._refresh();
  }

  _attachCardInteractions(card, championKey, fromSlotIndex = -1, duo = null) {
    card.title = duo
      ? `${duo.name} take ${duo.cores.length} line-up slots and always enter together`
      : "Click to add or remove | right-click to flip";

    card.querySelectorAll(".champion-card-flip-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        card.classList.toggle("is-flipped");
      });
    });

    card.addEventListener("click", (event) => {
      if (event.target.closest(".champion-card-flip-btn")) return;
      if (card.classList.contains("is-flipped")) {
        card.classList.remove("is-flipped");
        return;
      }
      if (duo) this._handleDuoClick(duo);
      else this._addChampion(championKey);
    });

    card.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      card.classList.toggle("is-flipped");
    });

    card.addEventListener("dragstart", (event) => {
      this._draggedKey = duo ? duo.key : championKey;
      this._draggedFromSlot = fromSlotIndex;
      event.dataTransfer.setData("text/plain", this._draggedKey);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  }

  _onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("drag-over");
  }

  _onDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove("drag-over");

    const droppedKey = event.dataTransfer.getData("text/plain");
    const targetSlot = parseInt(event.currentTarget.dataset.slotIndex, 10);
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
