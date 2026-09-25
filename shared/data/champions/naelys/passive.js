import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "heart_of_the_tides",
  name: "Heart of the Tides",

  healPerHit: 10,
  dmgPerStack: 10,
  maxStacks: 4,

  description(champion) {
    const stacks = champion?.runtime?.mareStacks || 0;

    return {
      en: `Whenever she deals damage, she restores <b>${this.healPerHit}</b> HP. Each time she restores HP this way, she gains 1 <b>Tides</b> stack.

      Each stack grants <b>+${this.dmgPerStack}</b> flat damage. Max <b>${this.maxStacks}</b> stacks. Stacks are permanent.

      <b>Current stacks: ${stacks}/${this.maxStacks}</b>
      <b>Maximum total bonus: +${this.dmgPerStack * this.maxStacks}</b> damage.`,
      pt: `Sempre que causa dano, restaura <b>${this.healPerHit}</b> HP. A cada vez que restaura HP assim, ganha 1 acúmulo de <b>Marés</b>.

      Cada acúmulo concede <b>+${this.dmgPerStack}</b> de dano fixo. Máximo de <b>${this.maxStacks}</b> acúmulos. Os acúmulos são permanentes.

      <b>Acúmulos atuais: ${stacks}/${this.maxStacks}</b>
      <b>Bônus total máximo: +${this.dmgPerStack * this.maxStacks}</b> de dano.`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, actualDmg, context }) {
    if (!(actualDmg > 0)) return;

    owner.runtime = owner.runtime || {};
    owner.runtime.mareStacks = owner.runtime.mareStacks || 0;

    const restored = new HealEvent({
      target: owner,
      amount: this.healPerHit,
      context,
      source: owner,
    }).execute();

    if (restored <= 0) return;

    if (owner.runtime.mareStacks >= this.maxStacks) {
      return {
        log: {
          en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
            owner,
          )} restored <b>${restored}</b> HP.`,
          pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(
            owner,
          )} restaurou <b>${restored}</b> de HP.`,
        },
      };
    }

    owner.runtime.mareStacks++;

    // Register the flat-damage modifier once; it reads the live stack count.
    const alreadyHas = owner
      .getDamageModifiers()
      .some((m) => m.id === "tides-stacks");

    if (!alreadyHas) {
      owner.addDamageModifier({
        id: "tides-stacks",
        name: "Tides",
        permanent: true,
        apply: ({ baseDamage, attacker }) => {
          const stacks = Math.min(
            attacker.runtime?.mareStacks || 0,
            this.maxStacks,
          );
          return baseDamage + stacks * this.dmgPerStack;
        },
      });
    }

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
          owner,
        )} restored <b>${restored}</b> HP and gained 1 <b>Tides</b> stack (<b>${owner.runtime.mareStacks}/${this.maxStacks}</b>).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(
          owner,
        )} restaurou <b>${restored}</b> de HP e ganhou 1 acúmulo de <b>Marés</b> (<b>${owner.runtime.mareStacks}/${this.maxStacks}</b>).`,
      },
    };
  },
};
