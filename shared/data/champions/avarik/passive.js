// shared/data/champions/avarik/passive.js

import { formatChampionName } from "../../../ui/formatters.js";
import {
  AVARION_NAME,
  EDICT_DAMAGE,
  EDICT_HP_THRESHOLD,
  isEdictInForce,
  isHollow,
  isIndirectDamage,
} from "../pairs/edict.js";

export default {
  key: "edict_of_hollow_flesh",
  name: "Edict of Hollow Flesh",

  threshold: EDICT_HP_THRESHOLD,
  edictDamage: EDICT_DAMAGE,

  description() {
    return {
      en: `Avarik drives his stone-scaled fist into the ground and decrees what a body is worth: flesh too thin to hold <b>${this.threshold}</b> <b>HP</b> is too thin to wound anything.

    Every champion on the field whose current <b>HP</b> is below <b>${this.threshold}</b> deals only <b>${this.edictDamage}</b> damage per instance of damage, and Avarik answers to his own Edict the moment his <b>HP</b> falls that low.

    What never passes through the Edict's hands is untouched by it: damage over time, damage that echoes from another source, and <b>Absolute Damage</b> all land in full.

    The Edict falls silent while his elder brother ${AVARION_NAME} stands on the field, on either side.`,
      pt: `Avarik crava seu punho de escamas de pedra no chão e decreta o que um corpo vale: carne fina demais para segurar <b>${this.threshold}</b> de <b>HP</b> é fina demais para ferir qualquer coisa.

    Todo campeão em campo cujo <b>HP</b> atual estiver abaixo de <b>${this.threshold}</b> causa apenas <b>${this.edictDamage}</b> de dano por instância de dano, e Avarik responde ao próprio Édito no instante em que seu <b>HP</b> cai tão baixo.

    O que nunca passa pelas mãos do Édito permanece intocado por ele: dano ao longo do tempo, dano que ecoa de outra fonte, e <b>Dano Absoluto</b> acertam por inteiro.

    O Édito silencia enquanto seu irmão mais velho ${AVARION_NAME} estiver em campo, de qualquer lado.`,
    };
  },

  // Deliberately unscoped: the Edict judges every hit on the field, not only
  // Avarik's own. onBeforeDmgTaking is the clamp point and is already skipped
  // for Absolute and DoT/nested damage — exactly what the Edict must not touch.
  onBeforeDmgTaking({ owner, attacker, damage, context }) {
    if (!(damage > this.edictDamage)) return;

    if (isIndirectDamage(context)) return;

    if (!isEdictInForce(owner, context, AVARION_NAME)) return;

    if (!isHollow(attacker, "HP", this.threshold)) return;

    return {
      // A ceiling, not a damage value: it must not scale with the hit.
      damageCap: this.edictDamage,
      log:
        `<b>[Passive — ${this.name}]</b> ` +
        `${formatChampionName(attacker)} holds less than ${this.threshold} HP ` +
        `and is Hollow under Avarik's Edict, dealing only ${this.edictDamage} damage.`,
    };
  },
};
