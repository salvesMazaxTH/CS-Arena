import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const brunoSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Frost Missile
  // ========================
  {
    key: "frost_missile",
    name: "Frost Missile",
    bf: 55,
    chillDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "ice",

    description() {
      return {
        en: `Bruno hurls a shard of hard frost at the chosen target, dealing <b>Ice</b> magical damage and leaving them <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s).`,
        pt: `Bruno arremessa um caco de gelo duro no alvo escolhido, causando dano mágico de <b>Gelo</b> e deixando-o <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "chilled")) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },

  // ========================
  // H2 — Glacial Charge
  // ========================
  {
    key: "glacial_charge",
    name: "Glacial Charge",
    bf: 80,
    contact: true,
    damageMode: "standard",
    priority: 0,
    element: "ice",

    description() {
      return {
        en: `Bruno closes the distance behind a wall of advancing ice and drives it into the chosen target, dealing <b>Ice</b> physical damage.`,
        pt: `Bruno fecha a distância atrás de uma parede de gelo avançando e a crava no alvo escolhido, causando dano físico de <b>Gelo</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  // ========================
  // Ultimate — Blizzard
  // ========================
  {
    key: "blizzard",
    name: "Blizzard",
    bf: 120,
    chillDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    isUltimate: true,
    momentumCost: 55,
    element: "ice",

    description() {
      return {
        en: `Bruno pulls the whole winter down onto the chosen target, dealing devastating <b>Ice</b> magical damage and leaving them <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s).`,
        pt: `Bruno traz todo o inverno sobre o alvo escolhido, causando devastador dano mágico de <b>Gelo</b> e deixando-o <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "chilled")) {
        target.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },
];

export default brunoSkills;
