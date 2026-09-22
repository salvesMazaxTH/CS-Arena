import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "weight_of_the_bolt",
  name: "Weight of the Bolt",

  onHitMaxHPPercent: 6,
  poisonedStacks: 1,

  description() {
    return {
      en: `Julian will not stoop to aiming for the weak point — a bolt of his, buried anywhere, outweighs a lesser marksman's perfect shot. His two special bolts each carry bonus damage equal to <b>${this.onHitMaxHPPercent}%</b> of the chosen target's Max HP as <b>Piercing damage</b>, and every bolt he fires — the ultimate among them — leaves any target not already <b>Poisoned</b> with <b>${this.poisonedStacks}</b> stack of <b>Poisoned</b> from the coating he mixes himself.`,
      pt: `Julian não perde tempo mirando o ponto fraco — um dardo seu, cravado onde for, pesa mais que o tiro perfeito de um atirador medíocre. Suas duas habilidades especiais carregam dano bônus igual a <b>${this.onHitMaxHPPercent}%</b> do HP Máximo do alvo escolhido, como <b>dano Perfurante</b>, e todo dardo que ele dispara — inclusive o da ultimate — deixa qualquer alvo ainda não <b>Envenenado</b> com <b>${this.poisonedStacks}</b> stack de <b>Veneno</b>, cortesia da mistura que ele mesmo prepara.`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, attacker, defender, damage, context }) {
    if (!(damage > 0)) return;
    if (!defender || defender.team === owner.team) return;
    if (defender.hasStatusEffect("poisoned")) return;

    defender.applyStatusEffect(
      "poisoned",
      undefined,
      context,
      { sourceId: owner.id, sourceName: owner.name },
      this.poisonedStacks,
    );

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> the venom on ${formatChampionName(attacker)}'s bolt leaves ${formatChampionName(defender)} <b>Poisoned</b>.`,
        pt: `<b>[Passivo — ${this.name}]</b> o veneno no dardo de ${formatChampionName(attacker)} deixa ${formatChampionName(defender)} <b>Envenenado</b>.`,
      },
    };
  },
};
