import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import basicShot from "../generic/basicShot.js";

const selinaSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },

  // ========================
  // Special Abilities
  // ========================

  {
    key: "light_that_shelters",
    name: "Light That Shelters",

    healPercent: 45,

    contact: false,
    priority: 2,

    description() {
      return `Selina cups a soft light in her hands and lets it settle over the chosen ally, mending what it touches and refusing to let anything cruel linger. Restores HP equal to ${this.healPercent}% of her Attack and cleanses one negative status effect.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;

      const healAmount = (user.Attack * this.healPercent) / 100;
      const healed = new HealEvent({
        target: ally,
        amount: healAmount,
        context,
        source: user,
        allChampions: context?.allChampions,
      }).execute();

      const [cleansed] = ally.getStatusEffects({ type: "debuff" });
      if (cleansed) ally.removeStatusEffect(cleansed.key);

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} wraps ${
          userName === allyName ? "herself" : allyName
        } in Light That Shelters: ${healed} HP restored${cleansed ? `, ${cleansed.name} cleansed` : ""}.`,
      };
    },
  },

  {
    key: "blinding_radiance",
    name: "Blinding Radiance",

    bf: 80,
    blindDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 1,

    description() {
      return `Selina opens her palm and lets her light flare past anything merciful about it, searing across the chosen enemy's eyes. Deals magical damage equal to ${this.bf}% of her Attack and leaves them Blinded for ${this.blindDuration} turn(s).`;
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "blind")) {
        enemy.applyStatusEffect("blind", this.blindDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "cataclysm_of_dawn",
    name: "Cataclysm of Dawn",

    bf: 100,
    allyHealPercent: 30,
    allyDamageReductionPercent: 20,
    allyReductionDuration: 2,

    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 60,
    priority: 0,

    description() {
      return `Every ounce of restraint Selina has learned to carry gives out at once, and the light she has spent the whole match holding back breaks loose across the entire field. Deals magical damage to all enemies, while every ally caught in the same flare restores HP equal to ${this.allyHealPercent}% of her Attack and takes ${this.allyDamageReductionPercent}% less damage for ${this.allyReductionDuration} turn(s).`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const allies = (context.aliveChampions ?? []).filter(
        (c) => c.team === user.team && c.alive,
      );

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of enemies) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();
        results.push(...(Array.isArray(result) ? result : [result]));
      }

      const healAmount = (user.Attack * this.allyHealPercent) / 100;
      for (const ally of allies) {
        new HealEvent({
          target: ally,
          amount: healAmount,
          context,
          source: user,
          allChampions: context?.allChampions,
        }).execute();

        ally.applyDamageReduction({
          amount: this.allyDamageReductionPercent,
          duration: this.allyReductionDuration,
          type: "percent",
          source: this.key,
          context,
        });
      }

      results.push({
        log: `${formatChampionName(user)} unleashes <b>Cataclysm of Dawn</b> — the enemy line is seared with light while every ally is mended and shielded from the same blast.`,
      });

      return results;
    },
  },
];

export default selinaSkills;
