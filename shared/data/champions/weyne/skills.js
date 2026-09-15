import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { hitChance, stillnessBonus } from "./passive.js";

const weyneSkills = [
  {
    ...basicShot,

    bf: 50,
    bonusDamage: 25,

    element: "ice",
    hitVfx: "cryo_round",
    contact: false,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Weyne rides the crosshair down onto the chosen target and lets the cryogenic round go, and the barrel sheds a skin of frost as it leaves. The only shot in her kit that can miss, and the only one worth the risk. Deals physical damage, plus ${this.bonusDamage} bonus damage.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const zeroed = user.runtime?.weyneZeroed;
      if (zeroed) user.runtime.weyneZeroed = false;

      if (!zeroed && Math.random() * 100 >= hitChance(user)) {
        const failMessage = `${formatChampionName(user)} breaks her breath a fraction early and the round goes wide of ${formatChampionName(enemy)}.`;

        context.registerDialog?.({
          message: failMessage,
          sourceId: user.id,
          targetId: enemy.id,
        });

        return { log: failMessage };
      }

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: this.bonusDamage + stillnessBonus(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: zeroed ? { force: true } : undefined,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "cold_zero",
    name: "Cold Zero",

    priority: 2,
    targetSpec: ["self"],

    description() {
      return `Weyne stops being a person for a turn and becomes a measurement: windage, drop, the cold in her own hands. She does nothing else, and her next Basic Shot cannot miss and is always a critical hit.`;
    },

    resolve({ user, context = {} }) {
      user.runtime ??= {};
      user.runtime.weyneZeroed = true;

      const message = `${formatChampionName(user)} takes her <b>Cold Zero</b> — the next round is already on its way.`;

      context.registerDialog?.({
        message,
        sourceId: user.id,
        targetId: user.id,
      });

      return { log: message };
    },
  },

  {
    key: "suppression_round",
    name: "Suppression Round",

    bf: 35,
    snareDuration: 1,
    chillDuration: 2,

    element: "ice",
    hitVfx: "cryo_round",
    contact: false,
    cannotBeEvaded: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `She does not aim at the chosen target so much as at the ground they were about to stand on, and the frozen core of the barrel puts a wall of cold there instead. The round never misses. Deals physical damage, applies Snared for ${this.snareDuration} turn(s) and Chilled for ${this.chillDuration} turn(s).`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: stillnessBonus(user),
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

      if (effectConnected(result, "chilled")) {
        enemy.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },

  {
    key: "terminal_ballistics",
    name: "Terminal Ballistics",

    bf: 80,
    piercingPercentage: 95,
    chillDuration: 2,

    element: "ice",
    hitVfx: "cryo_round_big",
    contact: false,
    cannotBeEvaded: true,
    damageMode: "piercing",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Weyne has been holding this one since before the chosen target walked into the street, and the whole winter is in the barrel when she finally lets it go. The round cannot be evaded and ignores ${this.piercingPercentage}% of their Defense. Deals physical damage and leaves them Chilled for ${this.chillDuration} turn(s).`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: stillnessBonus(user),
        mode: "piercing",
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "chilled")) {
        enemy.applyStatusEffect("chilled", this.chillDuration, context);
      }

      return result;
    },
  },
];

export default weyneSkills;
