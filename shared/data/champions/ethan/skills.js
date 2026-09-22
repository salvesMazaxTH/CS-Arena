import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const ethanSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "marked_strike",
    name: "Marked Strike",

    bf: 70,
    evasionDebuff: 15,
    debuffDuration: 2,
    bleedingStacks: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `Ethan doesn't waste a cut he hasn't already placed in his head. Deals <b>physical damage</b>, reducing the target's <b>Evasion</b> by <b>${this.evasionDebuff}</b> for <b>${this.debuffDuration}</b> turn(s) and leaving them <b>Bleeding</b> for <b>${this.bleedingStacks}</b> stack(s).`,
        pt: `Ethan não desperdiça um corte que ele já não tenha planejado na cabeça. Causa <b>dano físico</b>, reduzindo a <b>Esquiva</b> do alvo em <b>${this.evasionDebuff}</b> por <b>${this.debuffDuration}</b> turno(s) e deixando-o <b>Sangrando</b> por <b>${this.bleedingStacks}</b> carga(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (arr[0]?.landed) {
        enemy.debuffStat({
          statName: "Evasion",
          amount: -this.evasionDebuff,
          duration: this.debuffDuration,
          context,
          statModifierSrc: user,
        });
      }

      if (effectConnected(arr[0], "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedingStacks, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "choke_hold",
    name: "Choke Hold",

    bf: 30,
    snareDuration: 2,

    contact: true,
    damageMode: "standard",
    priority: 1,

    description() {
      return {
        en: `He doesn't need the blade for this part — just leverage and patience. Deals <b>physical damage</b>, <b>Snaring</b> the target for <b>${this.snareDuration}</b> turn(s).`,
        pt: `Ele não precisa da lâmina para essa parte — só de alavancagem e paciência. Causa <b>dano físico</b>, <b>Enraizando</b> o alvo por <b>${this.snareDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "executioners_ledger",
    name: "Executioner's Ledger",

    bf: 130,
    clayBonusPercent: 20,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 50,
    priority: 0,

    description() {
      return {
        en: `Every debt gets collected eventually — Ethan just keeps the books. Deals <b>physical damage</b>, striking with an extra <b>${this.clayBonusPercent}%</b> force if <b>Clay</b> is fighting at his side.`,
        pt: `Toda dívida acaba sendo cobrada — Ethan só mantém os registros. Causa <b>dano físico</b>, golpeando com <b>${this.clayBonusPercent}%</b> de força extra se <b>Clay</b> estiver lutando ao seu lado.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const clayAtSide = context.aliveChampions?.some(
        (c) =>
          c.team === user.team &&
          (c.championKey === "clay" || c.championKey === "clay_godslayer"),
      );
      const effectiveBf = this.bf + (clayAtSide ? this.clayBonusPercent : 0);
      const baseDamage = (user.Attack * effectiveBf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default ethanSkills;
