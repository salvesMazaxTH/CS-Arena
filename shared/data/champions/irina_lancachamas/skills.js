import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

// Pushes the flamethrower's self-inflicted overheat recoil onto the extra
// damage queue. Always fires on the skills that use it — the gun overheats
// whether or not the shot actually connects.
function queueWeaponOverheat({ user, baseDamage, recoilPercent, context }) {
  const recoilDamage = baseDamage * (recoilPercent / 100);

  context.extraDamageQueue ??= [];
  context.extraDamageQueue.push({
    type: "magical",
    mode: "absolute",
    baseDamage: recoilDamage,
    attacker: user,
    defender: user,
    skill: {
      key: "weapon_overheat",
      name: "Weapon Overheat",
      suppressLog: true,
    },
    dialog: {
      message: `${formatChampionName(user)}'s flamethrower redlines and scorches her own hands for ${Math.floor(recoilDamage)}!`,
      duration: 1000,
    },
  });
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

      if (
        !hitResult?.evaded &&
        !hitResult?.immune &&
        Math.random() < this.burnChance
      ) {
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

      // Queued before execute() so the main hit's own processExtraQueue step
      // (run at the end of its execute()) picks up the recoil.
      queueWeaponOverheat({
        user,
        baseDamage,
        recoilPercent: this.recoilPercent,
        context,
      });

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

      if (!hitResult?.evaded && !hitResult?.immune) {
        enemy.applyStatusEffect("burning", this.burnDuration, context);
      }

      return result;
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

      queueWeaponOverheat({
        user,
        baseDamage,
        recoilPercent: this.recoilPercent,
        context,
      });

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

      if (!hitResult?.evaded && !hitResult?.immune) {
        enemy.applyStatusEffect("burning", this.burnDuration, context);
      }

      return result;
    },
  },
];

export default irinaSkills;
