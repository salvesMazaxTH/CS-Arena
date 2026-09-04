// The plate ladder VØRN Ω walks down. It only ever goes one way: a plate that
// has come off is off for the rest of the match. The plates are not armour —
// they are the governors his makers bolted on to keep him answerable.

export const MAX_PLATES = 3;

const PLATE_THRESHOLDS = [0.75, 0.5, 0.25];
const ATTACK_PERCENT_PER_PLATE = 25;

export const CC_IMMUNE_AT = 1;
export const IGNORES_REDUCTION_AT = 2;
export const DAMAGE_CAP_AT = 3;
export const DAMAGE_CAP_PERCENT = 12;

export function platesShed(champion) {
  return champion.runtime.vornPlatesShed ?? 0;
}

/** How many plates the machine's current HP has already cost it. */
export function platesDue(champion) {
  const ratio = champion.HP / champion.maxHP;
  return PLATE_THRESHOLDS.filter((threshold) => ratio <= threshold).length;
}

/** Sheds up to `count` plates, returning how many actually came off. */
export function shedPlates(champion, count, context) {
  const already = platesShed(champion);
  const shedding = Math.min(count, MAX_PLATES - already);
  if (shedding <= 0) return 0;

  champion.runtime.vornPlatesShed = already + shedding;

  champion.modifyStat({
    statName: "Attack",
    amount: ATTACK_PERCENT_PER_PLATE * shedding,
    context,
    isPermanent: true,
    isPercent: true,
  });

  return shedding;
}

export const PLATE_TEXT = `Each of the ${MAX_PLATES} plates is worth +${ATTACK_PERCENT_PER_PLATE}% Attack, permanently. The first leaves nothing on him for a Control effect to seize; the second lets his blows past any damage reduction; the third means no single source can take more than ${DAMAGE_CAP_PERCENT}% of his Max HP from him at once.`;
