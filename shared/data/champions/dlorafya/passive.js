import { formatChampionName } from "../../../ui/formatters.js";
import { DLORAFYA_BURN_DAMAGE_MULTIPLIER } from "./skills.js";

export default {
  key: "verdict_of_the_pyre",
  name: "Verdict of the Pyre",

  // --- Judgment (anti-armor) ---
  // 1% of the target's Defense is ignored for each point of Defense the
  // target has above D'Lorafya's own.
  piercingPerExcessPoint: 1,
  piercingCap: 75,
  piercingCapVsBurning: 100,
  heavyJudgmentThreshold: 70,
  heavyJudgmentPenalty: 0.35,

  description(champion) {
    return {
      en:
        `<b>Judgment:</b> those who hide behind armor are judged by it. When D'Lorafya damages a target whose <b>Defense</b> is higher than his own, ` +
        `the hit becomes <b>Piercing</b>, ignoring <b>${this.piercingPerExcessPoint}%</b> of the target's <b>Defense</b> per point of <b>Defense</b> above his ` +
        `(max <b>${this.piercingCap}%</b>, or <b>${this.piercingCapVsBurning}%</b> against a <b>Burning</b> target, which makes the hit <b>Absolute</b>). ` +
        `A judgment of <b>${this.heavyJudgmentThreshold}%</b> or more consumes the flame: the hit deals <b>${Math.round(this.heavyJudgmentPenalty * 100)}%</b> less damage.<br>` +
        `<b>Divine Flame:</b> his <b>Burning</b> is no mortal flame: it sears for <b>${DLORAFYA_BURN_DAMAGE_MULTIPLIER}x</b> the damage of an ordinary <b>Burn</b> each turn.`,
        pt:
        `<b>Julgamento:</b> quem se esconde atrás da armadura é julgado por ela. Quando D'Lorafya causa dano a um alvo com <b>Defesa</b> maior que a sua, ` +
        `o golpe se torna <b>Perfurante</b>, ignorando <b>${this.piercingPerExcessPoint}%</b> da <b>Defesa</b> do alvo para cada ponto de <b>Defesa</b> acima da sua ` +
        `(máx. <b>${this.piercingCap}%</b>, ou <b>${this.piercingCapVsBurning}%</b> contra um alvo <b>Queimando</b>, o que torna o golpe <b>Absoluto</b>). ` +
        `Um julgamento de <b>${this.heavyJudgmentThreshold}%</b> ou mais consome a chama: o golpe causa <b>${Math.round(this.heavyJudgmentPenalty * 100)}%</b> menos dano.<br>` +
        `<b>Chama Divina:</b> sua <b>Queimadura</b> não é chama mortal: ela abrasa por <b>${DLORAFYA_BURN_DAMAGE_MULTIPLIER}x</b> o dano de uma <b>Queimadura</b> comum a cada turno.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({
    attacker,
    owner,
    defender,
    mode,
    damage,
    piercingPercentage,
  }) {
    if (attacker !== owner) return;
    if (!defender) return;
    if (mode === "absolute") return;

    const excess = Number(defender.Defense || 0) - Number(owner.Defense || 0);
    if (excess <= 0) return;

    const cap = defender.hasStatusEffect?.("burning")
      ? this.piercingCapVsBurning
      : this.piercingCap;

    const judged = Math.min(cap, excess * this.piercingPerExcessPoint);

    // The deeper the flame eats through armor, the less of it is left to burn.
    const scorched = judged >= this.heavyJudgmentThreshold;
    const scaled = scorched
      ? { damage: Number(damage || 0) * (1 - this.heavyJudgmentPenalty) }
      : {};
    const spentEn = scorched
      ? `, but spends itself doing so (-${Math.round(this.heavyJudgmentPenalty * 100)}% damage)`
      : "";
    const spentPt = scorched
      ? `, mas se consome ao fazê-lo (-${Math.round(this.heavyJudgmentPenalty * 100)}% de dano)`
      : "";

    if (judged >= 100) {
      return {
        ...scaled,
        mode: "absolute",
        log: {
          en:
            `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} passes final judgment on ` +
            `${formatChampionName(defender)}: the flame ignores their Defense and all damage reduction entirely${spentEn}.`,
          pt:
            `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} profere o julgamento final sobre ` +
            `${formatChampionName(defender)}: a chama ignora completamente sua Defesa e toda redução de dano${spentPt}.`,
        },
      };
    }

    if (mode === "piercing" && Number(piercingPercentage || 0) >= judged) {
      return;
    }

    return {
      ...scaled,
      mode: "piercing",
      piercingPercentage: judged,
      log: {
        en:
          `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)}'s flame judges ` +
          `${formatChampionName(defender)}'s armor, ignoring ${Math.round(judged)}% of their Defense${spentEn}.`,
        pt:
          `<b>[Passiva — ${this.name}]</b> a chama de ${formatChampionName(owner)} julga ` +
          `a armadura de ${formatChampionName(defender)}, ignorando ${Math.round(judged)}% de sua Defesa${spentPt}.`,
      },
    };
  },
};
