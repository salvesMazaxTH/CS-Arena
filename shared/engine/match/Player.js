export class Player {
  constructor({ id, username, team, userId = null }) {
    this.id = id;
    this.username = username;
    this.userId = userId;
    this.team = team;
    this.socketId = null;
    this.selectedChampionKeys = [];
    this.emblems = [];
    // Emblem key -> id of the champion whose arrival triggered it (null when the
    // trigger was not an arrival). The opponent only sees revealed emblems.
    this.revealedEmblems = new Map();
  }

  setEmblems(emblems = []) {
    this.emblems = emblems;
    this.revealedEmblems.clear();
  }

  /** Records an emblem's first trigger; later triggers change nothing. */
  revealEmblem(emblemKey, championId = null) {
    if (this.revealedEmblems.has(emblemKey)) return;
    this.revealedEmblems.set(emblemKey, championId);
  }

  setSocket(socketId) {
    this.socketId = socketId;
  }

  clearSocket() {
    this.socketId = null;
  }

  setSelectedChampionKeys(championKeys = []) {
    this.selectedChampionKeys = Array.isArray(championKeys) ? championKeys : [];
  }

  clearChampionSelection() {
    this.selectedChampionKeys = [];
  }

  isTeamSelected() {
    return this.selectedChampionKeys.length > 0;
  }
}
