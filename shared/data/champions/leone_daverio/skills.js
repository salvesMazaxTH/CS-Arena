import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const leoneSkills = [
  totalBlock,

  {
    key: "flicker_cut",
    name: "Flicker Cut",

    bf: 70,
    bleedingStacks: 1,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    hitVfxPalette: "crimson",
    priority: 1,
    targetSpec: ["enemy"],

    description() {
      return `Leone closes the gap between one heartbeat and the next, a flick of his nails opening the chosen target before they register he moved. Deals physical damage and leaves them Bleeding for ${this.bleedingStacks} stack(s).`;
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

      if (effectConnected(result, "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedingStacks, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "jugular_bite",
    name: "Jugular Bite",

    bf: 55,
    defenseShred: 30,
    shredDuration: 2,

    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Leone is simply gone, then at the chosen target's throat, teeth sunk into the jugular before they can flinch. Deals physical damage and tears enough away to lower their Defense by ${this.defenseShred} for ${this.shredDuration} turn(s).`;
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

      const arr = Array.isArray(result) ? result : [result];

      if (arr[0]?.landed) {
        enemy.modifyStat({
          statName: "Defense",
          amount: -this.defenseShred,
          duration: this.shredDuration,
          context,
          statModifierSrc: user,
        });
      }

      return arr;
    },
  },

  {
    key: "twilight_feast",
    name: "Twilight Feast",

    bf: 100,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Leone raises an imaginary toast to the chosen target, then is at their throat before the gesture finishes, draining them dry with a hunger he stopped pretending to hide. Deals physical damage and is always a critical hit.`;
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
        critOptions: { force: true },
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default leoneSkills;
