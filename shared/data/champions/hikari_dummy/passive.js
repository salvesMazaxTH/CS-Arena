import { applyTaunt } from "../../../core/championCombat.js";
import { formatChampionName } from "../../../ui/formatters.js";

function takeOffField(owner, context) {
  if (!owner.alive) return;

  owner.HP = 0;
  owner.alive = false;

  context.registerDialog?.({
    message: `${formatChampionName(owner)} is left behind, a splintered log in empty clothes.`,
    sourceId: owner.id,
    targetId: owner.id,
  });
}

export default {
  key: "empty_clothes",
  name: "Empty Clothes",

  inertDurationTurns: 99,
  tauntDurationTurns: 1,

  description() {
    return {
      en: `The <b>Decoy</b> is born <b>Inert</b> and draws every attack that was aimed at <b>Hikari</b> this turn. It is taken off the field at the start of the next turn, or as soon as <b>Hikari</b> falls.`,
      pt: `O <b>Boneco</b> nasce <b>Inerte</b> e atrai todo ataque que mirava em <b>Hikari</b> neste turno. Ele sai de campo no início do turno seguinte, ou assim que <b>Hikari</b> cair.`,
    };
  },

  onChampionAdded({ owner, champion, context }) {
    if (champion !== owner) return;

    owner.applyStatusEffect("inert", this.inertDurationTurns, context);

    for (const aimerId of owner.runtime.substitutionAimerIds ?? []) {
      const aimer = context.allChampions?.get(aimerId);
      if (!aimer?.alive) continue;

      applyTaunt(aimer, owner.id, this.tauntDurationTurns, context);
    }
  },

  onTurnStart({ owner, context }) {
    takeOffField(owner, context);
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion?.id !== owner.runtime.summonerId) return;

    takeOffField(owner, context);
  },
};
