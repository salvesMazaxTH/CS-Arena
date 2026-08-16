import { formatChampionName } from "../../../ui/formatters.js";

function restoreRevivedState(champion, reviveFrom) {
  if (!reviveFrom) return;

  champion.runtime = { ...reviveFrom.runtime };
  delete champion.runtime.currentContext;

  champion.maxHP = reviveFrom.maxHP;
  champion.Attack = reviveFrom.Attack;
  champion.Defense = reviveFrom.Defense;
  champion.Speed = reviveFrom.Speed;
  champion.Evasion = reviveFrom.Evasion;
  champion.Critical = reviveFrom.Critical;
  champion.LifeSteal = reviveFrom.LifeSteal;
  champion.momentum = reviveFrom.momentum;

  champion.statModifiers = Array.isArray(reviveFrom.statModifiers)
    ? reviveFrom.statModifiers.map((modifier) => ({ ...modifier }))
    : [];

  champion.damageModifiers = Array.isArray(reviveFrom.damageModifiers)
    ? reviveFrom.damageModifiers.map((modifier) => ({ ...modifier }))
    : [];

  champion.damageReductionModifiers = Array.isArray(
    reviveFrom.damageReductionModifiers,
  )
    ? reviveFrom.damageReductionModifiers.map((modifier) => ({ ...modifier }))
    : [];

  champion.tauntEffects = Array.isArray(reviveFrom.tauntEffects)
    ? reviveFrom.tauntEffects.map((effect) => ({ ...effect }))
    : [];

  if (reviveFrom.statusEffects instanceof Map) {
    champion.statusEffects = new Map();

    for (const [key, value] of reviveFrom.statusEffects.entries()) {
      champion.statusEffects.set(
        key,
        Object.assign(Object.create(Object.getPrototypeOf(value)), value),
      );
    }
  }
}

export default {
  key: "the_jeff_does_not_end",
  name: "The Jeff Does Not End",

  description(champion) {
    return `When Jeff is defeated, he returns to the battlefield at the start of the next turn with 75% of his Max HP, retaining his accumulated buffs and stacks. Whenever a character dies, Jeff gains +30% permanent Attack and +30% permanent Defense.

    <b>Jeff's Death Count:</b> ${champion.runtime.deathCounter ?? 0}`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (defender !== owner) return;
    if (defender.HP > 0) return;

    console.log(
      "[Passive - Jeff] Death Does Not End activated for",
      defender.id,
    );

    console.log(
      `[Passive - Jeff] Scheduling revival for next turn (Turn ${
        context.currentTurn + 1
      })`,
    );

    defender.runtime.deathCounter ??= 0;
    defender.runtime.deathCounter++;

    context.schedule({
      type: "spawnChampion",
      turnToHappen: context.currentTurn + 1,

      payload: {
        championKey: defender.championKey,
        team: defender.team,
        combatSlot: defender.combatSlot, // Ensures the same slot.
        reviveFrom: defender, // Passes the previous Jeff's state.
        onSpawn: (champion, context, reviveFrom) => {
          restoreRevivedState(champion, reviveFrom);

          champion.HP = Math.floor(champion.maxHP * 0.75);

          // Buff from Jeff's own death, since onChampionDeath is skipped.
          const buffsPerDeath = [
            { stat: "Attack", amount: 30, isPercent: true },
            { stat: "Defense", amount: 30, isPercent: true },
          ];

          buffsPerDeath.forEach((buff) => {
            champion.modifyStat({
              statName: buff.stat,
              amount: buff.amount,
              context,
              isPermanent: true,
              isPercent: buff.isPercent,
            });
          });
        },
      },

      dialog: {
        message: `[Passive - <b>${this.name}</b>] ${formatChampionName(
          defender,
        )} returns to the battlefield!`,
        sourceId: null,
        targetId: null,
      },
    });
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (owner === deadChampion) return; // Own death is handled in onSpawn.
    if (!owner.alive) return;

    // Whenever any character dies, Jeff gains the buffs.
    console.log(
      `[Passive - Jeff] Buffing Jeff for the death of ${
        deadChampion?.name ?? "someone"
      }.`,
    );

    const buffsPerDeath = [
      { stat: "Attack", amount: 30, isPercent: true },
      { stat: "Defense", amount: 30, isPercent: true },
    ];

    buffsPerDeath.forEach((buff) => {
      owner.modifyStat({
        statName: buff.stat,
        amount: buff.amount,
        context,
        isPermanent: true,
        isPercent: buff.isPercent,
      });
    });
  },
};