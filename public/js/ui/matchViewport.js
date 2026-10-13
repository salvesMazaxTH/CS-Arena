import { resolveText } from "../../../shared/i18n/locale.js";
import { getLocale } from "../i18n/clientLocale.js";

// The match screen is laid out on a fixed design stage (see matchView.css) and
// scaled to fit the window. This module owns that scaling, the portrait guard,
// and the combat-log drawer. It follows #main-content's visibility instead of
// being called from every screen switch, so no screen-switching code changes.

const DESIGN = { width: 1920, height: 1080 };
const LOG_TOGGLE_KEY = "l";

const LOG_CLOSE_LABEL = { en: "Close combat log", pt: "Fechar registro de combate" };

const ROTATE_TEXT = {
  en: "Rotate your device to play. Champion Showdown Arena is played in landscape.",
  pt: "Gire o dispositivo para jogar. O Champion Showdown Arena é jogado na horizontal.",
};

export function createMatchViewport({ onEnter, onLeave } = {}) {
  const root = document.documentElement;
  const mainContent = document.getElementById("main-content");
  const stage = document.getElementById("match-stage");
  const log = document.getElementById("combat-log");
  const logToggleBtn = document.getElementById("log-toggle-btn");
  const logUnreadDot = logToggleBtn?.querySelector(".hud-unread-dot");
  const logCloseBtn = document.getElementById("combat-log-close");
  const rotateText = document.getElementById("rotate-overlay-text");

  let active = false;
  let logObserver = null;

  function applyScale() {
    if (!stage) return;
    const scale = Math.min(
      window.innerWidth / DESIGN.width,
      window.innerHeight / DESIGN.height,
    );
    stage.style.setProperty("--match-scale", scale.toFixed(4));
    root.classList.toggle("match-portrait", window.innerHeight > window.innerWidth);
  }

  function setLogOpen(open) {
    root.classList.toggle("log-open", open);
    logToggleBtn?.setAttribute("aria-expanded", String(open));
    if (open) logUnreadDot?.classList.add("hidden");
  }

  function toggleLog() {
    setLogOpen(!root.classList.contains("log-open"));
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && root.classList.contains("log-open")) {
      setLogOpen(false);
      return;
    }
    if (event.key.toLowerCase() !== LOG_TOGGLE_KEY) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
    toggleLog();
  }

  function enter() {
    if (active) return;
    active = true;
    root.classList.add("match-view");
    onEnter?.();
    logCloseBtn?.setAttribute("aria-label", resolveText(LOG_CLOSE_LABEL, getLocale()));
    if (rotateText) rotateText.textContent = resolveText(ROTATE_TEXT, getLocale());
    applyScale();
    window.addEventListener("resize", applyScale);
    window.addEventListener("orientationchange", applyScale);
    window.addEventListener("keydown", onKeyDown);

    if (log) {
      logObserver = new MutationObserver(() => {
        if (!root.classList.contains("log-open")) logUnreadDot?.classList.remove("hidden");
      });
      logObserver.observe(log, { childList: true });
    }
  }

  function leave() {
    if (!active) return;
    active = false;
    onLeave?.();
    root.classList.remove("match-view", "match-portrait", "log-open");
    logToggleBtn?.setAttribute("aria-expanded", "false");
    logUnreadDot?.classList.add("hidden");
    window.removeEventListener("resize", applyScale);
    window.removeEventListener("orientationchange", applyScale);
    window.removeEventListener("keydown", onKeyDown);
    logObserver?.disconnect();
    logObserver = null;
  }

  function syncWithScreen() {
    if (mainContent?.classList.contains("visible")) enter();
    else leave();
  }

  logToggleBtn?.addEventListener("click", toggleLog);
  logCloseBtn?.addEventListener("click", () => setLogOpen(false));
  document.getElementById("combat-log-scrim")?.addEventListener("click", () => setLogOpen(false));

  if (mainContent) {
    new MutationObserver(syncWithScreen).observe(mainContent, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  syncWithScreen();

  return { enter, leave, isActive: () => active };
}
