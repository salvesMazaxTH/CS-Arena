import { formatChampionName } from "../../../ui/formatters.js";

const BUFFS_PER_DEATH = [
  { stat: "Attack", amount: 30, isPercent: true },
  { stat: "Defense", amount: 30, isPercent: true },
];

const REVIVE_HP_PERCENT = 75;

// Called from both death hooks; revivalScheduledForTurn makes the second
// call a no-op.
function scheduleRevival(champion, context, passiveName) {
  if (!champion || typeof context?.schedule !== "function") {
    console.warn(
      "[Passive - Jeff] Revival could not be scheduled: no schedulable context.",
    );
    return false;
  }

  const turnToHappen = (context.currentTurn ?? 0) + 1;

  champion.runtime ??= {};
  if (champion.runtime.revivalScheduledForTurn === turnToHappen) return false;
  champion.runtime.revivalScheduledForTurn = turnToHappen;

  champion.runtime.deathCounter ??= 0;
  champion.runtime.deathCounter++;

  context.schedule({
    type: "spawnChampion",
    turnToHappen,

    payload: {
      championKey: champion.championKey,
      team: champion.team,
      combatSlot: champion.combatSlot, // Ensures the same slot.
      reviveFrom: champion, // Passes the previous Jeff's state.
      onSpawn: (revived, spawnContext, reviveFrom) => {
        restoreRevivedState(revived, reviveFrom);

        revived.HP = Math.floor(revived.maxHP * (REVIVE_HP_PERCENT / 100));

        // Buff from Jeff's own death, since onChampionDeath skips the owner.
        BUFFS_PER_DEATH.forEach((buff) => {
          revived.modifyStat({
            statName: buff.stat,
            amount: buff.amount,
            context: spawnContext,
            isPermanent: true,
            isPercent: buff.isPercent,
          });
        });
      },
    },

    dialog: {
      message: `<b>[Passive — ${passiveName}]</b> you cannot kill Death itself — ${formatChampionName(
        champion,
      )} steps back onto the field.`,
      sourceId: null,
      targetId: null,
    },
  });

  return true;
}

function restoreRevivedState(champion, reviveFrom) {
  if (!reviveFrom) return;

  champion.runtime = { ...reviveFrom.runtime };
  delete champion.runtime.currentContext;
  // The revived instance is alive again — it must be free to schedule its own
  // next death, otherwise the flag copied over here would block it.
  delete champion.runtime.revivalScheduledForTurn;

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
    return `Death does not attend its own funeral. Cut down, Jeff returns at the start of the next turn with ${REVIVE_HP_PERCENT}% of his Max HP and every buff and stack still on him. Every death the field sees — his own among them — settles into him as +${BUFFS_PER_DEATH[0].amount}% permanent Attack and +${BUFFS_PER_DEATH[1].amount}% permanent Defense.

    <b>Jeff's Death Count:</b> ${champion.runtime.deathCounter ?? 0}`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  // Death is death, no matter the source: reactive hooks are suppressed on DoT
  // and nested damage by default, which silently skipped the revival whenever
  // Jeff was finished off by poison/burn/bleed or by reflect/recoil damage.
  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
    },
  },

  onAfterDmgTaking({ defender, owner, context }) {
    if (defender !== owner) return;
    if (defender.HP > 0) return;

    scheduleRevival(defender, context, this.name);
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (owner === deadChampion) {
      // Fallback for deaths that never ran onAfterDmgTaking — executions that
      // set HP/alive directly, for instance. A no-op when the damage hook has
      // already scheduled this same revival.
      scheduleRevival(owner, context, this.name);
      return;
    }

    if (!owner.alive) return;

    // Whenever any character dies, Jeff gains the buffs.
    BUFFS_PER_DEATH.forEach((buff) => {
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