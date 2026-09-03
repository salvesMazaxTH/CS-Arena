// The game client learns its editMode from the server over the socket. Pages
// that run without a socket (the Team Manager) still need the UI-safe subset of
// it — e.g. `unavailableChampions`, which lets unreleased champions be drafted
// for testing. The game client mirrors what it receives into localStorage here,
// and the socket-free pages read it back.

const KEY = "csa.editMode";

export function mirrorEditMode(editMode) {
  try {
    localStorage.setItem(KEY, JSON.stringify(editMode));
  } catch {
    /* storage unavailable — the manager just falls back to release rules */
  }
}

export function readMirroredEditMode() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
