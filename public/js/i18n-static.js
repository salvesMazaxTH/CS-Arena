import { getLocale } from "/js/i18n/clientLocale.js";

/*
 * Static-markup translation layer (EN default, PT).
 *
 * - `data-i18n`, `data-i18n-aria`, `data-i18n-title`, `data-i18n-placeholder` on index.html
 *   elements are resolved from STATIC.
 * - The preserved hub fragment cannot carry data-* attributes, so it is translated by id/selector (HUB).
 * - A small set of English strings written at runtime by game JS is translated by exact text match (RUNTIME)
 *   through a MutationObserver; the game code is not touched. Anything not listed stays English.
 * No dependency on game logic; it only reads the locale and the `localechange` event.
 */

const STATIC = {
  "common.save": { en: "Save", pt: "Salvar" },
  "common.cancel": { en: "Cancel", pt: "Cancelar" },
  "common.close": { en: "Close", pt: "Fechar" },
  "common.gotIt": { en: "Got it", pt: "Entendi" },
  "login.eyebrow": { en: "Turn-based arena duels", pt: "Duelos de arena por turnos" },
  "login.google": { en: "Sign in with Google", pt: "Entrar com Google" },
  "login.nameLabel": { en: "Choose your display name", pt: "Escolha seu nome de exibição" },
  "login.namePlaceholder": { en: "Your champion name", pt: "Nome do seu campeão" },
  "settings.open": { en: "Settings", pt: "Configurações" },
  "settings.title": { en: "Settings", pt: "Configurações" },
  "settings.eyebrow": { en: "Preferences", pt: "Preferências" },
  "settings.music": { en: "Music", pt: "Música" },
  "settings.sfx": { en: "Sound effects", pt: "Efeitos sonoros" },
  "settings.enabled": { en: "Enabled", pt: "Ativado" },
  "settings.volume": { en: "Volume", pt: "Volume" },
  "settings.language": { en: "Language", pt: "Idioma" },
  "match.surrender": { en: "Surrender", pt: "Desistir" },
  "match.log": { en: "Combat log", pt: "Registro de combate" },
  "match.points": { en: "Points", pt: "Pontos" },
  "match.yourLineup": { en: "Your lineup", pt: "Sua formação" },
  "match.opponentLineup": { en: "Opponent lineup", pt: "Formação do oponente" },
  "match.skip": { en: "Skip slot", pt: "Pular vaga" },
  "match.undo": { en: "Undo", pt: "Desfazer" },
  "match.endTurn": { en: "End turn", pt: "Encerrar turno" },
  "firstChoice.eyebrow": { en: "The duel begins", pt: "O duelo começa" },
  "firstChoice.title": { en: "Choose your first champion", pt: "Escolha seu primeiro campeão" },
  "firstChoice.hint": {
    en: "This champion takes the field alone for the opening exchange.",
    pt: "Este campeão entra sozinho em campo na troca inicial.",
  },
  "summon.eyebrow": { en: "Reinforcements", pt: "Reforços" },
  "summon.title": { en: "Summon your allies", pt: "Invoque seus aliados" },
  "summon.hint": {
    en: "Pick a lineup champion below the arena to bring it onto the field.",
    pt: "Escolha um campeão da formação para trazê-lo ao campo.",
  },
  "summon.dontShow": { en: "Don't show this again", pt: "Não mostrar novamente" },
  "surrender.title": { en: "Surrender the duel?", pt: "Desistir do duelo?" },
  "surrender.body": { en: "Your opponent will be declared the winner.", pt: "Seu oponente será declarado vencedor." },
  "surrender.stay": { en: "Keep fighting", pt: "Continuar lutando" },
  "surrender.confirm": { en: "Surrender", pt: "Desistir" },
  "stats.eyebrow": { en: "Post-match report", pt: "Relatório da partida" },
  "stats.title": { en: "Match statistics", pt: "Estatísticas da partida" },
  "stats.damage": { en: "Damage dealt", pt: "Dano causado" },
  "stats.healingReceived": { en: "Healing received", pt: "Cura recebida" },
  "stats.healingDone": { en: "Healing done", pt: "Cura realizada" },
  "stats.rawTaken": { en: "Damage taken", pt: "Dano sofrido" },
  "stats.damageMitigated": { en: "Mitigated", pt: "Mitigado" },
  "stats.points": { en: "Points", pt: "Pontos" },
  "timer.return": { en: "Return to login", pt: "Voltar ao login" },
};

