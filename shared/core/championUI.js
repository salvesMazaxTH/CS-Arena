import { StatusIndicator } from "../ui/statusIndicator.js";
import { SpawnProtection } from "../engine/combat/spawnProtection.js";

// Spelled out in words: the icon strip is for buffs and debuffs only.
function syncTakingTheFieldUI(champion) {
  const arriving = SpawnProtection.isActive(champion);
  champion.el.classList.toggle("is-taking-the-field", arriving);

  const existing = champion.el.querySelector(".taking-the-field-tag");

  if (!arriving) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const tag = document.createElement("span");
  tag.className = "taking-the-field-tag";
  tag.title = `${champion.name} cannot act or be reached until next turn.`;

  const lock = document.createElement("span");
  lock.className = "taking-the-field-lock";
  lock.textContent = "\u{1F512}";

  tag.append(lock, SpawnProtection.label);
  champion.el.appendChild(tag);
}

/**
 * Create the champion DOM element
 * @param {object} champion - The champion instance
 * @param {object} handlers - Event handlers
 * @returns {HTMLElement} Champion element
 */
function createChampionElement(champion, handlers = {}) {
  const div = document.createElement("div");
  div.classList.add("champion");
  div.dataset.championId = champion.id;
  div.dataset.team = champion.team;
  div.dataset.entityType = champion.entityType ?? "champion";

  div.innerHTML = buildChampionHTML(champion, { editMode: handlers.editMode });

  return div;
}

/**
 * Build champion HTML
 * @param {object} champion - The champion instance
 * @param {object} config - Configuration
 * @returns {string} HTML string
 */
function buildChampionHTML(champion, { editMode } = {}) {
  const isEditModeEnabled = editMode?.enabled === true;

  return `
  <div class="portrait-wrapper">
    <div class="portrait" data-id="${champion.id}">
      <img
        data-id="${champion.id}"
        src="${champion.portrait}"
      >
    </div>

  </div>

          <div class="stat-block hp-stat">
            <p>HP: <span class="hp">${Math.floor(Number(champion.HP) || 0)}/${Math.floor(Number(champion.maxHP) || 0)}</span></p>

            <div class="hp-bar">
                <div class="hp-fill"></div>
                <div class="hp-segments"></div>
            </div>
        </div>

        <div class="stat-block momentum-stat">
            <p>Momentum: <span class="momentum">${Math.floor(Number(champion.momentum) || 0)}/100</span></p>

            <div class="momentum-bar" aria-label="Momentum bar">
                <div class="momentum-fill"></div>
                <div class="momentum-markers" aria-hidden="true">
                    <span class="momentum-threshold" style="left: 25%;">1</span>
                    <span class="momentum-threshold" style="left: 50%;">2</span>
                    <span class="momentum-threshold" style="left: 75%;">3</span>
                </div>
            </div>
        </div>

    ${
      isEditModeEnabled
        ? `
      <div class="delete">
        <button class="delete-btn" data-id="${champion.id}">
          <i class='bx bx-trash'></i>
        </button>
      </div>
    `
        : ""
    }
  `;
}

/**
 * Bind event handlers to champion element
 * @param {object} champion - The champion instance
 * @param {HTMLElement} div - Champion DOM element
 * @param {object} handlers - Event handlers
 */
