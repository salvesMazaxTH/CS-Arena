import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import {
  IGNORES_REDUCTION_AT,
  MAX_PLATES,
  platesShed,
  shedPlates,
} from "./plates.js";

// The second plate is off, so nothing the target layers on softens the blow.
const ignoresReduction = (user) => platesShed(user) >= IGNORES_REDUCTION_AT;

const vornOmegaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // H1 — Sundering Reach
  // ========================
  {
    key: "sundering_reach",
    name: "Sundering Reach",

    bf: 70,
    bfPerPlate: 12,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `VØRN Ω lets the long arm fall the way a bridge falls, without hurry and without any particular malice toward what is under it. Deals physical damage equal to ${this.bf}% of his Attack, plus ${this.bfPerPlate}% for every plate he has already shed.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const bf = this.bf + this.bfPerPlate * platesShed(user);

      const result = new DamageEvent({
        baseDamage: (user.Attack * bf) / 100,
        ignoreDamageReduction: ignoresReduction(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },

  // ========================
  // H2 — Foundry Silence
  // ========================
  {
    key: "foundry_silence",
    name: "Foundry Silence",

    bf: 55,
    healBlockDuration: 2,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `VØRN Ω closes a hand around the chosen target and holds it the way his makers once held a part they had decided not to keep. Deals physical damage and afflicts them with Heal Block for ${this.healBlockDuration} turns — whatever was mending them stops, the way it stopped for him.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        ignoreDamageReduction: ignoresReduction(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainHit = results.find((entry) => entry?.targetId === enemy.id);

      if (effectConnected(mainHit, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Ω
  // ========================
  {
    key: "omega",
    name: "Ω",

    isUltimate: true,
    momentumCost: 55,

    bf: 90,
    bfPerPlate: 18,

    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `VØRN Ω opens the core he was built around, which is the one thing his makers told him never to do, and there is nobody left to tell him again. Every plate still on him comes off at once. Deals physical damage equal to ${this.bf}% of his Attack, plus ${this.bfPerPlate}% for every plate he had already thrown off before opening — a machine that waited is a heavier one.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      // Read before shedding: waiting for HP to take the plates off is what the
      // bonus pays for, so opening the core early must not earn it.
      const bf = this.bf + this.bfPerPlate * platesShed(user);

      const shed = shedPlates(user, MAX_PLATES, context);

      if (shed > 0) {
        context.registerDialog?.({
          message: `${formatChampionName(user)} opens the core — the last ${shed === 1 ? "plate goes" : `${shed} plates go`} with it.`,
          sourceId: user.id,
          targetId: user.id,
        });
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * bf) / 100,
        ignoreDamageReduction: ignoresReduction(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },
];

export default vornOmegaSkills;