/* Preserved hub fragment: selector -> { en, pt }. Only the text node is replaced; icons stay. */
const HUB = [
  ["a.hub-manage-link", { en: "Manage teams", pt: "Gerenciar times" }],
  ["#hubRenameBtn", { en: "Display name", pt: "Nome de exibição" }],
  ["#hubSignOutBtn", { en: "Sign out", pt: "Sair" }],
  ["#hubEmpty", { en: "You have no teams. Open “Manage teams” to build one.", pt: "Você não tem times. Abra “Gerenciar times” para montar um." }],
  ["#hubCancelBtn", { en: "Cancel", pt: "Cancelar" }],
  ["#hubPlayAiBtn", { en: "Play vs AI", pt: "Jogar contra a IA" }],
  ["#hubFindMatchBtn", { en: "Find match", pt: "Buscar partida" }],
  ["#hubAiBackBtn", { en: "Back", pt: "Voltar" }],
  ["#hubAiStartBtn", { en: "Start match", pt: "Iniciar partida" }],
];

/* English strings JS writes at runtime (exact match, trimmed). */
const RUNTIME = {
  "Waiting…": "Aguardando…",
  "Waiting...": "Aguardando...",
  "Waiting for opponent...": "Aguardando o oponente...",
  "Ready up": "Prepare-se",
  "Choose your team": "Escolha seu time",
  "Connecting...": "Conectando...",
  "LAST TURN": "ÚLTIMO TURNO",
  "CLAIM": "RECLAMAR",
};

const RUNTIME_PATTERNS = [
  [/^TURN (\d+)$/, (n) => `TURNO ${n}`],
  [/^Turn (\d+)$/, (n) => `Turno ${n}`],
  [/^Returning to login in (\d+)s\.\.\.$/, (n) => `Voltando ao login em ${n}s...`],
];

let applying = false;

function pick(entry, locale) {
  return entry[locale] ?? entry.en;
}

function setTextKeepingIcons(el, text) {
  // Replace the last non-empty text node (the label) so <i> icons survive.
  const nodes = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (nodes.length) {
    const node = nodes[nodes.length - 1];
    node.textContent = ` ${text} `;
  } else {
    el.append(document.createTextNode(` ${text} `));
  }
}

function applyStatic(locale) {
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const entry = STATIC[el.dataset.i18n];
    if (entry) el.textContent = pick(entry, locale);
  }
  for (const [attr, target] of [
    ["data-i18n-aria", "aria-label"],
    ["data-i18n-title", "title"],
    ["data-i18n-placeholder", "placeholder"],
  ]) {
    for (const el of document.querySelectorAll(`[${attr}]`)) {
      const entry = STATIC[el.getAttribute(attr)];
      if (entry) el.setAttribute(target, pick(entry, locale));
    }
  }
  for (const [selector, entry] of HUB) {
    const el = document.querySelector(selector);
    if (el) setTextKeepingIcons(el, pick(entry, locale));
  }
}

function translateRuntimeNode(node, locale) {
  if (node.nodeType !== Node.TEXT_NODE) return;
  const raw = node.textContent;
  const trimmed = raw.trim();
  if (!trimmed) return;
  const original = node.__csaEn ?? trimmed;
  let out = original;
  if (locale === "pt") {
    if (RUNTIME[original]) out = RUNTIME[original];
    else {
      for (const [re, fn] of RUNTIME_PATTERNS) {
        const m = original.match(re);
        if (m) {
          out = fn(...m.slice(1));
          break;
        }
      }
    }
  }
  const known = RUNTIME[original] || RUNTIME_PATTERNS.some(([re]) => re.test(original));
  if (!known) return;
  node.__csaEn = original;
  if (out !== trimmed) node.textContent = raw.replace(trimmed, out);
}

function walkRuntime(root, locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) translateRuntimeNode(n, locale);
}

function syncRanges() {
  for (const range of document.querySelectorAll("input.ui-range")) {
    const min = Number(range.min || 0);
    const max = Number(range.max || 1);
    const pct = ((Number(range.value) - min) / (max - min || 1)) * 100;
    range.style.setProperty("--fill", `${pct}%`);
  }
}

function run() {
  const locale = getLocale();
  applying = true;
  try {
    applyStatic(locale);
    walkRuntime(document.body, locale);
    syncRanges();
  } finally {
    applying = false;
  }
}

run();
document.addEventListener("localechange", run);
document.addEventListener("input", (e) => {
  if (e.target.matches?.("input.ui-range")) syncRanges();
});

const observer = new MutationObserver((records) => {
  if (applying) return;
  const locale = getLocale();
  applying = true;
  try {
    for (const rec of records) {
      if (rec.type === "characterData") translateRuntimeNode(rec.target, locale);
      for (const added of rec.addedNodes) {
        if (added.nodeType === Node.TEXT_NODE) translateRuntimeNode(added, locale);
        else if (added.nodeType === Node.ELEMENT_NODE) walkRuntime(added, locale);
      }
    }
  } finally {
    // Records produced by our own writes are already queued; drain them so they don't loop.
    observer.takeRecords();
    applying = false;
  }
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// Volume values are restored by main.js after load; re-sync once things settle.
window.addEventListener("load", () => setTimeout(syncRanges, 300));