function bindChampionHandlers(champion, div, handlers = {}) {
  const { onDelete } = handlers;

  // botão de deletar
  div.querySelector(".delete-btn")?.addEventListener("click", () => {
    onDelete?.(champion.id);
  });
  // abrir o overlay do card do campeão
  div.querySelector(".portrait")?.addEventListener("click", (e) => {
    handlers.onPortraitClick?.(champion);
  });

  // 🔥 bloquear menu padrão da imagem
  const img = div.querySelector(".portrait img");
  if (img) {
    img.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

/**
 * Render champion to DOM
 * @param {object} champion - The champion instance
 * @param {HTMLElement} container - Container to append to
 * @param {object} handlers - Event handlers
 */
export function renderChampion(champion, container, handlers = {}) {
  const div = createChampionElement(champion, handlers);
  bindChampionHandlers(champion, div, handlers);

  champion.el = div;
  container.appendChild(div);

  updateChampionUI(champion, {
    freeCostSkills: handlers.editMode?.freeCostSkills === true,
  });
}

// The shield half of the HP readout. A supreme or spell shield shows its marker
// instead of a number, hiding any regular shield stacked under it.
export function formatShieldBadge(shields) {
  if (!Array.isArray(shields) || !shields.length) return "";

  if (shields.some((shield) => shield?.type === "supreme")) {
    return " 🛡️ <b>SUP</b>";
  }

  if (shields.some((shield) => shield?.type === "spell")) {
    return " 🛡️ <b>S</b>";
  }

  const total = Math.floor(
    shields.reduce((sum, shield) => sum + (Number(shield?.amount) || 0), 0),
  );

  return total > 0 ? ` 🛡️ (${total})` : "";
}

/**
 * Update champion UI
 * @param {object} champion - The champion instance
 * @param {object} context - Update context
 */
export function updateChampionUI(champion, context) {
  if (!champion.el) return;

  // =========================
  // PORTRAIT
  // ============ =============
  const portrait = champion.el.querySelector(".portrait img");
  if (portrait) {
    portrait.src = champion.portrait;
  }

  // =========================
  // HP
  // =========================

  const HpDiv = champion.el.querySelector(".hp");
  const fill = champion.el.querySelector(".hp-fill");

  // Remove escudos vazios PRIMEIRO
  if (Array.isArray(champion.runtime?.shields)) {
    champion.runtime.shields = champion.runtime.shields.filter(
      (s) => s.amount > 0,
    );
  }

  const shields = champion.runtime?.shields;
  const currentHP = Number(champion.HP) || 0;
  const maxHP = Number(champion.maxHP) || 0;

  champion.el.classList.toggle(
    "has-shield",
    Array.isArray(shields) && shields.length > 0,
  );

  HpDiv.innerHTML =
    `${Math.floor(currentHP)}/${Math.floor(maxHP)}` +
    formatShieldBadge(shields);

  // Barra de HP
  const percent = (champion.HP / champion.maxHP) * 100;
  fill.style.width = `${percent}%`;

  if (percent <= 19) {
    fill.style.background = "#ff2a2a";
  } else if (percent <= 49) {
    fill.style.background = "#ffcc00";
  } else {
    fill.style.background = "#00ff66";
  }
  // =========================
  // MOMENTUM
  // =========================

  const momentumValueEl = champion.el.querySelector(".momentum");
  const momentumFillEl = champion.el.querySelector(".momentum-fill");

  const currentUnits = Math.floor(Number(champion.momentum) || 0);
  const totalUnits = 100;

  if (momentumValueEl) {
    momentumValueEl.textContent = `${currentUnits}/${totalUnits}`;
  }

  if (momentumFillEl) {
    const percent = (currentUnits / totalUnits) * 100;
    momentumFillEl.style.width = `${percent}%`;
  }

  // =========================
  // SEGMENTOS (HP)
  // =========================

  const hpSegments = champion.el.querySelector(".hp-segments");
  if (hpSegments) {
    const hpPerSegment = 50;
    const hpSegmentCount = Math.floor(champion.maxHP / hpPerSegment);
    const currentHpCount = Number(hpSegments.dataset.segmentCount) || 0;

    if (hpSegmentCount !== currentHpCount) {
      hpSegments.innerHTML = "";
      for (let i = 0; i < hpSegmentCount; i++) {
        hpSegments.appendChild(document.createElement("div"));
      }
      hpSegments.dataset.segmentCount = String(hpSegmentCount);
    }
  }

  // =========================
  // Arrival state
  // =========================

  syncTakingTheFieldUI(champion);

  // =========================
  // Status indicators
  // =========================

  StatusIndicator.updateChampionIndicators(champion);
  // =========================
  // Botões das skills (bloqueio por ação já tomada)
  // =========================

  syncChampionActionStateUI(champion);
}

/**
 * Sync action state UI
 * @param {object} champion - The champion instance
 */
export function syncChampionActionStateUI(_champion) {
  // skill buttons have been removed from champion cards; action is handled via the action bar
}

/**
 * Destroy champion DOM
 * @param {object} champion - The champion instance
 */
export function destroyChampion(champion) {
  /* console.log(
    `[Server Champion.destroy() called for ${champion.name} (ID: ${champion.id})`,
  );
  */
  // console.log(`[Client] this.el value:`, champion.el);
  // console.log(`[Client] typeof this.el:`, typeof champion.el);
  // Remove do DOM
  if (champion.el) {
    champion.el.remove();
    champion.el = null;
    /* console.log(
      `[Client] Removed DOM element for ${champion.name} (ID: ${champion.id}).`,
    );
    */
  } else {
    /* console.log(
      `[Client] No DOM element (this.el) found for ${champion.name} (ID: ${champion.id}) to remove.`,
    );
    */
  }
}
