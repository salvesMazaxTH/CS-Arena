// shared/data/champions/avarion/passive.js

import { formatChampionName } from "../../../ui/formatters.js";
import {
  AVARIK_NAME,
  EDICT_DAMAGE,
  EDICT_ATTACK_THRESHOLD,
  isEdictInForce,
  isHollow,
  isIndirectDamage,
} from "../pairs/edict.js";

export default {
  key: "edict_of_hollow_might",
  name: "Edict of Hollow Might",

  threshold: EDICT_ATTACK_THRESHOLD,
  edictDamage: EDICT_DAMAGE,

  description() {
    return {
      en: `Avarion lifts his crystal staff, reads the field like a ledger and decrees what a hand is worth: might too poor to reach <b>${this.threshold}</b> <b>Attack</b> is too poor to be charged for anything.\n\nEvery champion on the field below <b>${this.threshold}</b> current <b>Attack</b>, Avarion included, deals only <b>${this.edictDamage}</b> damage per instance. Damage over time, echoed damage and <b>Absolute Damage</b> land in full.\n\nThe Edict falls silent while his younger brother ${AVARIK_NAME} stands on the field, on either side.`,
      pt: `Avarion ergue seu cajado de cristal, lê o campo como um livro-razão e decreta o que uma mão vale: poder pobre demais para alcançar <b>${this.threshold}</b> de <b>Ataque</b> é pobre demais para ser cobrado por qualquer coisa.\n\nTodo campeão em campo abaixo de <b>${this.threshold}</b> de <b>Ataque</b> atual, Avarion incluso, causa apenas <b>${this.edictDamage}</b> de dano por instância. Dano ao longo do tempo, dano ecoado e <b>Dano Absoluto</b> acertam por inteiro.\n\nO Édito silencia enquanto seu irmão mais novo ${AVARIK_NAME} estiver em campo, de qualquer lado.`,
    };
  },

  // Deliberately unscoped: the Edict judges every hit on the field, not only
  // Avarion's own. onBeforeDmgTaking is the clamp point and is already skipped
  // for Absolute and DoT/nested damage — exactly what the Edict must not touch.
  onBeforeDmgTaking({ owner, attacker, damage, context }) {
    if (!(damage > this.edictDamage)) return;

    if (isIndirectDamage(context)) return;

    if (!isEdictInForce(owner, context, AVARIK_NAME)) return;

    if (!isHollow(attacker, "Attack", this.threshold)) return;

    return {
      // A ceiling, not a damage value: it must not scale with the hit.
      damageCap: this.edictDamage,
      log:
        `<b>[Passive — ${this.name}]</b> ` +
        `${formatChampionName(attacker)} wields less than ${this.threshold} Attack ` +
        `and is Hollow under Avarion's Edict, dealing only ${this.edictDamage} damage.`,
    };
  },
};
