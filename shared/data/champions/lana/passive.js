import { formatChampionName } from "../../../ui/formatters.js";

function clearLanaSpellShield(owner) {
  if (!Array.isArray(owner.runtime?.shields)) return;

  owner.runtime.shields = owner.runtime.shields.filter(
    (shield) => shield?.type !== "spell",
  );
}

export default {
  key: "imaginary_friend",
  name: "Imaginary Friend",

  hpThreshold: 0.35, // 35% of Max HP

  description() {
    return `Tutu is always watching over Lana. While he is alive, she receives a Spell Shield at the start of every turn.

    When Lana drops below ${this.hpThreshold * 100}% of her Max HP, Tutu takes her place on the field. When Tutu falls, Lana returns to the battle with the HP she left it with. This can only happen once per battle.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ owner, context }) {
    owner.runtime.lana ??= {
      triggered: false,
    };

    if (owner.runtime.lana.triggered) {
      return;
    }

    const ratio = owner.HP / owner.maxHP;
    if (ratio > this.hpThreshold) {
      return;
    }

    owner.runtime.lana.triggered = true;

    if (!context)
      throw new Error(
        `ERROR: context is undefined while registering the replace request for ${owner.name}`,
      );

    // Register the swap intent (Lana → Tutu).
    // Lana's full state is preserved in inactiveChampions.
    context.requestChampionMutation?.({
      targetId: owner.id,
      newChampionKey: "lana_dino",
      mode: "swap",
    });

    return {
      log: `${owner.name} lets her Plush Dinosaur loose!`,
    };
  },

  onTurnStart({ owner, context }) {
    owner.runtime.lana ??= {
      triggered: false,
    };

    if (owner.runtime.lana.triggered) return;

    clearLanaSpellShield(owner);

    owner.addShield(1, 0, context, "spell");

    return {
      log: `${formatChampionName(owner)} receives a Spell Shield.`,
    };
  },
};
