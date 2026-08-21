import { formatChampionName } from "../../../ui/formatters.js";

const editMode = false; // Enable to test Voltexz's recoil (damage: 0 or 999), among other things.

export default {
  key: "unstable_overcharge",
  name: "Unstable Overcharge",
  recoilPercent: 15,
  conductorDuration: 2,
  conductorBonusPercent: 15,
  description() {
    return `Voltexz is not something that carries lightning — she is the lightning, a storm wearing the shape of a goddess, her hair drifting like thunderheads about to break. Every skill she throws is torn out of her own substance: she takes ${this.recoilPercent}% of the damage actually dealt as Absolute Damage.

    Everything she touches keeps the charge: the target is marked as a Conductor for ${this.conductorDuration} turn(s), and her next strike against a Conductor deals ${this.conductorBonusPercent}% bonus damage, consuming the mark.`;
  },
  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgDealing({ attacker, defender, owner, skill, damage, context }) {
    if ((context.damageDepth ?? 0) > 0) return; // Avoids recoil on damage caused by the recoil itself, etc.

    let log = "";

    let recoilDamage = 0;

    if (damage > 0) {
      recoilDamage = editMode ? 999 : damage * (this.recoilPercent / 100);
    }

    context.extraDamageQueue ??= [];

    if (recoilDamage > 0) {
      context.extraDamageQueue.push({
        type: "magical",
        mode: "absolute",
        baseDamage: recoilDamage,
        attacker: owner,
        source: owner,
        defender: owner,
        skill: {
          key: "unstable_overcharge_recoil",
          name: "Recoil (Unstable Overcharge)",
          suppressLog: true, // <- flag to suppress default log
        },

        dialog: {
          message: `${formatChampionName(owner)} took ${Math.floor(recoilDamage)} recoil damage from "<b>Unstable Overcharge</b>"!`,
          duration: 1000,
        },
      });
      log += `[Passive - <b>Unstable Overcharge</b>] ${formatChampionName(owner)} took ${Math.floor(recoilDamage)} recoil damage.`;
    }

    if (defender.hasStatusEffect?.("conductor")) {
      defender.removeStatusEffect("conductor");
      return;
    }

    defender.applyStatusEffect("conductor", this.conductorDuration, context, {
      sourceSkill: skill,
    });

    return { log };
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
