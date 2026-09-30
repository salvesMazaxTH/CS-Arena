import { formatChampionName } from "../../../ui/formatters.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";

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
      pt: `Alexa Neruvya já habitou os céus, até ser condenada por um crime que nem a imortalidade conseguiu perdoar. O que lhe arrancaram não morreu, só virou do avesso: o gume que fazia seus golpes divinos agora se nega a cortar, e todo <b>acerto crítico</b> que ela causaria se desfaz antes de chegar.

      Toda vez que ela cura, é o seu <b>Crítico</b> que decide se a água vem mais funda: numa <b>cura crítica</b>, ela restaura <b>${this.healCritBonus}%</b> a mais de <b>HP</b>, e o gume que lhe foi negado passa ao aliado de maior <b>Crítico</b>, que ganha <b>+${this.allyCritBuff}</b> de <b>Crítico</b> por <b>${this.allyCritDuration}</b> turno(s).`,
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
      message: {
        en: `💧 The tide runs deep — ${formatChampionName(healTarget)} is mended beyond measure!`,
        pt: `💧 A maré vem funda — ${formatChampionName(healTarget)} recebe cuidado muito além da conta!`,
      },
      sourceId: owner.id,
      targetId: healTarget.id,
    });

    const blessed = this._pickSharpestAlly(owner, context);

    if (blessed) {
      blessed.modifyStat({
        statName: "Critical",
        amount: this.allyCritBuff,
        duration: this.allyCritDuration,
        context,
        statModifierSrc: owner,
      });

      context.registerDialog({
        message: {
          en: `${formatChampionName(blessed)} feels the water sharpen around them!`,
          pt: `${formatChampionName(blessed)} sente a água ganhar gume ao seu redor!`,
        },
        sourceId: owner.id,
        targetId: blessed.id,
      });
    }

    return { amount: Math.floor(amount * (1 + this.healCritBonus / 100)) };
  },

  // The sharpest ally takes the surge; ties fall to Attack, then to a fair coin.
  _pickSharpestAlly(owner, context) {
    const allies = TargetFilter.candidates(
      { type: "ally", excludesSelf: true },
      owner,
      context.aliveChampions ?? [],
    );
    if (!allies.length) return null;

    const rank = (a, b) => b.Critical - a.Critical || b.Attack - a.Attack;
    const [top] = [...allies].sort(rank);
    const tied = allies.filter((champ) => rank(top, champ) === 0);

    return tied[Math.floor(Math.random() * tied.length)];
  },
};
