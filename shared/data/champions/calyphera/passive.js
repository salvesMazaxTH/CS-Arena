import { formatChampionName } from "../../../ui/formatters.js";

export const DAMAGE_PER_FACET = 200;
const MAX_FACETS = 8;
const BONUS_PER_FACET = 5;
const TRANSFIGURED_BONUS_PER_FACET = 10;

export function accrueLight(owner, amount, context) {
  if (!(amount > 0)) return [];

  owner.runtime ??= {};

  const before = owner.runtime.calypheraFacets || 0;

  if (before >= MAX_FACETS) return [];

  owner.runtime.calypheraLight = (owner.runtime.calypheraLight || 0) + amount;

  const after = Math.min(
    Math.floor(owner.runtime.calypheraLight / DAMAGE_PER_FACET),
    MAX_FACETS,
  );

  if (after === before) return [];

  owner.runtime.calypheraFacets = after;

  const logs = [
    {
      log: `<b>[Passive — Second Sutra: Every Crack a Window]</b> ${formatChampionName(
        owner,
      )} takes ${after - before} new Facet(s) (${after}/${MAX_FACETS}).`,
    },
  ];

  if (after < MAX_FACETS) return logs;

  owner.runtime.calypheraTransfigured = true;

  context?.registerDialog?.({
    message: `${formatChampionName(owner)} finishes breaking, and the light goes all the way through.`,
    sourceId: owner.id,
  });

  logs.push({
    log: `<b>[Passive — Second Sutra: Every Crack a Window]</b> The last Facet opens. ${formatChampionName(
      owner,
    )} is a window now — every Facet is worth ${TRANSFIGURED_BONUS_PER_FACET}% and the fist has nothing left to break.`,
  });

  return logs;
}

export default {
  key: "second_sutra_every_crack_a_window",
  name: "Second Sutra: Every Crack a Window",

  damagePerFacet: DAMAGE_PER_FACET,
  maxFacets: MAX_FACETS,
  bonusPerFacet: BONUS_PER_FACET,
  transfiguredBonusPerFacet: TRANSFIGURED_BONUS_PER_FACET,
  physicalVulnerabilityPercent: 15,

  description(champion) {
    const facets = champion.runtime?.calypheraFacets || 0;
    const transfigured = champion.runtime?.calypheraTransfigured;

    return `Calyphera was given a body of glass and told to carry it kneeling, and every blow of the long fight writes another line of light through her. Every ${this.damagePerFacet} damage she accumulates, dealt or suffered, cuts one more <b>Facet</b> into her (Max: ${this.maxFacets}). Each Facet she carries raises the damage she deals by ${this.bonusPerFacet}%.

    Glass answers the fist more readily than the word: she takes ${this.physicalVulnerabilityPercent}% more physical damage.

    The ${this.maxFacets}th Facet finishes her, once per match and for good: every Facet is worth ${this.transfiguredBonusPerFacet}% instead, and there is no longer anything solid in her for a physical blow to find.

    <b>Current Facets: ${facets}/${this.maxFacets}${transfigured ? " — Transfigured" : ""}</b>`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgTaking({ owner, type, damage }) {
    if (type !== "physical" || owner.runtime?.calypheraTransfigured) return;
    return { damage: damage * (1 + this.physicalVulnerabilityPercent / 100) };
  },

  onAfterDmgTaking({ owner, attacker, actualDmg, context }) {
    if (attacker === owner || !(actualDmg > 0)) return;
    return accrueLight(owner, actualDmg, context);
  },

  onAfterDmgDealing({ owner, defender, damage, context }) {
    if (defender.team === owner.team || !(damage > 0)) return;
    return accrueLight(owner, damage, context);
  },

  onBeforeDmgDealing({ owner, defender, damage }) {
    const facets = owner.runtime?.calypheraFacets || 0;

    if (!facets || defender.team === owner.team) return;

    const perFacet = owner.runtime.calypheraTransfigured
      ? this.transfiguredBonusPerFacet
      : this.bonusPerFacet;

    return { damage: damage * (1 + (facets * perFacet) / 100) };
  },
};
