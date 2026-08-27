import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "the_grace_that_remains",
  name: "The Grace That Remains",

  healCritBonus: 65,
  allyCritBuff: 10,
  allyCritDuration: 2,

  description() {
    return `Alexa Neruvya was celestial once, and was condemned for a crime immortality could not absolve. What was taken from her was never extinguished, only turned around: the edge that made her blows divine now refuses to land, and any critical hit she would deal is unmade before it arrives.

    Whenever she restores HP, her Critical is rolled as the chance for that mending to be a critical hit, restoring ${this.healCritBonus}% bonus HP and sharpening the ally with the highest Critical by +${this.allyCritBuff} Critical for ${this.allyCritDuration} turn(s).`;
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
