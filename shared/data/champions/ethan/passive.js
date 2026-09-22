import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "cold_reckoning",
  name: "Cold Reckoning",

  bonusDmgPercent: 20,
  corruptsInto: "lord_of_the_shadowflame",

  description() {
    return {
      en: `Ethan doesn't need luck, just an opening — and a debuffed enemy is nothing but openings. Every hit he lands deals <b>${this.bonusDmgPercent}%</b> bonus damage against a target already carrying a negative status effect. The first time an ally falls in battle while he's still standing, whatever composure he had left goes down with them, and — if nothing else has already claimed that hunger — he rises as the <b>Lord of the Shadowflame</b>.`,
      pt: `Ethan não precisa de sorte, só de uma abertura — e um inimigo debilitado é só abertura. Todo golpe que ele acerta causa <b>${this.bonusDmgPercent}%</b> de dano bônus contra um alvo já sob um efeito de status negativo. Na primeira vez que um aliado cai em batalha enquanto ele ainda está de pé, o que restava de sua compostura vai junto — e, se nada mais já tiver reclamado essa fome, ele ressurge como o <b>Lorde da Chama Sombria</b>.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner) return;
    const hasDebuff = [...(defender?.statusEffects?.values() ?? [])].some(
      (effect) => effect.type === "debuff",
    );
    if (!hasDebuff) return;

    return {
      damage: Number(damage) * (1 + this.bonusDmgPercent / 100),
    };
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (!owner.alive || owner.runtime.ethanCorrupted) return;
    if (deadChampion === owner) return;
    if (deadChampion.team !== owner.team) return;

    owner.runtime.ethanCorrupted = true;

    const shadowflameClaimed =
      context.matchChampions.some((c) => c.championKey === this.corruptsInto) ||
      (context.flags.championMutationRequests ?? []).some(
        (r) => r.newChampionKey === this.corruptsInto,
      );
    if (shadowflameClaimed) return;

    owner.runtime.shadowflameArrivedTurn = context.currentTurn;

    context.requestChampionMutation({
      mode: "transform",
      targetId: owner.id,
      newChampionKey: this.corruptsInto,
      hpMode: "preserveRatio",
      statMode: "deltaFromBase",
    });

    context.registerDialog({
      message: {
        en: `${formatChampionName(owner)} stops counting angles — there's nothing left worth calculating.`,
        pt: `${formatChampionName(owner)} para de calcular ângulos — não sobra mais nada que valha a pena calcular.`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} rises as <b>the Lord of the Shadowflame</b>.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} se ergue como <b>o Senhor da Chama Sombria</b>.`,
      },
    };
  },
};
