import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const valeriaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "groundshaker",
    name: "Groundshaker",

    bf: 55,
    stunDuration: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `The impact alone knocks the fight out of most people — Valeria never even needs to swing twice. Deals physical damage and always <b>Stuns</b> the chosen target for <b>${this.stunDuration}</b> turn(s).`,
        pt: `O impacto sozinho já tira a vontade de lutar da maioria — Valeria nunca precisa golpear duas vezes. Causa dano físico e sempre <b>Atordoa</b> o alvo escolhido por <b>${this.stunDuration}</b> turno(s).`,
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

      if (effectConnected(arr[0], "stunned")) {
        enemy.applyStatusEffect("stunned", this.stunDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "unbending_blow",
    name: "Unbending Blow",

    bf: 80,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `No half-measures, no mitigating circumstances — just the full weight of the hammer arriving all at once. Deals physical damage.`,
        pt: `Sem meio-termo, sem atenuantes — só o peso inteiro do martelo chegando de uma vez. Causa dano físico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

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

  {
    key: "dragonbane",
    name: "Dragonbane",

    bf: 135,
    piercingPercentage: 40,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `The same blow that put a dragon in the dirt, brought down now on someone far less legendary. Deals physical damage, with <b>${this.piercingPercentage}%</b> of it guaranteed to go through as <b>Piercing</b> damage, <b>Defense</b> be damned.`,
        pt: `O mesmo golpe que derrubou um dragão, agora descendo sobre alguém bem menos lendário. Causa dano físico, com <b>${this.piercingPercentage}%</b> dele garantido a atravessar como dano <b>Perfurante</b>, dane-se a <b>Defesa</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        mode: "piercing",
        piercingPercentage: this.piercingPercentage,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default valeriaSkills;
