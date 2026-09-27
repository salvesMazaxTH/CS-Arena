import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const yresaColossusSkills = [
  basicStrike,

  {
    key: "stonecall",
    name: "Stonecall",

    contact: false,
    priority: 3,
    tauntDuration: 1,

    description() {
      return {
        en: `The <b>Colossus</b> sets one foot down and the whole field tilts toward it. <b>Every enemy</b> is <b>Taunted</b> for <b>${this.tauntDuration}</b> turn(s).`,
        pt: `O <b>Colossus</b> assenta um pé no chão e o campo inteiro se inclina na direção dele. <b>Todos os inimigos</b> ficam <b>Provocados</b> por <b>${this.tauntDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const results = [];

      for (const enemy of targets) {
        const tauntLog = enemy.applyTaunt(user.id, this.tauntDuration, context);
        if (tauntLog) results.push(tauntLog);
      }

      results.push({
        log: {
          en: `${formatChampionName(user)} sets its weight down and every enemy turns to face it.`,
          pt: `${formatChampionName(user)} assenta seu peso e todos os inimigos se voltam para ele.`,
        },
      });

      return results;
    },
  },
];

export default yresaColossusSkills;
