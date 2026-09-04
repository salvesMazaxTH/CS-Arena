import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { BLIND_MISS_CHANCE } from "../../statusEffects/blind.js";
import totalBlock from "../generic/totalBlock.js";

const seymourSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // H1 — Bleaching Ray
  // ========================
  {
    key: "bleaching_ray",
    name: "Bleaching Ray",

    bf: 55,
    healingReduction: 0.6,
    sunbleachedDuration: 2,

    contact: false,
    damageMode: "standard",
    hitVfx: "radiant_bolt",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Seymour narrows the star to a single white thread and lays it across the chosen target. Deals radiant magical damage and leaves them Sunbleached for ${this.sunbleachedDuration} turns — under that light almost nothing mends, and healing they receive is cut by ${this.healingReduction * 100}%.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hit = Array.isArray(result) ? result[0] : result;

      if (effectConnected(hit, "sunbleached")) {
        enemy.runtime.hookEffects = (enemy.runtime.hookEffects ?? []).filter(
          (e) => e.key !== "sunbleached",
        );

        enemy.addHookEffect(
          {
            type: "debuff",
            key: "sunbleached",
            expiresAtTurn: context.currentTurn + this.sunbleachedDuration,
            healingReduction: this.healingReduction,
            hookScope: { onBeforeHealing: "healTarget" },
            onBeforeHealing({ owner, amount }) {
              if (!(amount > 0)) return;
              const reduced = Math.max(
                0,
                Math.floor(amount * (1 - this.healingReduction)),
              );
              return {
                amount: reduced,
                log: `<b>[Sunbleached]</b> the light lets almost nothing mend on ${formatChampionName(owner)} (${amount} → ${reduced}).`,
              };
            },
          },
          context,
        );

        context.registerDialog?.({
          message: `${formatChampionName(user)} leaves ${formatChampionName(enemy)} <b>Sunbleached</b> — their wounds will barely close.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return result;
    },
  },

  // ========================
  // H2 — Corona Flare
  // ========================
  {
    key: "corona_flare",
    name: "Corona Flare",

    bf: 40,
    blindDuration: 1,

    contact: false,
    damageMode: "standard",
    hitVfx: "radiant_bolt",
    priority: 0,

    targetSpec: ["all:enemy"],

    description() {
      return `Seymour opens his hand and lets the star flare white across the whole enemy line. Deals radiant magical damage to every enemy and leaves them Blind for ${this.blindDuration} turn(s).`;
    },

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of targets) {
        if (!enemy?.alive || enemy.team === user.team) continue;

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const arr = Array.isArray(result) ? result : [result];
        results.push(...arr);

        if (effectConnected(arr[0], "blind")) {
          enemy.applyStatusEffect("blind", this.blindDuration, context, {
            sourceId: user.id,
            sourceName: user.name,
          });
        }
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Solar Meridian
  // ========================
  {
    key: "solar_meridian",
    name: "Solar Meridian",

    isUltimate: true,
    momentumCost: 55,

    bf: 110,
    setupBonus: 0.3,

    contact: false,
    damageMode: "standard",
    hitVfx: "radiant_beam",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Seymour brings the star to the top of its arc and drops the whole of noon onto the chosen target. Deals heavy radiant magical damage, increased by ${this.setupBonus * 100}% if the target is Sunbleached or Blind.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const primed =
        enemy.hasStatusEffect("blind") ||
        (enemy.runtime?.hookEffects ?? []).some((e) => e.key === "sunbleached");

      const baseDamage =
        ((user.Attack * this.bf) / 100) * (primed ? 1 + this.setupBonus : 1);

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default seymourSkills;
