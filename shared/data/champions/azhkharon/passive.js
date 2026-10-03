import { STAR_CHECKPOINT_TURNS } from "../../../engine/match/matchRules.js";
import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "vigil_of_the_wall",
  name: "Vigil of the Wall",
  attackBuff: 30,
  besiegingStatuses: ["poisoned", "chilled", "frozen"],

  description() {
    return {
      en: `Azh'Kharon's citadel fell at the change of the watch, the one hour its walls stood unmanned — dead or not, he has not left his post since. An enemy is <b>Besieged</b> while it carries <b>Poisoned</b>, <b>Chilled</b> or <b>Frozen</b> applied by one of his allies and has already taken damage from one of his allies this turn, shield-absorbed damage and poison ticks included. On the turns the watch changes (<b>${STAR_CHECKPOINT_TURNS.join(", ")}</b>), he gains <b>+${this.attackBuff}%</b> <b>Attack</b>, and either condition alone leaves an enemy <b>Besieged</b>.`,
      pt: `A cidadela de Azh'Kharon caiu na troca da guarda, a única hora em que suas muralhas ficaram sem vigia — morto ou não, ele nunca mais deixou o posto. Um inimigo está <b>Sitiado</b> enquanto carrega <b>Envenenado</b>, <b>Gelado</b> ou <b>Congelado</b> aplicado por um aliado dele e já sofreu dano de um aliado dele neste turno, contando dano absorvido por escudo e ticks de veneno. Nos turnos de troca da guarda (<b>${STAR_CHECKPOINT_TURNS.join(", ")}</b>), ele ganha <b>+${this.attackBuff}%</b> de <b>Ataque</b>, e basta uma das duas condições para deixar um inimigo <b>Sitiado</b>.`,
    };
  },

  isVigilTurn(context) {
    return STAR_CHECKPOINT_TURNS.includes(context?.currentTurn);
  },

  // A status or a hit counts only when it came from one of Kharon's allies,
  // never from Kharon himself: the siege is laid by his team, he closes it.
  isBesieged(owner, target, context) {
    const byAlly = (sourceId, sourceTeam) =>
      sourceTeam === owner.team && sourceId != null && sourceId !== owner.id;

    const hasAllyStatus = this.besiegingStatuses.some((key) => {
      const instance = target.statusEffects?.get(key);
      if (!instance) return false;
      // A stacked status counts if any ally still holds stacks in it.
      if (instance.stackBatches?.length) {
        return instance.stackBatches.some((b) => byAlly(b.sourceId, b.sourceTeam));
      }
      return byAlly(instance.sourceId, instance.sourceTeam);
    });

    const tookAllyDamage = (context?.getDamageTakenThisTurn?.(target.id) ?? []).some(
      (entry) =>
        (entry.amount > 0 || entry.absorbed > 0) &&
        byAlly(entry.sourceId, entry.sourceTeam),
    );

    if (this.isVigilTurn(context)) return hasAllyStatus || tookAllyDamage;
    return hasAllyStatus && tookAllyDamage;
  },

  // His own Chilled would swallow an ally's and leave the siege unlaid, so
  // he lets go of it and the ally's lands in its place.
  onStatusEffectIncoming({ owner, target, statusEffect, metadata, context }) {
    if (!owner.alive || statusEffect?.key !== "chilled") return;
    if (target.team === owner.team) return;

    const applierId = metadata?.sourceId ?? context?.actionSource?.id ?? null;
    const applierTeam = context?.actionSource?.team ?? null;
    if (applierId == null || applierId === owner.id) return;
    if (applierTeam !== owner.team) return;

    if (target.statusEffects?.get("chilled")?.sourceId !== owner.id) return;
    target.removeStatusEffect("chilled");
  },

  onTurnStart({ owner, context }) {
    if (!owner.alive) return;
    if (!this.isVigilTurn(context)) return;

    owner.modifyStat({
      statName: "Attack",
      amount: this.attackBuff,
      duration: 1,
      context,
      isPercent: true,
      statModifierSrc: owner,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} keeps the vigil and gains +${this.attackBuff}% Attack this turn.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} mantém a vigília e ganha +${this.attackBuff}% de Ataque neste turno.`,
      },
    };
  },
};
