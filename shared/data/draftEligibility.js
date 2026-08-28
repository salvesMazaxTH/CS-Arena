/** Whether a champion may be picked during draft (released, enabled, not a minion). */
export function isChampionDraftable(championData, editMode) {
  if (!championData) return false;
  if ((championData.entityType ?? "champion") !== "champion") return false;
  if (championData.selectable === false) return false;

  const unavailable =
    championData.unreleased === true || championData.disabled === true;

  return !unavailable || editMode.unavailableChampions === true;
}
