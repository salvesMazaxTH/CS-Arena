import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { WANTED_RUNTIME_FLAG } from "./passive.js";

const harlanGreevesSkills = [
  totalBlock,

  {
    key: "steady_aim",
    name: "Steady Aim",

    bf: 75,

    contact: false,
    damageMode: "standard",
    hitVfx: "musket_ball",
    priority: 0,

    description() {
      return `No flourish, no drama — Harlan just puts the shot where he already decided it goes. Deals physical damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const cannotBeEvaded = Number(enemy.Speed) < Number(user.Speed);

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        cannotBeEvaded,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "hobble_shot",
    name: "Hobble Shot",

    bf: 55,
    speedDebuff: 20,
    debuffDuration: 2,

    contact: false,
    damageMode: "standard",
    hitVfx: "musket_ball",
    priority: 0,

    description() {
      return `Harlan doesn't aim to kill this one — just to make sure it can't outrun what's coming next. Deals physical damage, reducing the target's Speed by ${this.speedDebuff} for ${this.debuffDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const cannotBeEvaded = Number(enemy.Speed) < Number(user.Speed);

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        cannotBeEvaded,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (arr[0]?.landed) {
        enemy.debuffStat({
          statName: "Speed",
          amount: -this.speedDebuff,
          duration: this.debuffDuration,
          context,
          statModifierSrc: user,
        });
      }

      return arr;
    },
  },

  {
    key: "wanted_dead_or_alive",
    name: "Wanted, Dead or Alive",

    bf: 140,

    contact: false,
    damageMode: "standard",
    hitVfx: "musket_ball",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Harlan slaps a name on the fight and means to collect either way. Deals physical damage and puts the target Wanted — for as long as they're still standing, his CLAIM cashes in on it.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const cannotBeEvaded = Number(enemy.Speed) < Number(user.Speed);

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        cannotBeEvaded,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const previousTargetId = user.runtime?.harlanWantedTargetId;
      if (previousTargetId && previousTargetId !== enemy.id) {
        const previousTarget = context.aliveChampions?.find(
          (c) => c.id === previousTargetId,
        );
        if (previousTarget) delete previousTarget.runtime[WANTED_RUNTIME_FLAG];
      }

      user.runtime ??= {};
      user.runtime.harlanWantedTargetId = enemy.id;
      enemy.runtime[WANTED_RUNTIME_FLAG] = true;

      context.registerDialog({
        message: `${formatChampionName(user)} pins the name to the board — dead or alive, this one's getting collected.`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      return result;
    },
  },
];

export default harlanGreevesSkills;
