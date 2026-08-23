import { formatChampionName } from "../../../ui/formatters.js";

const MAX_CRIT_CHANCE = 95;

export default {
  key: "mercy_of_the_fallen_queen",
  name: "Mercy of the Fallen Queen",

  healCritBonus: 55,
  allyCritBuff: 10,
  allyCritDuration: 2,

  description() {
    return `Alexa Neruvya wore a crown once and lost it, and the edge she kept from that life she has spent every century refusing to use: any critical hit she would land is unmade before it arrives.

    The precision is not gone, only turned around. Whenever she restores HP, her Critical is rolled as the chance for that mending to be a critical hit, restoring ${this.healCritBonus}% bonus HP and sharpening the ally with the highest Critical by +${this.allyCritBuff} Critical for ${this.allyCritDuration} turn(s).`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBeforeHealing: "source",
  },

  // Her Critical is reserved for mending, so damage criticals are unmade.
  onBeforeDmgDealing({ crit }) {
    if (!crit?.didCrit) return;

    return { crit: { ...crit, didCrit: false, bonus: 0, critExtra: 0 } };
  },

  onBeforeHealing({ owner, target, amount, context }) {
    if (amount <= 0) return;

    const chance = Math.min(owner.Critical, MAX_CRIT_CHANCE);
    if (Math.random() * 100 >= chance) return;

    context.registerDialog({
      message: `💧 The tide runs deep — ${formatChampionName(target)} is mended beyond measure!`,
      sourceId: owner.id,
      targetId: target.id,
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
