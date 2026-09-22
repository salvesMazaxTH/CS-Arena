import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import basicShot from "../generic/basicShot.js";

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
      return {
        en: `Eryon reads the instant already written for balance and simply enforces it early. Sets the <b>Momentum</b> of all allies to their current average <b>+6</b>.`,
        pt: `Eryon lê o instante já destinado ao equilíbrio e apenas o antecipa. Define o <b>Momentum</b> de todos os aliados como a média atual do time <b>+6</b>.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context, resolver }) {
      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);

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
        log: {
          en: `${user.name} equalized the team's energy flow.`,
          pt: `${user.name} equalizou o fluxo de energia do time.`,
        },
      };
    },
  },

  // =========================
  // Absolute Channeling
  // =========================

  {
    key: "absolute_channeling",
    name: "Absolute Channeling",

    priority: 1,
    contact: false,

    bonusMomentum: 7,

    description() {
      return {
        en: `Eryon collapses every ally's instant of momentum into one, and hands the whole ledger to a single name. Drains all <b>Momentum</b> from allies and transfers it to a chosen ally, granting <b>+${this.bonusMomentum}</b> bonus Momentum.`,
        pt: `Eryon colapsa o instante de momentum de cada aliado em um só, e entrega o registro inteiro a um único nome. Drena todo o <b>Momentum</b> dos aliados e o transfere para um aliado escolhido, concedendo <b>+${this.bonusMomentum}</b> de Momentum bônus.`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context, resolver }) {
      const [target] = targets;

      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);

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
        log: {
          en: `${formatChampionName(user)} channeled ${drained + this.bonusMomentum} Momentum into ${formatChampionName(target)}.`,
          pt: `${formatChampionName(user)} canalizou ${drained + this.bonusMomentum} de Momentum para ${formatChampionName(target)}.`,
        },
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
    priority: 0,
    contact: false,
    damageMode: "standard",
    targetSpec: ["all"],

    damagePerUnit: 3,
    maxConsume: 84,

    description() {
      return {
        en: `Eryon calls in every instant the team has been owed and lets it detonate exactly where the calculation says it must land. Consumes all <b>Momentum</b> from the team (max. <b>${this.maxConsume}</b>) and converts each point into <b>${this.damagePerUnit}</b> damage, distributed randomly between a random enemy and one enemy adjacent to them (never more than <b>2</b> targets).`,
        pt: `Eryon cobra cada instante que o time já tinha a receber e o deixa detonar exatamente onde o cálculo diz que deve cair. Consome todo o <b>Momentum</b> do time (máx. <b>${this.maxConsume}</b>) e converte cada ponto em <b>${this.damagePerUnit}</b> de dano, distribuído aleatoriamente entre um inimigo aleatório e um inimigo adjacente a ele (nunca mais que <b>2</b> alvos).`,
      };
    },

    resolve({ user, context, resolver }) {
      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);

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

      const adjacent = context.getAdjacentChampions(primary);
      const chosenAdjacent =
        adjacent[Math.floor(Math.random() * adjacent.length)];

      const targets = chosenAdjacent ? [primary, chosenAdjacent] : [primary];

      const damageMap = new Map(targets.map((t) => [t.id, 0]));

      for (let i = 0; i < consumed; i++) {
        const hit = targets[Math.floor(Math.random() * targets.length)];

        damageMap.set(hit.id, damageMap.get(hit.id) + this.damagePerUnit);
      }

      const results = [];

      for (const target of targets) {
        const damage = damageMap.get(target.id);

        if (damage <= 0) continue;

        const result = new DamageEvent({
          baseDamage: damage,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context.allChampions,
        }).execute();

        if (Array.isArray(result)) results.push(...result);
        else if (result) results.push(result);
      }

      results.push({
        log: {
          en: `${formatChampionName(user)} collapsed the Eidolic flow (${consumed} Momentum).`,
          pt: `${formatChampionName(user)} colapsou o fluxo Eidólico (${consumed} de Momentum).`,
        },
      });

      return results;
    },
  },
];

export default eryonSkills;
