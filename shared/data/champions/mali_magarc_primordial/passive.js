import { formatChampionName } from "../../../ui/formatters.js";
import { unrefineMagical, drainUnrefined } from "../mali_magarc/passive.js";

export default {
  key: "nothing_refined_survives",
  name: "Nothing Refined Survives Him",

  boostedAbsorbPercent: 60,
  momentumCapPerTurn: 8,

  description() {
    return {
      en: `While Mali Magarc holds his true shape, nothing keeps its refinement near him. For as long as the form lasts, <b>${this.boostedAbsorbPercent}%</b> of the magical damage aimed at him is stripped to raw arcane, returning up to <b>${this.momentumCapPerTurn}</b> Momentum at the start of each turn.`,
      pt: `Enquanto Mali Magarc mantém sua verdadeira forma, nada preserva o refinamento perto dele. Enquanto a forma durar, <b>${this.boostedAbsorbPercent}%</b> do dano mágico direcionado a ele é despido até o arcano bruto, devolvendo até <b>${this.momentumCapPerTurn}</b> de Momentum no início de cada turno.`,
    };
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking(payload) {
    return unrefineMagical(payload, this.boostedAbsorbPercent);
  },

  onTurnStart({ owner, context }) {
    const results = [];

    const gained = drainUnrefined(owner, { perTurnCap: this.momentumCapPerTurn });
    if (gained) {
      context?.registerDialog?.({
        message: {
          en: `<b>[Passive — ${this.name}]</b> the unmade magic pours into ${formatChampionName(owner)} as <b>${gained}</b> Momentum.`,
          pt: `<b>[Passiva — ${this.name}]</b> a magia desfeita jorra em ${formatChampionName(owner)} como <b>${gained}</b> de Momentum.`,
        },
        sourceId: owner.id,
        targetId: owner.id,
      });
      results.push({
        log: {
          en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} draws <b>${gained}</b> Momentum out of the pooled essence.`,
          pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} extrai <b>${gained}</b> de Momentum da essência armazenada.`,
        },
      });
    }

    return results.length ? results : undefined;
  },
};
