// shared/data/emblems/tempered_steel.js

import { hasElement } from "../../engine/combat/elements.js";
import { formatChampionName } from "../../ui/formatters.js";
import { grantStats, isEmblemBeneficiary } from "./emblemGrants.js";

// The 3-steel tier below Impervious Steel. Steel that has already been through
// the forge: it shrugs off Fire, and a heavy blow (contact or Fire) only
// tempers it harder.
export const temperedSteel = {
  key: "tempered_steel",
  name: "Emblem of Tempered Steel",
  defenseBonus: 5,
  fireDamageReductionPercent: 20,
  hardenDefenseBonus: 5,
  hardenMaxTriggers: 3,
  hardenMinHitPercent: 12,

  requirements: {
    elementalAffinity: {
      element: "steel",
      count: 3,
    },
  },

  description() {
    return {
      en: `Your champions gain <b>+${this.defenseBonus}</b> <b>Defense</b> and take <b>${this.fireDamageReductionPercent}%</b> less <b>Fire</b> damage (except <b>Absolute Damage</b>). When a <b>contact</b> or <b>Fire</b> hit takes more than <b>${this.hardenMinHitPercent}%</b> of a champion's Max HP, it gains <b>+${this.hardenDefenseBonus}</b> <b>Defense</b>, up to <b>${this.hardenMaxTriggers}</b> times.`,
      pt: `Seus campeões ganham <b>+${this.defenseBonus}</b> de <b>Defesa</b> e sofrem <b>${this.fireDamageReductionPercent}%</b> menos dano de <b>Fogo</b> (exceto <b>Dano Absoluto</b>). Quando um golpe de <b>contato</b> ou de <b>Fogo</b> tira mais de <b>${this.hardenMinHitPercent}%</b> do HP máximo de um campeão, ele ganha <b>+${this.hardenDefenseBonus}</b> de <b>Defesa</b>, até <b>${this.hardenMaxTriggers}</b> vezes.`,
    };
  },

  // The Fire reduction also covers Burning ticks; the hardening is a hit-only
  // trigger, so it keeps the default policy (no DoT, no nested damage).
  hookPolicies: {
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onChampionAdded({ champion, owner, context }) {
    // `owner` is the Player carrying the emblem; `champion` is the one entering.
    if (!isEmblemBeneficiary(champion, owner)) return;

    grantStats(champion, { Defense: this.defenseBonus }, context);

    return true;
  },

  onBeforeDmgTaking({ defender, owner, element, damage }) {
    if (!defender || !owner || !isEmblemBeneficiary(defender, owner)) return;
    if (!hasElement(element, "fire") || !(damage > 0)) return;

    return { damage: damage * (1 - this.fireDamageReductionPercent / 100) };
  },

  onAfterDmgTaking({ defender, owner, element, contact, actualDmg, context }) {
    if (!defender?.alive || !owner || !isEmblemBeneficiary(defender, owner)) return;
    if (!contact && !hasElement(element, "fire")) return;
    if (!(actualDmg > (defender.maxHP * this.hardenMinHitPercent) / 100)) return;

    defender.runtime.temperedHardenings ??= 0;
    if (defender.runtime.temperedHardenings >= this.hardenMaxTriggers) return;
    defender.runtime.temperedHardenings++;

    grantStats(defender, { Defense: this.hardenDefenseBonus }, context);

    return {
      log: {
        en: `<b>[Emblem — Tempered Steel]</b> the blow only tempers ${formatChampionName(defender)}'s steel harder: <b>+${this.hardenDefenseBonus}</b> Defense.`,
        pt: `<b>[Emblema — Tempered Steel]</b> o golpe só tempera o aço de ${formatChampionName(defender)} ainda mais: <b>+${this.hardenDefenseBonus}</b> de Defesa.`,
      },
    };
  },
};
