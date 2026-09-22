import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const jeffTheDeathSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "funeral_strike",
    name: "Funeral Strike",

    bf: 55,
    contact: true,
    damageMode: "piercing",
    piercingPercentage: 70, // 70% Piercing Damage
    priority: 0,

    description() {
      return {
        en: `Jeff swings like a man already dead — because he has been, more than once. Deals <b>Piercing Damage</b> (<b>${this.piercingPercentage}%</b> Piercing) to the chosen enemy. If Jeff has already died before, the strike also lands on adjacent champions.`,
        pt: `Jeff golpeia como um homem já morto — porque já foi, mais de uma vez. Causa <b>Dano Perfurante</b> (<b>${this.piercingPercentage}%</b> Perfurante) ao inimigo escolhido. Se Jeff já morreu antes, o golpe também atinge campeões adjacentes.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      user.runtime.deathCounter ??= 0;

      const results = [];

      // PRIMARY
      const primaryResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const primaryResults = Array.isArray(primaryResult)
        ? primaryResult
        : [primaryResult];

      results.push(...primaryResults);

      // No death stacks, so the effect ends here.
      if (user.runtime.deathCounter <= 0) return results;

      const adjacentEnemies =
        context.getAdjacentChampions(enemy) || [];

      // Deal damage to each adjacent enemy.
      for (const adjacentEnemy of adjacentEnemies) {
        const result = new DamageEvent({
          baseDamage,
          mode: this.damageMode,
          piercingPercentage: this.piercingPercentage,
          attacker: user,
          defender: adjacentEnemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const adjacentResults = Array.isArray(result)
          ? result
          : [result];

        results.push(...adjacentResults);
      }

      return results;
    },
  },

  {
    key: "deaths_embrace",
    name: "Death's Embrace",

    bf: 40,
    damageMode: "standard",

    markDuration: 2,
    rewardAttack: 20,
    punishPercent: 0.2,

    contact: false,
    priority: 1,

    hits: [
      {
        id: "punish",
        type: "magical",
        contact: false,
        damageMode: "absolute",
      },
    ],

    description() {
      return {
        en: `Death picks a name and waits to see if it holds. Deals damage to the chosen target and marks them for <b>${this.markDuration}</b> turn(s). If the target dies while marked, Jeff gains <b>+${this.rewardAttack}</b> permanent <b>Attack</b>. Otherwise, the target takes bonus damage equal to <b>${this.punishPercent * 100}%</b> of their current HP at the start of each turn.`,
        pt: `A Morte escolhe um nome e espera para ver se ele se confirma. Causa dano ao alvo escolhido e o marca por <b>${this.markDuration}</b> turno(s). Se o alvo morrer enquanto marcado, Jeff ganha <b>+${this.rewardAttack}</b> de <b>Ataque</b> permanente. Caso contrário, o alvo sofre dano bônus igual a <b>${this.punishPercent * 100}%</b> do seu HP atual no início de cada turno.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const damageResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const mainDamage = Array.isArray(damageResult) ? damageResult[0] : damageResult;
      if (!effectConnected(mainDamage, "deaths_embrace_mark")) return damageResult;

      // Mark the enemy.
      enemy.runtime.markedByDeathsEmbrace = true;

      const skill = this;
      const punishPercent = this.punishPercent;
      const rewardAttack = this.rewardAttack;

      enemy.runtime.hookEffects ??= [];

      enemy.addHookEffect({
        type: "debuff",
        key: "deaths_embrace_mark",
        subtypes: ["dot", "magical"],
        expiresAtTurn:
          context.currentTurn + this.markDuration,

        onTurnStart({ owner, context }) {
          if (!owner.runtime.markedByDeathsEmbrace) return;

          // The purge drops this hook right after its last tick, so the mark
          // has to clear itself here or its VFX would never come off.
          if (this.expiresAtTurn <= context.currentTurn) {
            owner.runtime.markedByDeathsEmbrace = false;
          }

          const punishDamage = owner.HP * punishPercent;
          const dotContext = { ...context, isDot: true };

          const result = SkillHits.run(skill, "punish", {
            user: null,
            target: owner,
            baseDamage: punishDamage,
            context: dotContext,
          });

          if (result?.immune) {
            return {
              log: {
                en: `${formatChampionName(
                  owner,
                )} is immune to Death's Embrace damage!`,
                pt: `${formatChampionName(
                  owner,
                )} é imune ao dano de Abraço da Morte!`,
              },
            };
          }

          return {
            log: {
              en: `${formatChampionName(
                owner,
              )} takes ${
                result?.totalDamage ?? punishDamage
              } <b>Death's Embrace</b> damage.`,
              pt: `${formatChampionName(
                owner,
              )} sofre ${
                result?.totalDamage ?? punishDamage
              } de dano de <b>Abraço da Morte</b>.`,
            },
          };
        },
      }, context);

      user.runtime.hookEffects ??= [];

      user.addHookEffect({
        type: "buff",
        key: "deaths_embrace_buff",
        expiresAtTurn:
          context.currentTurn + this.markDuration,

        onChampionDeath({ deadChampion, context }) {
          if (deadChampion !== enemy) return;

          // Reward: Jeff gains permanent Attack.
          user.modifyStat({
            statName: "Attack",
            amount: rewardAttack,
            isPermanent: true,
            context,
          });

          user.runtime.hookEffects =
            user.runtime.hookEffects.filter(
              (effect) => effect.key !== "deaths_embrace_buff",
            );
        },
      }, context);

      return damageResult;
    },
  },

  {
    key: "deaths_inevitability",
    name: "Death's Inevitability",

    bf: 50,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,

    priority: 0,

    threshold: 0.25,

    description() {
      return {
        en: `Some verdicts don't wait for a killing blow — Jeff has already signed this one. Deals moderate damage to the chosen target and marks them for death. At the start of the next turn, if the target is below <b>${this.threshold * 100}%</b> HP, Death claims them.`,
        pt: `Alguns vereditos não esperam pelo golpe final — Jeff já assinou este. Causa dano moderado ao alvo escolhido e o marca para morrer. No início do próximo turno, se o alvo estiver abaixo de <b>${this.threshold * 100}%</b> de HP, a Morte o reivindica.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const damageResult = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const threshold = this.threshold;
      const triggerTurn =
        (context.currentTurn ?? 0) + 1;

      enemy.runtime.markedByDeathsInevitability = true;

      // Internal hook for the inevitable execution.
      const hook = {
        type: "debuff",
        key: "death_claim_execution",
        group: "deathClaim",
        triggerTurn,
        expiresAtTurn: triggerTurn + 1,

        priority: -999,

        onTurnStart({ owner, context }) {
          if (!owner.alive) {
            owner.runtime.markedByDeathsInevitability = false;

            owner.runtime.hookEffects =
              owner.runtime.hookEffects.filter(
                (effect) =>
                  effect.key !== "death_claim_execution",
              );

            return;
          }

          // Check only once, at the start of the following turn.
          if (context.currentTurn !== this.triggerTurn) return;

          if (owner.HP / owner.maxHP > threshold) return;

          owner.runtime.deathClaimTriggered = true;

          owner.HP = 0;
          owner.alive = false;

          // Clear immediately upon execution.
          owner.runtime.markedByDeathsInevitability = false;

          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (effect) => effect.key !== "death_claim_execution",
          );

          context.registerDialog({
            message: {
              en: `Death claims ${formatChampionName(owner)}!`,
              pt: `A Morte reivindica ${formatChampionName(owner)}!`,
            },
            sourceId: owner.id,
            targetId: owner.id,
          });

          return {
            log: {
              en: `<b>Death's Inevitability</b> claims ${formatChampionName(owner)}.`,
              pt: `<b>Inevitabilidade da Morte</b> reivindica ${formatChampionName(owner)}.`,
            },
          };
        },

        onTurnEnd({ owner, context }) {
          // If the execution did not trigger, the mark expires
          // at the end of the same turn.
          if (context.currentTurn !== this.triggerTurn) return;

          owner.runtime.markedByDeathsInevitability = false;
        },
      };

      enemy.runtime.hookEffects ??= [];
      enemy.runtime.hookEffects = enemy.runtime.hookEffects.filter(
        (effect) => effect.key !== "death_claim_execution",
      );
      enemy.addHookEffect(hook, context);

      return damageResult;
    },
  },
];

export default jeffTheDeathSkills;