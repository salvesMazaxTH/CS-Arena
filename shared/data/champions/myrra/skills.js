import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const myrraSkills = [
  totalBlock,

  {
    key: "precision_cut",
    name: "Precision Cut",
    bf: 65,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    description() {
      return {
        en: `Myrra slips her blade past the guard of the chosen target, dealing <b>physical damage</b> that ignores their <b>damage reduction</b> entirely.`,
        pt: `Myrra desliza a lâmina pela guarda do alvo escolhido, causando <b>dano físico</b> que ignora completamente a <b>redução de dano</b> dele.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        ignoreDamageReduction: true,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "bladedance",
    name: "Bladedance",
    hits: 2,
    bfPerHit: 40,
    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    priority: 0,

    description() {
      return {
        en: `Myrra spins through the chosen target in <b>${this.hits}</b> flowing cuts, dealing <b>physical damage</b> with each. Every hit feeds her passive.`,
        pt: `Myrra gira através do alvo escolhido em <b>${this.hits}</b> cortes fluidos, causando <b>dano físico</b> em cada um. Todo acerto alimenta seu passivo.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (let i = 0; i < this.hits; i++) {
        const result = new DamageEvent({
          baseDamage: (user.Attack * this.bfPerHit) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(result);
      }

      return results;
    },
  },

  {
    key: "silent_execution",
    name: "Silent Execution",
    bf: 120,
    missingHpScaling: 0.5,
    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `Myrra steps in without a sound and finishes what the battle started, dealing <b>physical damage</b> to the chosen target that grows by <b>${this.missingHpScaling * 100}%</b> of the HP they have already lost. Ignores <b>damage reduction</b>.`,
        pt: `Myrra se aproxima sem fazer ruído e termina o que a batalha começou, causando <b>dano físico</b> ao alvo escolhido que cresce em <b>${this.missingHpScaling * 100}%</b> do HP que ele já perdeu. Ignora <b>redução de dano</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const missingHP = enemy.maxHP - enemy.HP;
      const bonus = missingHP * this.missingHpScaling;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100 + bonus,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        ignoreDamageReduction: true,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default myrraSkills;
