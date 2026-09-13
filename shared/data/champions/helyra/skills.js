import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const helyraSkills = [
  totalBlock,

  {
    key: "twin_report",
    name: "Twin Report",

    bf: 75,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfx: "charged_round",
    priority: 1,
    targetSpec: ["enemy"],

    description() {
      return `Helyra crosses both muzzles on the chosen target without breaking stride, and the marble hall gives back one flat crack instead of two. Deals physical damage.`;
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

  {
    key: "live_round",
    name: "Live Round",

    bf: 65,
    conductorDuration: 2,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfx: "charged_round",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Helyra buries a round that never finishes discharging, and from that moment the chosen target is less a person than a path to ground. Deals physical damage and applies Conductor for ${this.conductorDuration} turn(s).`;
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

      const resultArray = Array.isArray(result) ? result : [result];

      if (effectConnected(resultArray[0], "conductor")) {
        enemy.applyStatusEffect("conductor", this.conductorDuration, context, {
          sourceId: user.id,
          sourceName: user.name,
        });
      }

      return resultArray;
    },
  },

  {
    key: "shatterline",
    name: "Shatterline",

    bf: 125,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfx: "charged_round_big",
    doublesArc: true,
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Helyra runs the whole length of the hall with both guns open, and every pane and plinth between her and the chosen target comes apart in her wake. Deals physical damage, and the current that leaps off the chosen target carries twice its usual share.`;
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

export default helyraSkills;
