import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const isarelisSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "eviscerate",
    name: "Eviscerate",

    bf: 55,
    damageMode: "standard",
    contact: true,
    hitVfx: "multislash",
    priority: 0,

    description() {
      return {
        en: "Isarelis closes on the chosen target with both daggers reversed and opens them up in a handful of strokes, short blades finding the gaps a longer edge would never reach, dealing <b>physical damage</b>.",
        pt: "Isarelis avança sobre o alvo escolhido com as duas adagas invertidas e o abre em um punhado de golpes, lâminas curtas encontrando as brechas que uma arma mais longa jamais alcançaria, causando <b>dano físico</b>.",
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      // The Backstab passive applies the bonus damage and Piercing Damage via hook.
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context.allChampions,
      }).execute();
    },
  },

  {
    key: "shadowstep",
    name: "Shadowstep",

    invisibleDuration: 3,

    description() {
      return {
        en: `Isarelis melts into the shadows between one heartbeat and the next. Becomes <b>Invisible</b> for up to <b>${this.invisibleDuration}</b> turns, ending early the moment she acts again. Cannot be targeted by enemies while it holds.`,
        pt: `Isarelis se dissolve nas sombras entre uma batida de coração e a outra. Fica <b>Invisível</b> por até <b>${this.invisibleDuration}</b> turnos, encerrando antes no momento em que agir de novo. Não pode ser alvo de inimigos enquanto durar.`,
      };
    },

    targetSpec: ["self"],
    priority: 1,

    resolve({ user, context }) {
      user.removeStatusEffect("invisible");
      user.applyStatusEffect("invisible", this.invisibleDuration, context, {
        source: "shadowstep",
      });

      context.registerDialog({
        message: `${formatChampionName(user)} disappears into the shadows.`,
        sourceId: user.id,
      });

      return [
        {
          log: `${formatChampionName(
            user,
          )} disappears into the shadows and becomes <b>Invisible</b> for up to ${this.invisibleDuration} turns.`,
        },
      ];
    },
  },

  {
    key: "coup_de_grace",
    name: "Coup de Grâce",

    bf: 85,
    damageMode: "standard",
    hitVfx: "multislash",
    contact: true,
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    executeThreshold: 0.25,
    executeFlatThreshold: 85,
    stealthBonus: 0.5,
    finishingType: "regular",

    description() {
      const percent = this.executeThreshold * 100;

      return {
        en: `Isarelis puts the final stroke where it counts, no wasted motion, no witnesses. Deals heavy damage to the chosen target. <b>Executes</b> the target only if they are critically wounded (≤ <b>${percent}%</b> of their Max HP and ≤ <b>${this.executeFlatThreshold}</b> HP). Deals <b>${this.stealthBonus * 100}%</b> bonus damage while <b>Invisible</b>.`,
        pt: `Isarelis desfere o golpe final onde importa, sem movimento desperdiçado, sem testemunhas. Causa dano pesado ao alvo escolhido. <b>Executa</b> o alvo apenas se estiver criticamente ferido (≤ <b>${percent}%</b> do HP Máximo e ≤ <b>${this.executeFlatThreshold}</b> de HP). Causa <b>${this.stealthBonus * 100}%</b> de dano bônus enquanto <b>Invisível</b>.`,
      };
    },

    finishingRule({ defender }) {
      const maxHP = defender?.maxHP;
      const currentHP = defender?.HP;

      if (!Number.isFinite(maxHP) || maxHP <= 0) {
        return this.executeThreshold;
      }

      if (!Number.isFinite(currentHP)) return;

      // Flat condition first.
      if (currentHP > this.executeFlatThreshold) return;

      return this.executeThreshold;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;
      if (!enemy) return;

      let baseDamage = (user.Attack * this.bf) / 100;

      if (user.hasStatusEffect("invisible")) {
        baseDamage *= 1 + this.stealthBonus;

        context.registerDialog({
          message: `${formatChampionName(user)} strikes from the shadows!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context.allChampions,
      }).execute();
    },
  },
];

export default isarelisSkills;