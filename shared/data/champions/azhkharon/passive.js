import { STAR_CHECKPOINT_TURNS } from "../../../engine/match/matchRules.js";
import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "vigil_of_the_wall",
  name: "Vigil of the Wall",
  attackBuff: 30,
  besiegingStatuses: ["poisoned", "chilled", "frozen"],

  description() {
    return {
      en: `Azh'Kharon's citadel fell at the change of the watch, in the one hour its walls stood unmanned. Dead and bound to the pact, he swore no change of the watch would ever find him off his post again — and on the turns the watch turns (<b>${STAR_CHECKPOINT_TURNS.join(", ")}</b>), that night comes back to him. On those turns he gains <b>+${this.attackBuff}%</b> <b>Attack</b>, and an enemy counts as <b>Besieged</b> with only one of its two conditions met. An enemy is <b>Besieged</b> while it carries <b>Poisoned</b>, <b>Chilled</b> or <b>Frozen</b> applied by another ally, and has already taken damage from another ally this turn, shield-absorbed damage and poison ticks included.`,
      pt: `A cidadela de Azh'Kharon caiu na troca da guarda, na única hora em que suas muralhas ficaram sem ninguém. Morto e preso ao pacto, ele jurou que nenhuma troca da guarda voltaria a encontrá-lo fora do posto — e nos turnos em que a guarda troca (<b>${STAR_CHECKPOINT_TURNS.join(", ")}</b>), aquela noite volta para ele. Nesses turnos ele ganha <b>+${this.attackBuff}%</b> de <b>Ataque</b>, e basta uma das duas condições para um inimigo contar como <b>Sitiado</b>. Um inimigo está <b>Sitiado</b> enquanto carrega <b>Envenenado</b>, <b>Gelado</b> ou <b>Congelado</b> aplicado por outro aliado e já sofreu dano de outro aliado neste turno, contando dano absorvido por escudo e ticks de veneno.`,
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
      return instance && byAlly(instance.sourceId, instance.sourceTeam);
    });

    const tookAllyDamage = (context?.getDamageTakenThisTurn?.(target.id) ?? []).some(
      (entry) =>
        (entry.amount > 0 || entry.absorbed > 0) &&
        byAlly(entry.sourceId, entry.sourceTeam),
    );

    if (this.isVigilTurn(context)) return hasAllyStatus || tookAllyDamage;
    return hasAllyStatus && tookAllyDamage;
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

    context.registerDialog({
      message: `<b>[PASSIVE — ${this.name}]</b> The watch turns, and ${formatChampionName(owner)} is at his post.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} keeps the vigil and gains +${this.attackBuff}% Attack this turn.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} mantém a vigília e ganha +${this.attackBuff}% de Ataque neste turno.`,
      },
    };
  },
};
