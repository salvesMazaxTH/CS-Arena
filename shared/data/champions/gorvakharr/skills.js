import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const gorvakharrSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "chainforged_ambush",
    name: "Chainforged Ambush",

    bf: 60,
    snareDuration: 2,

    contact: true,
    damageMode: "standard",
    type: "physical",
    element: "fire",
    hitVfx: "chain_lash",
    priority: 0,

    description() {
      return {
        en: `Gorvakharr's burning chain lashes out and wraps around the chosen target. Deals <b>physical damage</b> and applies <b>Snared</b> for <b>${this.snareDuration}</b> turn(s).`,
        pt: `A corrente flamejante de Gorvakharr avança e se enrola no alvo escolhido. Causa <b>dano físico</b> e aplica <b>Enraizado</b> por <b>${this.snareDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "cinderedge_slash",
    name: "Cinderedge Slash",

    bf: 70,
    snaredBonusBf: 30,
    burnDuration: 2,

    contact: true,
    damageMode: "standard",
    type: "physical",
    element: "fire",
    hitVfx: "multislash",
    priority: 0,

    description() {
      return {
        en: `Gorvakharr drives his fire-wreathed blade into the chosen target, dealing <b>physical damage</b> and applying <b>Burning</b> for <b>${this.burnDuration}</b> turn(s). If the target is <b>Snared</b>, this attack instead strikes with <b>${this.bf + this.snaredBonusBf}</b> power.`,
        pt: `Gorvakharr crava sua lâmina envolta em fogo no alvo escolhido, causando <b>dano físico</b> e aplicando <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s). Se o alvo estiver <b>Enraizado</b>, este ataque golpeia com <b>${this.bf + this.snaredBonusBf}</b> de poder.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const effectiveBf = enemy.hasStatusEffect("snared")
        ? this.bf + this.snaredBonusBf
        : this.bf;
      const baseDamage = (user.Attack * effectiveBf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "crimson_moon_harvest",
    name: "Crimson Moon Harvest",

    bf: 90,

    contact: true,
    damageMode: "standard",
    type: "physical",
    element: "fire",
    hitVfx: "multislash",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    executeThreshold: 0.25,
    executeFlatThreshold: 85,
    finishingType: "regular",

    description() {
      const percent = this.executeThreshold * 100;

      return {
        en: `Gorvakharr drops on the chosen target under a crimson moon, chain and blade together. Deals heavy <b>physical damage</b>. <b>Executes</b> the target if they are critically wounded (≤ <b>${percent}%</b> of their Max HP and ≤ <b>${this.executeFlatThreshold}</b> HP).`,
        pt: `Gorvakharr desaba sobre o alvo escolhido sob uma lua carmesim, corrente e lâmina juntas. Causa <b>dano físico</b> pesado. <b>Executa</b> o alvo se estiver criticamente ferido (≤ <b>${percent}%</b> do HP Máximo e ≤ <b>${this.executeFlatThreshold}</b> de HP).`,
      };
    },

    finishingRule({ defender }) {
      const maxHP = defender?.maxHP;
      const currentHP = defender?.HP;

      if (!Number.isFinite(maxHP) || maxHP <= 0) {
        return this.executeThreshold;
      }

      if (!Number.isFinite(currentHP)) return;

      if (currentHP > this.executeFlatThreshold) return;

      return this.executeThreshold;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      if (!enemy) return;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
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

export default gorvakharrSkills;
