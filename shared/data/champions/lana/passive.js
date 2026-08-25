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

  // Heavier blows get through more of the plush: the tier is picked by the
  // damage that would have landed on Lana.
  absorptionTiers: [
    { upTo: 120, percent: 90 },
    { upTo: 200, percent: 75 },
    { upTo: Infinity, percent: 55 },
  ],

  description() {
    const [light, medium, heavy] = this.absorptionTiers;

    return `Tutu is always watching over Lana. While he is alive, she receives a Spell Shield at the start of every turn.

    When Lana drops below ${this.hpThreshold * 100}% of her Max HP, Tutu takes her place on the field. When a blow would have killed her, he throws himself in front of it and enters already carrying it: his plush body soaks ${light.percent}% of a blow up to ${light.upTo}, ${medium.percent}% of one up to ${medium.upTo}, and ${heavy.percent}% of anything heavier — and however heavy it was, he holds on with at least 1 HP.

    When Tutu falls, Lana returns to the battle with the HP she left it with. This can only happen once per battle.`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  onBeforeDmgTaking({ owner, damage, context }) {
    owner.runtime.lana ??= {
      triggered: false,
    };

    if (owner.runtime.lana.triggered) return;
    if (owner.HP - damage > 0) return;

    owner.runtime.lana.triggered = true;

    const tier = this.absorptionTiers.find((t) => damage <= t.upTo);
    const carried = damage * (1 - tier.percent / 100);

    context.requestChampionMutation({
      targetId: owner.id,
      newChampionKey: "lana_dino",
      mode: "swap",
      entryDamage: carried,
    });

    context.registerDialog({
      message: `${formatChampionName(owner)}'s Plush Dinosaur throws himself in front of the blow!`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damage: 0,
      log: `Tutu takes the blow meant for ${formatChampionName(owner)}!`,
    };
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
