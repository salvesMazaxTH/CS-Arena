import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const eryonSkills = [
  // =========================
  // Basic Shot (global)
  // =========================

  { ...basicShot, type: "magical" },

  // =========================
  // Special Abilities
  // =========================

  {
    key: "convergent_equalization",
    name: "Convergent Equalization",

    priority: -1,

    description() {
      return `Sets the Momentum of all allies to their current average +6.`;
    },

    targetSpec: ["self"],

    resolve({ user, context, resolver }) {
      const allies = context.aliveChampions.filter(
        (c) => c.team === user.team,
      );

      if (!allies.length) return;

      const total = allies.reduce(
        (sum, c) => sum + c.momentum,
        0,
      );

      const avg = Math.floor(total / allies.length);

      for (const ally of allies) {
        const targetValue = Math.min(
          ally.momentumMax,
          avg + 6,
        );

        const delta = targetValue - ally.momentum;

        if (delta !== 0) {
          resolver.applyResourceChange({
            target: ally,
            amount: delta,
            context,
            sourceId: user.id,
          });
        }
      }

      return {
        log: `${user.name} equalized the team's energy flow.`,
      };
    },
  },

  // =========================
  // Absolute Channeling
  // =========================

  {
    key: "absolute_channeling",
    name: "Absolute Channeling",

    priority: 0,
    contact: false,

    bonusMomentum: 7,

    description() {
      return `Drains all Momentum from allies and transfers it to a chosen ally, granting +${this.bonusMomentum} bonus Momentum.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context, resolver }) {
      const [target] = targets;

      const allies = context.aliveChampions.filter(
        (c) => c.team === user.team,
      );

      let drained = 0;

      for (const ally of allies) {
        if (ally.id === target.id) continue;
        if (ally.momentum <= 0) continue;

        const { applied } = resolver.applyResourceChange({
          target: ally,
          amount: -ally.momentum,
          context,
          sourceId: user.id,
          debugLabel: "eryon_channeling_drain",
        });

        drained += Math.abs(applied);
      }

      resolver.applyResourceChange({
        target,
        amount: drained + this.bonusMomentum,
        context,
        sourceId: user.id,
        debugLabel: "eryon_channeling_grant",
      });

      return {
        log: `${formatChampionName(user)} channeled ${drained + this.bonusMomentum} Momentum into ${formatChampionName(target)}.`,
      };
    },
  },

  // =========================
  // Eidolic Collapse (ULT)
  // =========================

  {
    key: "eidolic_collapse",
    name: "Eidolic Collapse",

    isUltimate: true,
    momentumCost: 24,
    priority: -1,
    contact: false,
    targetSpec: ["all"],

    damagePerUnit: 3,
    maxConsume: 84,

    description() {
      return `Consumes all Momentum from the team (max. ${this.maxConsume}) and converts each point into ${this.damagePerUnit} damage, distributed randomly among an enemy and their adjacent allies.`;
    },

    resolve({ user, context, resolver }) {
      const allies = context.aliveChampions.filter(
        (c) => c.team === user.team,
      );

      const pool = [];

      for (const ally of allies) {
        for (let i = 0; i < ally.momentum; i++) pool.push(ally);
      }

      const consumedPerAlly = new Map();
      let consumed = 0;

      while (pool.length > 0 && consumed < this.maxConsume) {
        const [chosen] = pool.splice(
          Math.floor(Math.random() * pool.length),
          1,
        );

        consumedPerAlly.set(chosen, (consumedPerAlly.get(chosen) ?? 0) + 1);
        consumed++;
      }

      if (consumed === 0) return;

      for (const [ally, amount] of consumedPerAlly) {
        resolver.applyResourceChange({
          target: ally,
          amount: -amount,
          context,
          sourceId: user.id,
          debugLabel: "eryon_collapse_consume",
        });
      }

      const enemies = context.aliveChampions.filter(
        (c) => c.team !== user.team,
      );

      if (!enemies.length) return;

      const primary =
        enemies[Math.floor(Math.random() * enemies.length)];

      const targets = [
        primary,
        ...context.getAdjacentChampions(primary),
      ];

      const damageMap = new Map(targets.map((t) => [t.id, 0]));

      for (let i = 0; i < consumed; i++) {
        const hit = targets[Math.floor(Math.random() * targets.length)];

        damageMap.set(hit.id, damageMap.get(hit.id) + this.damagePerUnit);
      }

      for (const target of targets) {
        const damage = damageMap.get(target.id);

        if (damage <= 0) continue;

        new DamageEvent({
          baseDamage: damage,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context.allChampions,
        }).execute();
      }

      return {
        log: `${formatChampionName(user)} collapsed the Eidolic flow (${consumed} Momentum).`,
      };
    },
  },
];

export default eryonSkills;
