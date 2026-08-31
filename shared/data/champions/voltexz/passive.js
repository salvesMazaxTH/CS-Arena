import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "unstable_overcharge",
  name: "Unstable Overcharge",
  recoilPercent: 8,
  conductorDuration: 2,
  conductorBonusPercent: 15,

  hits: [
    {
      id: "recoil",
      label: "Recoil (Unstable Overcharge)",
      type: "magical",
      contact: false,
      damageMode: "absolute",
      suppressLog: true,
    },
  ],
  description() {
    return `Voltexz is not something that carries lightning — she is the lightning, a storm wearing the shape of a goddess, her hair drifting like thunderheads about to break. Every skill she throws is torn out of her own substance: she takes ${this.recoilPercent}% of its base damage as Absolute recoil, whether it lands or not.

    Everything she touches keeps the charge: the target is marked as a Conductor for ${this.conductorDuration} turn(s), and her next strike against a Conductor deals ${this.conductorBonusPercent}% bonus damage, consuming the mark.`;
  },
  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  // Conductor only — the recoil lives in skills.js so a missed shot still pays it.
  onAfterDmgDealing({ defender, skill, context }) {
    if ((context.damageDepth ?? 0) > 0) return;

    if (defender.hasStatusEffect?.("conductor")) {
      defender.removeStatusEffect("conductor");
      return;
    }

    defender.applyStatusEffect("conductor", this.conductorDuration, context, {
      sourceSkill: skill,
    });
  },

  onBeforeDmgDealing({ attacker, defender, damage, context }) {
    if (!defender.hasStatusEffect?.("conductor")) return;

    const bonusDamage = (damage * this.conductorBonusPercent) / 100;

    defender.removeStatusEffect("conductor");

    context.registerDialog({
      message: `${formatChampionName(defender)} was consumed by <b>"Conductor"</b>!`,
      sourceId: attacker.id,
      targetId: defender.id,
      duration: 1000,
      timing: "post",
    });

    return {
      damage: damage + bonusDamage,
      log: `⚡ HIT! ${formatChampionName(attacker)} discharges through the Conductor on ${formatChampionName(defender)} (+${this.conductorBonusPercent}% damage)!`,
    };
  },
};
