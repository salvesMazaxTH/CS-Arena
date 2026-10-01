// Entry grants: the permanent bonuses an emblem hands each allied champion in
// its onChampionAdded hook. A team carries each emblem once (validateTeam) and
// onChampionAdded fires once per spawned instance, so no grant needs a flag.

/** Permanent flat stat bonuses, given as `{ statName: amount }`. */
export function grantStats(champion, stats, context) {
  for (const [statName, amount] of Object.entries(stats)) {
    champion.modifyStat({ statName, amount, context, isPermanent: true });
  }
}

/** Permanent Max HP bonus worth `percent`% of the Max HP the champion enters with. */
export function grantMaxHPPercent(champion, percent, context) {
  const amount = Math.max(1, Math.round((champion.maxHP * percent) / 100));
  champion.modifyHP(amount, { affectMax: true, isPermanent: true, context });
}
