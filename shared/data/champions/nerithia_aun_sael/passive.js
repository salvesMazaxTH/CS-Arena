import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "prayers_of_aun_sael",
  name: "Prayers of Aun'Sael",

  maxPrayers: 4,
  reductionPerPrayer: 10, // % less damage taken per Prayer held

  description() {
    return {
      en: `Nerithia turns every kindness into a prayer. Each time she <b>heals another ally</b> she gains <b>1</b> Prayer, up to <b>${this.maxPrayers}</b>. Each Prayer held makes her take <b>${this.reductionPerPrayer}%</b> less damage (up to <b>${this.maxPrayers * this.reductionPerPrayer}%</b>), and her ultimate spends them all. <b>Absolute Damage</b> and damage over time ignore the reduction.`,
      pt: `Nerithia transforma cada gentileza em uma prece. Sempre que <b>cura outro aliado</b>, ela ganha <b>1</b> Prece, até <b>${this.maxPrayers}</b>. Cada Prece mantida faz com que ela receba <b>${this.reductionPerPrayer}%</b> menos dano (até <b>${this.maxPrayers * this.reductionPerPrayer}%</b>), e sua suprema gasta todas elas. <b>Dano Absoluto</b> e dano ao longo do tempo ignoram a redução.`,
    };
  },

  hookScope: {
    onAfterHealing: "healSrc",
    onBeforeDmgTaking: "defender",
  },

  onAfterHealing({ healTarget, healSrc, owner, amount, context }) {
    if (!owner.alive || healSrc !== owner) return;
    if (!healTarget || healTarget === owner || healTarget.team !== owner.team) return;
    if (!(amount > 0)) return;

    owner.runtime = owner.runtime || {};
    const previous = owner.runtime.nerithiaPrayers || 0;
    if (previous >= this.maxPrayers) return;

    owner.runtime.nerithiaPrayers = previous + 1;
    const held = owner.runtime.nerithiaPrayers;
    const name = formatChampionName(owner);

    if (held === this.maxPrayers) {
      context.registerDialog({
        message: {
          en: `${name} holds all ${this.maxPrayers} Prayers! She takes ${held * this.reductionPerPrayer}% less damage.`,
          pt: `${name} guarda as ${this.maxPrayers} Preces! Ela recebe ${held * this.reductionPerPrayer}% menos dano.`,
        },
        sourceId: owner.id,
        targetId: owner.id,
      });
    }

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${name} gained 1 Prayer (${held}/${this.maxPrayers}).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${name} ganhou 1 Prece (${held}/${this.maxPrayers}).`,
      },
    };
  },

  onBeforeDmgTaking({ attacker, owner, damage }) {
    if (!attacker || !(damage > 0)) return;

    const held = owner.runtime?.nerithiaPrayers || 0;
    if (!held) return;

    return { damage: damage * (1 - (held * this.reductionPerPrayer) / 100) };
  },
};
