import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "the_grace_that_remains",
  name: "The Grace That Remains",

  healCritBonus: 65,
  allyCritBuff: 10,
  allyCritDuration: 2,

  description() {
    return {
      en: `Alexa Neruvya was celestial once, and was condemned for a crime immortality could not absolve. What was taken from her was never extinguished, only turned around: the edge that made her blows divine now refuses to land, and any critical hit she would deal is unmade before it arrives.

    Whenever she restores <b>HP</b>, her <b>Critical</b> is rolled as the chance for that mending to be a critical hit, restoring <b>${this.healCritBonus}%</b> bonus <b>HP</b> and sharpening the ally with the highest <b>Critical</b> by <b>+${this.allyCritBuff}</b> <b>Critical</b> for <b>${this.allyCritDuration}</b> turn(s).`,
      pt: `Alexa Neruvya já foi celestial, e foi condenada por um crime que nem a imortalidade poderia absolver. O que lhe foi tirado nunca se extinguiu, apenas se inverteu: o fio que tornava seus golpes divinos agora se recusa a acertar, e qualquer crítico que ela causaria se desfaz antes de chegar.

    Sempre que restaura <b>HP</b>, seu <b>Crítico</b> é sorteado como a chance daquele cuidado ser um acerto crítico, restaurando <b>${this.healCritBonus}%</b> de <b>HP</b> bônus e afiando o aliado com o maior <b>Crítico</b> em <b>+${this.allyCritBuff}</b> de <b>Crítico</b> por <b>${this.allyCritDuration}</b> turno(s).`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBeforeHealing: "healSrc",
  },

  // Her Critical is reserved for mending, so damage criticals are unmade.
  onBeforeDmgDealing({ crit }) {
    if (!crit?.didCrit) return;

    return { crit: { ...crit, didCrit: false, bonus: 0, critExtra: 0 } };
  },

  onBeforeHealing({ owner, healTarget, amount, context }) {
    if (amount <= 0 || healTarget.HP >= healTarget.maxHP) return;

    if (Math.random() * 100 >= owner.Critical) return;

    context.registerDialog({
      message: `💧 The tide runs deep — ${formatChampionName(healTarget)} is mended beyond measure!`,
      sourceId: owner.id,
      targetId: healTarget.id,
    });

    // The sharpest ally takes the surge; ties fall to Attack, then to chance.
    const blessed = context.aliveChampions
      .filter((champ) => champ.team === owner.team && champ.id !== owner.id)
      .sort(
        (a, b) =>
          b.Critical - a.Critical || b.Attack - a.Attack || Math.random() - 0.5,
      )[0];

    if (blessed) {
      blessed.modifyStat({
        statName: "Critical",
        amount: this.allyCritBuff,
        duration: this.allyCritDuration,
        context,
      });

      context.registerDialog({
        message: `${formatChampionName(blessed)} feels the water sharpen around them!`,
        sourceId: owner.id,
        targetId: blessed.id,
      });
    }

    return { amount: Math.floor(amount * (1 + this.healCritBonus / 100)) };
  },
};
