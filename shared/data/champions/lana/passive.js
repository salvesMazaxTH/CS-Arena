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

    return {
      en: `Tutu is always watching over Lana. While he is alive, she receives a <b>Spell Shield</b> at the start of every turn.

      When Lana drops below <b>${this.hpThreshold * 100}%</b> of her <b>Max HP</b>, Tutu takes her place on the field. When a blow would have killed her, he throws himself in front of it and enters already carrying it: his plush body soaks <b>${light.percent}%</b> of a blow up to <b>${light.upTo}</b>, <b>${medium.percent}%</b> of one up to <b>${medium.upTo}</b>, and <b>${heavy.percent}%</b> of anything heavier — and however heavy it was, he holds on with at least <b>1 HP</b>.

      When Tutu falls, Lana returns to the battle with the <b>HP</b> she left it with. This can only happen once per battle.`,
      pt: `Tutu sempre vela por Lana. Enquanto está vivo, ela recebe um <b>Escudo Mágico</b> no início de cada turno.

      Quando Lana cai abaixo de <b>${this.hpThreshold * 100}%</b> de seu <b>HP Máximo</b>, Tutu toma o lugar dela em campo. Quando um golpe seria fatal, ele se joga na frente dele e já entra absorvendo o impacto: seu corpo de pelúcia absorve <b>${light.percent}%</b> de um golpe de até <b>${light.upTo}</b>, <b>${medium.percent}%</b> de um de até <b>${medium.upTo}</b>, e <b>${heavy.percent}%</b> de qualquer coisa mais pesada — e por mais pesado que tenha sido, ele resiste com pelo menos <b>1 HP</b>.

      Quando Tutu cai, Lana retorna à batalha com o <b>HP</b> que tinha ao sair. Isso só pode acontecer uma vez por batalha.`,
    };
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  // Reaches Tutu even on an absolute blow; a DoT tick is filtered inside the hook.
  hookPolicies: {
    onBeforeDmgTaking: {
      allowOnAbsolute: true,
    },
  },

  onBeforeDmgTaking({ owner, damage, context }) {
    owner.runtime.lana ??= {
      triggered: false,
    };

    if (owner.runtime.lana.triggered) return;
    // Tutu blocks a blow, not a poison or burn tick.
    if (context.isDot) return;
    if (!owner.wouldBeLethal(damage)) return;

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
      message: {
        en: `${formatChampionName(owner)}'s Plush Dinosaur throws himself in front of the blow!`,
        pt: `O Dinossauro de Pelúcia de ${formatChampionName(owner)} se joga na frente do golpe!`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damage: 0,
      log: {
        en: `Tutu takes the blow meant for ${formatChampionName(owner)}!`,
        pt: `Tutu recebe o golpe destinado a ${formatChampionName(owner)}!`,
      },
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
      log: {
        en: `${owner.name} lets her Plush Dinosaur loose!`,
        pt: `${owner.name} solta seu Dinossauro de Pelúcia!`,
      },
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
      log: {
        en: `${formatChampionName(owner)} receives a <b>Spell Shield</b>.`,
        pt: `${formatChampionName(owner)} recebe um <b>Escudo Mágico</b>.`,
      },
    };
  },
};
