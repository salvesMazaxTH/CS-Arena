import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "kindled_fists",
  name: "Kindled Fists",
  flamingFistsDamage: 30,
  livingEmberBonusDamage: 40,
  burnDuration: 1,
  livingEmberBurnDuration: 2,

  description() {
    return {
      en: `Kai's knuckles never fully cool. Whenever he deals damage with a <b>Basic Strike</b>, the heat lands with it as <b>${this.flamingFistsDamage}</b> bonus damage, and the target catches fire unless their element already knows the burn.

      Under <b>Living Ember</b>, nothing is spared: all of his attacks deal <b>${this.livingEmberBonusDamage}</b> bonus damage and always apply <b>Burning</b>, whatever the target's elemental affinity.`,
      pt: `Os punhos de Kai nunca esfriam de verdade. Sempre que causa dano com um <b>Ataque Básico</b>, o calor vem junto como <b>${this.flamingFistsDamage}</b> de dano bônus, e o alvo pega fogo a menos que seu elemento já conheça a queimadura.

      Sob a <b>Brasa Viva</b>, nada é poupado: todos os seus ataques causam <b>${this.livingEmberBonusDamage}</b> de dano bônus e sempre aplicam <b>Queimando</b>, seja qual for a afinidade elemental do alvo.`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, skill }) {
    if (attacker !== owner) return;

    const isLivingEmber = owner.runtime?.fireStance === "livingEmber";

    if (!isLivingEmber && skill?.key !== "basic_strike") return;

    return {
      bonusDamage: isLivingEmber
        ? this.livingEmberBonusDamage
        : this.flamingFistsDamage,
    };
  },

  onAfterDmgDealing({ attacker, defender, owner, damage, context, skill }) {
    if (attacker !== owner) return;
    if (damage <= 0) return;
    if (!defender) return;

    const isLivingEmber = owner.runtime?.fireStance === "livingEmber";

    // Main gate: only Basic Strikes burn, unless Living Ember is up.
    if (!isLivingEmber && skill?.key !== "basic_strike") return;

    const affinities = defender.elementalAffinities ?? [];

    // Earth, Water and Fire affinities shrug off the ordinary heat.
    if (
      !isLivingEmber &&
      affinities.some((a) => ["earth", "water", "fire"].includes(a))
    ) {
      return;
    }

    const burnDuration = isLivingEmber
      ? this.livingEmberBurnDuration
      : this.burnDuration;

    defender.applyStatusEffect("burning", burnDuration, context, {
      sourceId: owner.id,
    });

    return {
      log: {
        en: `${formatChampionName(attacker)} sets ${formatChampionName(defender)} Burning.`,
        pt: `${formatChampionName(attacker)} deixa ${formatChampionName(defender)} Queimando.`,
      },
    };
  },
};
