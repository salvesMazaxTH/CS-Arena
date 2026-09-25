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
    return {
      en: `Voltexz is not something that carries lightning — she is the lightning, a storm wearing the shape of a goddess, her hair drifting like thunderheads about to break. Every skill she throws is torn out of her own substance: she takes <b>${this.recoilPercent}%</b> of its base damage as <b>Absolute</b> recoil, whether it lands or not.

      Everything she touches keeps the charge: the target is marked as a <b>Conductor</b> for <b>${this.conductorDuration}</b> turn(s), and her next strike against a <b>Conductor</b> deals <b>${this.conductorBonusPercent}%</b> bonus damage, consuming the mark.`,
      pt: `Voltexz não é alguém que carrega o raio — ela é o raio, uma tempestade com forma de deusa, os cabelos se movendo como nuvens de trovoada prestes a se romper. Toda habilidade que ela lança é arrancada da própria substância dela: ela sofre <b>${this.recoilPercent}%</b> do dano base como recuo <b>Absoluto</b>, acerte ou não.

      Tudo que ela toca guarda a carga: o alvo é marcado como <b>Condutor</b> por <b>${this.conductorDuration}</b> turno(s), e o próximo golpe dela contra um <b>Condutor</b> causa <b>${this.conductorBonusPercent}%</b> de dano bônus, consumindo a marca.`,
    };
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
