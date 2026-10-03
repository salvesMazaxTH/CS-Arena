import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "slower_than_the_storm",
  name: "Slower Than the Storm",

  slowEnough: 75,

  description() {
    return {
      en: `To Thorwells a mortal's swing is a letter posted a week too early — he reads its whole arc and is simply elsewhere when it lands. The first instance of damage each turn from an attacker whose <b>Speed</b> is <b>${this.slowEnough}</b> or lower is evaded outright; <b>Absolute Damage</b>, and blows that <b>cannot be evaded</b>, still find him. Nothing drags at his own tempo: his <b>Speed</b> cannot be reduced.`,
      pt: `Para Thorwells, o golpe de um mortal é uma carta postada com uma semana de antecedência — ele lê todo o arco do movimento e simplesmente já não está mais lá quando ele chega. A primeira instância de dano em cada turno vinda de um atacante com <b>Velocidade</b> igual ou menor que <b>${this.slowEnough}</b> é esquivada automaticamente; <b>Dano Absoluto</b> e golpes que <b>não podem ser esquivados</b> ainda o alcançam. Nada altera o ritmo dele: sua <b>Velocidade</b> não pode ser reduzida.`,
    };
  },

  hookScope: {
    onDamageIncoming: "defender",
    onStatModifierIncoming: "target",
  },

  onStatModifierIncoming({ owner, statName, amount }) {
    if (statName !== "Speed" || amount >= 0) return;

    return {
      cancel: true,
      message: {
        en: `<b>[Passive — ${this.name}]</b> the storm sets no pace for ${formatChampionName(owner)} — his Speed holds.`,
        pt: `<b>[Passiva — ${this.name}]</b> a tempestade não dita o ritmo de ${formatChampionName(owner)} — sua Velocidade se mantém.`,
      },
    };
  },

  onDamageIncoming({ attacker, defender, owner, skill, damage, mode, context }) {
    if (defender !== owner) return;
    if (!attacker || attacker.team === owner.team) return;
    if (!(damage > 0)) return;

    // These never reach the evade branch anyway; bail early so the once-per-turn
    // read is not spent on a blow it could not have stepped through.
    if (mode === "absolute" || skill?.cannotBeEvaded || skill?.cannotMiss)
      return;
    if (context?.isDot || (context?.damageDepth ?? 0) > 0) return;

    if (owner.runtime.slowerThanStormTurn === context.currentTurn) return;
    if (Number(attacker.Speed) > this.slowEnough) return;

    owner.runtime.slowerThanStormTurn = context.currentTurn;

    context.registerDialog({
      message: {
        en: `${formatChampionName(attacker)}'s blow was loosed a week too early — ${formatChampionName(owner)} is not where it falls.`,
        pt: `O golpe de ${formatChampionName(attacker)} saiu uma semana adiantado — ${formatChampionName(owner)} já não está onde ele cai.`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      evade: true,
      message: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} reads ${formatChampionName(attacker)} and steps clean through the blow.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} lê ${formatChampionName(attacker)} e passa ileso pelo golpe.`,
      },
    };
  },
};
