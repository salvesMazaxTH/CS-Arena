import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "old_grudge",
  name: "Old Grudge",

  bonusDmgPercent: 25,
  ascensionThreshold: 0.30,
  ascendsInto: "clay_godslayer",

  description() {
    return `Clay doesn't care how the bloodline is dressed up — the whip felt the same either way. Every hit he lands deals ${this.bonusDmgPercent}% bonus damage against enemies of divine or demigod blood. The first time anything drives him to ${this.ascensionThreshold * 100}% HP or below, whatever was still holding finally gives, and he rises as <b>Clay, Godslayer</b> for the rest of the match.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgTaking: "defender",
  },

  // Any real HP loss counts toward the brink, reflected and burning included.
  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner) return;
    if (!Array.isArray(defender?.species)) return;
    if (!defender.species.some((s) => s === "divinity" || s === "demigod"))
      return;

    return {
      damage: Number(damage) * (1 + this.bonusDmgPercent / 100),
    };
  },

  onAfterDmgTaking({ owner, actualDmg, context }) {
    if (!(actualDmg > 0) || !owner.alive) return;
    if (owner.runtime.clayAscended) return;
    if (owner.HP > owner.maxHP * this.ascensionThreshold) return;

    owner.runtime.clayAscended = true;

    // No duration: the ascension never reverts.
    context.requestChampionMutation({
      mode: "transform",
      targetId: owner.id,
      newChampionKey: this.ascendsInto,
      hpMode: "preserveRatio",
      statMode: "deltaFromBase",
    });

    context.registerDialog({
      message: `${formatChampionName(owner)} stops being something anyone can put back in chains.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} rises as <b>Clay, Godslayer</b>.`,
    };
  },
};
