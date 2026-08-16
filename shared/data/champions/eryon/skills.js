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

    description() {
      return `Drains all Momentum from allies and transfers it to a chosen ally, granting +7 bonus Momentum.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [target] = targets;

      const allies = context.aliveChampions.filter(
        (c) => c.team === user.team,
      );

      let total = 0;

      console.log(
        "[ERYON][absolute_channeling] Skill started",
      );

      console.log(
        "[ERYON][absolute_channeling] Channeling target:",
        target?.name,
        "(ID:",
        target?.id,
        ")",
      );

      for (const ally of allies) {
        if (ally.id === target.id) {
          console.log(
            "[ERYON][absolute_channeling] Skipping primary target:",
            ally.name,
          );
          continue;
        }

        const amount = ally.momentum;

        console.log(
          "[ERYON][absolute_channeling] Draining from:",
          ally.name,
          "momentum:",
          amount,
        );

        if (amount <= 0) {
          console.log(
            "[ERYON][absolute_channeling] Nothing to drain from:",
            ally.name,
          );
          continue;
        }

        ally.spendMomentum(amount);
        total += amount;

        console.log(
          "[ERYON][absolute_channeling] Drained:",
          amount,
          "from",
          ally.name,
          "Total accumulated:",
          total,
        );
      }

      const finalGain = total + 7;

      console.log(
        "[ERYON][absolute_channeling] Total drained:",
        total,
        "+ bonus: 7 =",
        finalGain,
      );

      target.addMomentum({
        amount: finalGain,
        context,
      });

      console.log(
        "[ERYON][absolute_channeling] Target's final Momentum after transfer:",
        target.momentum,
      );

      return {
        log: `${user.name} channeled energy to ${target.name}.`,
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
    momentumCost: 16,
    priority: -1,
    contact: false,
    targetSpec: ["all"],

    damagePerUnit: 6,
    maxConsume: 66,

    description() {
      return `Consumes all Momentum from the team (max. ${this.maxConsume}) and converts each point into ${this.damagePerUnit} damage, distributed randomly among an enemy and their adjacent allies.`;
    },

    resolve({ user, context }) {
      console.log(
        "[ERYON][eidolic_collapse] Skill started",
      );

      const allies = context.aliveChampions.filter(
        (c) => c.team === user.team,
      );

      // 🔹 Build Momentum pool
      let pool = [];

      for (const ally of allies) {
        for (let i = 0; i < ally.momentum; i++) {
          pool.push(ally);
        }
      }

      console.log(
        "[ERYON][eidolic_collapse] Initial Momentum pool (ids):",
        pool.map((a) => a.id),
      );

      let consumed = 0;
      const maxConsume = this.maxConsume;

      while (
        pool.length > 0 &&
        consumed < maxConsume
      ) {
        const index = Math.floor(
          Math.random() * pool.length,
        );

        const chosen = pool[index];

        chosen.spendMomentum(1);
        pool.splice(index, 1);

        consumed++;
      }

      console.log(
        "[ERYON][eidolic_collapse] Total consumed:",
        consumed,
      );

      if (consumed === 0) return;

      // 🔹 Select a random primary target
      const enemies = context.aliveChampions.filter(
        (c) => c.team !== user.team,
      );

      if (!enemies.length) return;

      const primary =
        enemies[
          Math.floor(Math.random() * enemies.length)
        ];

      console.log(
        "[ERYON][eidolic_collapse] Primary target:",
        primary?.name,
        "(ID:",
        primary?.id,
        ")",
      );

      const adjacent = context.getAdjacentChampions
        ? context.getAdjacentChampions(primary) || []
        : [];

      const targets = [primary, ...adjacent];

      console.log(
        "[ERYON][eidolic_collapse] Final targets:",
        targets.map((t) => t.name),
      );

      // 🔹 Distribute damage
      const chunks = consumed;
      const damageMap = new Map();

      for (const target of targets) {
        damageMap.set(target.id, 0);
      }

      for (let i = 0; i < chunks; i++) {
        const randomTarget =
          targets[
            Math.floor(Math.random() * targets.length)
          ];

        damageMap.set(
          randomTarget.id,
          damageMap.get(randomTarget.id) + 6,
        );
      }

      // 🔹 Deal damage
      for (const target of targets) {
        const dmg = damageMap.get(target.id);

        if (!dmg || dmg <= 0) continue;

        console.log(
          "[ERYON][eidolic_collapse] Dealing",
          dmg,
          "damage to",
          target.name,
        );

        new DamageEvent({
          baseDamage: dmg,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context.allChampions,
        }).execute();
      }

      return {
        log: `${user.name} collapsed the Eidolic flow (${consumed} Momentum).`,
      };
    },
  },
];

export default eryonSkills;