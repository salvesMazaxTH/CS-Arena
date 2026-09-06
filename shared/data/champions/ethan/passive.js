import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "cold_reckoning",
  name: "Cold Reckoning",

  bonusDmgPercent: 20,
  corruptsInto: "lord_of_the_shadowflame",

  description() {
    return `Ethan doesn't need luck, just an opening — and a debuffed enemy is nothing but openings. Every hit he lands deals ${this.bonusDmgPercent}% bonus damage against a target already carrying a negative status effect. The first time an ally falls in battle while he's still standing, whatever composure he had left goes down with them, and — if nothing else has already claimed that hunger — he rises as the <b>Lord of the Shadowflame</b>.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner) return;
    const hasDebuff = [...(defender?.statusEffects?.values() ?? [])].some(
      (effect) => effect.type === "debuff",
    );
    if (!hasDebuff) return;

    return {
      damage: Number(damage) * (1 + this.bonusDmgPercent / 100),
    };
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (!owner.alive || owner.runtime.ethanCorrupted) return;
    if (deadChampion === owner) return;
    if (deadChampion.team !== owner.team) return;

    owner.runtime.ethanCorrupted = true;

    const shadowflameClaimed = context.aliveChampions.some(
      (c) => c.championKey === this.corruptsInto,
    );
    if (shadowflameClaimed) return;

    context.requestChampionMutation({
      mode: "transform",
      targetId: owner.id,
      newChampionKey: this.corruptsInto,
      hpMode: "preserveRatio",
      statMode: "deltaFromBase",
    });

    context.registerDialog({
      message: `${formatChampionName(owner)} stops counting angles — there's nothing left worth calculating.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} rises as <b>the Lord of the Shadowflame</b>.`,
    };
  },
};
