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
    element: "fire",
    hitVfx: "chain_lash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Gorvakharr's burning chain lashes out and wraps around the chosen target. If it lands, it applies <b>Snared</b> for <b>${this.snareDuration}</b> turn(s). Deals physical damage.`,
        pt: `A corrente flamejante de Gorvakharr avança e se enrola no alvo escolhido. Se acertar, aplica <b>Enredado</b> por <b>${this.snareDuration}</b> turno(s). Causa dano físico.`,
      };
    },

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

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return results;
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
    element: "fire",
    hitVfx: "multislash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Gorvakharr drives his fire-wreathed blade into the chosen target. Against a <b>Snared</b> or <b>Rooted</b> target it strikes with <b>+${this.snaredBonusBf}</b> power. If it lands, it applies <b>Burning</b> for <b>${this.burnDuration}</b> turn(s). Deals physical damage.`,
        pt: `Gorvakharr crava sua lâmina envolta em fogo no alvo escolhido. Contra um alvo <b>Enredado</b> ou <b>Enraizado</b>, golpeia com <b>+${this.snaredBonusBf}</b> de poder. Se acertar, aplica <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s). Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const effectiveBf =
        enemy.hasStatusEffect("snared") || enemy.hasStatusEffect("rooted")
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

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context, {
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "crimson_moon_harvest",
    name: "Crimson Moon Harvest",

    isUltimate: true,
    momentumCost: 55,

    bf: 90,
    executeThreshold: 0.25,
    executeFlatThreshold: 85,
    finishingType: "regular",

    contact: true,
    damageMode: "standard",
    element: "fire",
    hitVfx: "multislash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      const percent = this.executeThreshold * 100;

      return {
        en: `Gorvakharr drops on the chosen target under a crimson moon, chain and blade together. If the blow leaves them at or below <b>${percent}%</b> of their <b>Max HP</b> and at or below <b>${this.executeFlatThreshold}</b> <b>HP</b>, it <b>Executes</b> them. Deals physical damage.`,
        pt: `Gorvakharr desaba sobre o alvo escolhido sob uma lua carmesim, corrente e lâmina juntas. Se o golpe o deixar com <b>${percent}%</b> ou menos do seu <b>HP Máximo</b> e com <b>${this.executeFlatThreshold}</b> de <b>HP</b> ou menos, ele o <b>Executa</b>. Causa dano físico.`,
      };
    },

    finishingRule({ defender }) {
      if (defender.HP > this.executeFlatThreshold) return;
      return this.executeThreshold;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

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
