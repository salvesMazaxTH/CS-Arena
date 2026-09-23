import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const naelysSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================
  {
    key: "pendant_of_the_waves",
    name: "Pendant of the Waves",
    contact: false,
    bf: 80,
    damageMode: "standard",
    priority: 0,
    element: "water",
    selfHealAmount: 50,
    allyHealAmount: 20,
    snareDuration: 1,

    description() {
      return {
        en: `Naelys restores <b>${this.selfHealAmount}</b> HP to herself and <b>${this.allyHealAmount}</b> HP to an ally, dealing damage to the enemy and dragging them under, <b>Snared</b> for <b>${this.snareDuration}</b> turn(s).`,
        pt: `Naelys restaura <b>${this.selfHealAmount}</b> HP para si mesma e <b>${this.allyHealAmount}</b> HP para um aliado, causando dano ao inimigo e puxando-o para o fundo, deixando-o <b>Enredado</b> por <b>${this.snareDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy", { type: "select:ally", excludesSelf: true }],

    resolve({ user, targets, context = {} }) {
      // Either role can go missing, so neither may be read by position.
      const enemy = targets.find((target) => target.team !== user.team);
      const ally = targets.find(
        (target) => target.team === user.team && target.id !== user.id,
      );

      const baseDamage = (user.Attack * this.bf) / 100;

      const results = [];

      if (enemy) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const damageResults = Array.isArray(damageResult)
          ? damageResult
          : [damageResult];
        results.push(...damageResults);

        if (
          damageResults.some((r) => effectConnected(r, "snared")) &&
          enemy.alive
        ) {
          enemy.applyStatusEffect("snared", this.snareDuration, context);
        }
      }

      const selfHealed = new HealEvent({
        target: user,
        amount: this.selfHealAmount,
        context,
        source: user,
      }).execute();

      results.push({
        log: {
          en: `${formatChampionName(user)} restores <b>${selfHealed}</b> HP.`,
          pt: `${formatChampionName(user)} restaura <b>${selfHealed}</b> de HP.`,
        },
      });

      if (ally) {
        const allyHealed = new HealEvent({
          target: ally,
          amount: this.allyHealAmount,
          context,
          source: user,
        }).execute();

        results.push({
          log: {
            en: `${formatChampionName(ally)} restores <b>${allyHealed}</b> HP.`,
            pt: `${formatChampionName(ally)} restaura <b>${allyHealed}</b> de HP.`,
          },
        });
      }

      return results;
    },
  },

  {
    key: "mass_of_the_raging_sea",
    name: "Mass of the Raging Sea",
    contact: false,
    priority: 2,
    element: "water",
    damageReduction: 20,
    stanceDuration: 2,
    counterDamage: 50,

    hits: [
      {
        id: "counter",
        label: "Raging Sea Counterattack",
        type: "physical",
        element: null,
        contact: false,
        damageMode: "absolute",
      },
    ],

    description() {
      return {
        en: `Naelys assumes a maritime stance until the end of the next turn, gaining <b>${this.damageReduction}%</b> damage reduction. The first time she is hit each turn, she counterattacks the attacker for <b>${this.counterDamage}</b> <b>Absolute Damage</b>.`,
        pt: `Naelys se fecha como as marés até o fim do próximo turno, ganhando <b>${this.damageReduction}%</b> de redução de dano. Na primeira vez em que é atingida a cada turno, contra-ataca o agressor causando <b>${this.counterDamage}</b> de <b>dano Absoluto</b>.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];

      const skill = this;
      const counterDamage = this.counterDamage;

      const effect = {
        type: "buff",
        key: "mass_of_the_raging_sea",
        expiresAtTurn: context.currentTurn + this.stanceDuration,
        lastTriggerTurn: null,

        hookScope: {
          onAfterDmgTaking: "defender",
        },

        onAfterDmgTaking({ attacker, damage, owner, context }) {
          if (damage <= 0) return;

          if (this.lastTriggerTurn === context.currentTurn) return;

          this.lastTriggerTurn = context.currentTurn;

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            ...SkillHits.params(skill, "counter", {
              user: owner,
              target: attacker,
              baseDamage: counterDamage,
              context,
            }),

            dialog: {
              message: {
                en: `${formatChampionName(
                  owner,
                )} counterattacked with the force of the Raging Sea!`,
                pt: `${formatChampionName(
                  owner,
                )} contra-atacou com a força do Mar Bravio!`,
              },
              duration: 1000,
            },
          });

          return {
            log: {
              en: `🌊 ${formatChampionName(
                owner,
              )} counterattacks with the force of the sea!`,
              pt: `🌊 ${formatChampionName(
                owner,
              )} contra-ataca com a força do mar!`,
            },
          };
        },
      };

      user.addHookEffect(effect, context);

      user.applyDamageReduction({
        amount: this.damageReduction,
        type: "percent",
        duration: this.stanceDuration,
        context,
      });

      return {
        log: {
          en: `${formatChampionName(
            user,
          )} assumes the stance of the Raging Sea!`,
          pt: `${formatChampionName(
            user,
          )} assume a postura do Mar Bravio!`,
        },
      };
    },
  },

  {
    key: "overflow",
    name: "Overflow",
    contact: false,
    damageMode: "standard",
    priority: 3,
    duration: 3,
    maxBonus: 120,
    stacksPerHPLost: 30,
    bonusPerStack: 15,
    element: "water",

    isUltimate: true,
    momentumCost: 40,

    description() {
      return {
        en: `For <b>${this.duration}</b> turns, Naelys deals bonus damage based on her lost HP (up to <b>+${this.maxBonus}</b>).`,
        pt: `Por <b>${this.duration}</b> turnos, Naelys causa dano bônus com base no HP que perdeu (até <b>+${this.maxBonus}</b>).`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const { currentTurn } = context;

      user.addDamageModifier({
        id: "overflow",
        expiresAtTurn: currentTurn + this.duration,

        apply: ({ baseDamage, attacker }) => {
          const lostHP = attacker.maxHP - attacker.HP;

          const stacks = Math.floor(lostHP / this.stacksPerHPLost);

          const bonus = Math.min(stacks * this.bonusPerStack, this.maxBonus);

          return baseDamage + bonus;
        },
      });

      return {
        log: {
          en: `🌊 ${formatChampionName(user)} unleashes <b>${this.name}</b>!`,
          pt: `🌊 ${formatChampionName(user)} desencadeia <b>${this.name}</b>!`,
        },
      };
    },
  },
];

export default naelysSkills;
