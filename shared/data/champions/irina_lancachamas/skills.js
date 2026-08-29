import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

// The flamethrower overheats every time the trigger is pulled, so the recoil is
// its own unconditional hit rather than a reaction queued off the shot (which
// would be dropped whenever the shot is dodged or hits an immune target). Depth
// 1 keeps it a nested event: no cascade, and Redline Rapture opts in to it.
function applyWeaponOverheat({ user, baseDamage, recoilPercent, context }) {
  const recoilDamage = Math.floor(baseDamage * (recoilPercent / 100));
  if (recoilDamage <= 0) return [];

  context.registerDialog?.({
    message: `${formatChampionName(user)}'s flamethrower redlines and scorches her own hands for ${recoilDamage}!`,
    sourceId: user.id,
    targetId: user.id,
  });

  const result = new DamageEvent({
    baseDamage: recoilDamage,
    attacker: user,
    defender: user,
    skill: { key: "weapon_overheat", name: "Weapon Overheat", suppressLog: true },
    type: "magical",
    mode: DamageEvent.Modes.ABSOLUTE,
    context: { ...context, damageDepth: 1 },
    allChampions: context?.allChampions,
  }).execute();

  return Array.isArray(result) ? result : [result];
}

const irinaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Controlled Burn
  // ========================
  {
    key: "controlled_burn",
    name: "Controlled Burn",

    bf: 45,
    burnChance: 0.25,
    burnDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "fire",

    description() {
      return `Irina holds the trigger steady for once, which for her counts as remarkable self-control: deals Fire physical damage to the chosen target, with a ${this.burnChance * 100}% chance to set them Burning for ${this.burnDuration} turn(s).`;
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

      const hitResult = Array.isArray(result) ? result[0] : result;

      if (effectConnected(hitResult, "burning") && Math.random() < this.burnChance) {
        enemy.applyStatusEffect("burning", this.burnDuration, context);
      }

      return result;
    },
  },

  // ========================
  // H2 — Cook It Off
  // ========================
  {
    key: "cook_it_off",
    name: "Cook It Off",

    bf: 60,
    burnDuration: 2,
    recoilPercent: 20,

    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "fire",

    description() {
      return `Irina throws the safety valve away and just doesn't stop: the flamethrower redlines and scorches her own hands right back, but she's too busy cackling to care. Deals heavy Fire physical damage to the chosen target and sets them Burning for ${this.burnDuration} turn(s).`;
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

      const results = Array.isArray(result) ? [...result] : [result];
      const hitResult = results[0];

      results.push(
        ...applyWeaponOverheat({
          user,
          baseDamage,
          recoilPercent: this.recoilPercent,
          context,
        }),
      );

      if (effectConnected(hitResult, "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context);
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Everything's Fine
  // ========================
  {
    key: "everythings_fine",
    name: "Everything's Fine",

    bf: 140,
    burnDuration: 3,
    recoilPercent: 25,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "fire",

    description() {
      return `Irina opens the tank all the way and holds on, screaming with laughter as the whole weapon goes up with the shot: unleashes devastating Fire physical damage on the chosen target and sets them Burning for ${this.burnDuration} turn(s), while the overheating gun scorches her right back.`;
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

      const results = Array.isArray(result) ? [...result] : [result];
      const hitResult = results[0];

      results.push(
        ...applyWeaponOverheat({
          user,
          baseDamage,
          recoilPercent: this.recoilPercent,
          context,
        }),
      );

      if (effectConnected(hitResult, "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context);
      }

      return results;
    },
  },
];

export default irinaSkills;
