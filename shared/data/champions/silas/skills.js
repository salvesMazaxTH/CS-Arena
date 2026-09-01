import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const MIRAGE_SOURCE = "second_silhouette";

// Runtime keys that only one of the two Silases can ever carry, so the payload
// would name the real one outright.
const TELLTALE_RUNTIME_KEYS = [
  "silasLastDamagedTurn",
  "silasLastActedTurn",
  "silasMirageOwnerId",
  "silasMirageSpawnTurn",
  "leavesNoDeath",
  "unmakingPalette",
  "hookEffectData",
];

function dissolveMirage(mirage, context) {
  mirage.HP = 0;
  mirage.alive = false;

  const silas = context.allChampions?.get(mirage.runtime.silasMirageOwnerId);
  if (silas) {
    delete silas.runtime.disguise;
    silas.damageReductionModifiers = silas.damageReductionModifiers.filter(
      (modifier) => modifier.source !== MIRAGE_SOURCE,
    );
  }

  context.registerDialog?.({
    message: `The second Silas thins out, and there was never anybody standing there.`,
    sourceId: mirage.id,
    targetId: mirage.id,
  });
}

const silasSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // H1 — Where No Guard Stands
  // ========================
  {
    key: "where_no_guard_stands",
    name: "Where No Guard Stands",

    bf: 60,
    unguardedBf: 100,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Silas does not hurry the work, because hurrying it has never once been necessary: he waits out the half-second in which nothing at all stands over the chosen target, and closes it. Deals physical damage equal to ${this.bf}% of his Attack, rising to ${this.unguardedBf}% against a target carrying no positive status effect and no shield.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const hasShield = (enemy.runtime?.shields ?? []).some(
        (shield) => (Number(shield?.amount) || 0) > 0,
      );
      const hasPositiveEffect = [...enemy.statusEffects.values()].some(
        (effect) => effect?.type === "buff",
      );
      const unguarded = !hasShield && !hasPositiveEffect;

      const bf = unguarded ? this.unguardedBf : this.bf;
      const baseDamage = (user.Attack * bf) / 100;

      if (unguarded) {
        context.registerDialog?.({
          message: `Nothing stands over ${formatChampionName(enemy)}, and ${formatChampionName(user)} steps into the gap.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },

  // ========================
  // H2 — Shatterglass Toll
  // ========================
  {
    key: "shatterglass_toll",
    name: "Shatterglass Toll",

    bf: 55,
    shieldedToll: 3,
    barefacedToll: 1,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Silas has never once believed a barrier was anything but glass somebody paid too much for, and he collects on that opinion. Every shield on the chosen target shatters before the blade arrives; the strike then deals physical damage and takes the cost out of their player's score — ${this.shieldedToll} points if there was glass to break, ${this.barefacedToll} if there was not, and never more than that player actually has.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const shields = enemy.runtime?.shields ?? [];
      const brokenShields = shields.filter(
        (shield) => (Number(shield?.amount) || 0) > 0,
      ).length;

      if (brokenShields > 0) {
        enemy.runtime.shields = [];

        context.registerDialog?.({
          message: `${formatChampionName(user)} shatters every shield on ${formatChampionName(enemy)} before the blade even moves.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainHit = results.find((entry) => entry?.targetId === enemy.id);

      if (mainHit?.landed) {
        const toll = brokenShields > 0 ? this.shieldedToll : this.barefacedToll;
        const victimSlot = enemy.team - 1;
        const taken = Math.min(toll, context.getScore(victimSlot));

        if (taken > 0) {
          context.registerScore({
            amount: taken,
            scoringSlot: user.team - 1,
            reason: this.key,
            sourceId: user.id,
          });

          context.registerScore({
            amount: -taken,
            scoringSlot: victimSlot,
            reason: this.key,
            sourceId: user.id,
          });
        }

        context.registerDialog?.({
          message: taken
            ? `${formatChampionName(user)} collects the toll — ${taken} point(s) taken from the other side of the board.`
            : `${formatChampionName(user)} comes to collect and finds the other side of the board with nothing to give.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Second Silhouette
  // ========================
  {
    key: "second_silhouette",
    name: "Second Silhouette",

    isUltimate: true,
    momentumCost: 60,

    bf: 100,
    damageReduction: 40,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Silas steps once to the side, opens the chosen target on the way past, and something steps out of the motion wearing his face and keeping his silence. Deals physical damage equal to ${this.bf}% of his Attack. At the start of the next turn a second Silas takes the field, and the enemy player is given no way at all to tell which of the two is the man; while the double stands, Silas takes ${this.damageReduction}% less damage. It never acts, comes apart the moment anything reaches it, and is gone by the end of the next turn Silas acts.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const damageReduction = this.damageReduction;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      context.schedule({
        type: "spawnChampion",
        turnToHappen: context.currentTurn + 1,

        payload: {
          championKey: user.championKey,
          team: user.team,
          asEntityType: "minion",

          onSpawn: (mirage, spawnContext) => {
            if (!user.alive) {
              mirage.HP = 0;
              mirage.alive = false;
              return;
            }

            mirage.runtime.leavesNoDeath = true;
            mirage.runtime.unmakingPalette = "hollow";
            mirage.runtime.silasMirageOwnerId = user.id;
            mirage.runtime.silasMirageSpawnTurn = spawnContext.currentTurn;

            mirage.maxHP = user.maxHP;
            mirage.HP = user.HP;
            mirage.Speed = user.Speed;
            mirage.runtime.shields = (user.runtime.shields ?? []).map(
              (shield) => ({ ...shield }),
            );

            mirage.applyStatusEffect("inert", 99, spawnContext, {
              hiddenIndicator: true,
            });

            for (const effect of user.statusEffects.values()) {
              const remaining = effect.expiresAtTurn - spawnContext.currentTurn;
              if (remaining <= 0) continue;

              mirage.applyStatusEffect(effect.key, remaining, spawnContext, {
                stackCount: effect.stacks ?? 1,
              });
            }

            // Mirrored onto the double as well: a reduction arrow on one
            // portrait and not the other would name the real Silas.
            for (const holder of [user, mirage]) {
              holder.applyDamageReduction({
                amount: damageReduction,
                duration: 2,
                type: "percent",
                source: MIRAGE_SOURCE,
                context: spawnContext,
              });
            }

            // The two are dealt the same pair of adjacent slots in random
            // order, so arrival position never gives the man away.
            const slots = [mirage.combatSlot, mirage.combatSlot + 1];
            if (Math.random() < 0.5) slots.reverse();

            user.runtime.disguise = {
              fields: { entityType: "minion", combatSlot: slots[0] },
              hideRuntimeKeys: TELLTALE_RUNTIME_KEYS,
            };

            mirage.runtime.disguise = {
              fields: { combatSlot: slots[1] },
              mirrorFrom: user.id,
              mirrorFields: ["momentum", "matchStats"],
              hideRuntimeKeys: TELLTALE_RUNTIME_KEYS,
            };

            mirage.addHookEffect(
              {
                type: "neutral",
                key: "silas_mirage",
                group: "skill",
                ownerId: mirage.id,

                hookScope: { onAfterDmgTaking: "defender" },
                hookPolicies: {
                  onAfterDmgTaking: {
                    allowOnDot: true,
                    allowOnNestedDamage: true,
                  },
                },

                onAfterDmgTaking({ owner, defender, actualDmg, context }) {
                  if (defender !== owner || !(actualDmg > 0)) return;
                  dissolveMirage(owner, context);
                },

                // Turn start, not turn end: the end-of-turn context carries no
                // champion index and no dialog channel.
                onTurnStart({ owner, context }) {
                  const silas = context.allChampions?.get(
                    owner.runtime.silasMirageOwnerId,
                  );

                  if (
                    silas?.alive &&
                    (silas.runtime.silasLastActedTurn ?? 0) <
                      owner.runtime.silasMirageSpawnTurn
                  ) {
                    return;
                  }

                  dissolveMirage(owner, context);
                },

                onChampionDeath({ owner, deadChampion, context }) {
                  if (deadChampion?.id !== owner.runtime.silasMirageOwnerId) {
                    return;
                  }

                  dissolveMirage(owner, context);
                },
              },
              spawnContext,
            );
          },
        },
      });

      return Array.isArray(result) ? result : [result];
    },
  },
];

export default silasSkills;
