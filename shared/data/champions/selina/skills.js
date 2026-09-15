import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import totalBlock from "../generic/totalBlock.js";
import { SELINA_WARD } from "./passive.js";

const selinaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "light_that_shelters",
    name: "Light That Shelters",

    healAmount: 30,
    shieldAmount: 50,
    shieldDecay: 17,

    contact: false,
    priority: 2,

    description() {
      return `Selina cups a soft light in her hands and lets it settle over the chosen ally, mending what it touches and refusing to let anything cruel linger. Restores ${this.healAmount} HP, grants ${this.shieldAmount} Shield that decays by ${this.shieldDecay} per turn, and cleanses one negative status effect.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;

      const healed = new HealEvent({
        target: ally,
        amount: this.healAmount,
        context,
        source: user,
        allChampions: context?.allChampions,
      }).execute();

      ally.addShield(this.shieldAmount, this.shieldDecay, context, "regular", {
        source: SELINA_WARD,
      });

      const [cleansed] = ally.getStatusEffects({ type: "debuff" });
      if (cleansed) ally.removeStatusEffect(cleansed.key);

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} wraps ${
          userName === allyName ? "herself" : allyName
        } in Light That Shelters: ${healed} HP restored and ${this.shieldAmount} Shield raised${cleansed ? `, ${cleansed.name} cleansed` : ""}.`,
      };
    },
  },

  {
    key: "blinding_radiance",
    name: "Blinding Radiance",

    bf: 55,
    blindDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 1,

    hits: [
      { id: "flare", type: "magical", hitVfx: "radiant_bolt" },
      {
        id: "cut",
        label: "Blade",
        bf: 35,
        type: "physical",
        contact: true,
        hitVfx: "slash",
      },
    ],

    description() {
      return `Selina opens her palm and lets her light flare past anything merciful about it, searing across the chosen enemy's eyes, and the sword she has been dragging all this time finally comes up to finish the motion. Deals magical damage equal to ${this.bf}% of her Attack and physical damage equal to ${SkillHits.spec(this, "cut").bf}% of her Attack, leaving them Blinded for ${this.blindDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (const hitId of ["flare", "cut"]) {
        const result = SkillHits.run(this, hitId, {
          user,
          target: enemy,
          context,
        });
        results.push(...(Array.isArray(result) ? result : [result]));
      }

      if (effectConnected(results[0], "blind")) {
        enemy.applyStatusEffect("blind", this.blindDuration, context, {
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "cataclysm_of_dawn",
    name: "Cataclysm of Dawn",

    bf: 100,
    allyShieldAmount: 60,
    allyShieldDecay: 20,
    allyDamageReductionPercent: 20,
    allyReductionDuration: 2,

    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    hitVfx: "radiant_bolt",
    priority: 0,

    description() {
      return `Every ounce of restraint Selina has learned to carry gives out at once, and the light she has spent the whole match holding back breaks loose across the entire field. Deals magical damage to all enemies, while every ally caught in the same flare gains ${this.allyShieldAmount} Shield that decays by ${this.allyShieldDecay} per turn and takes ${this.allyDamageReductionPercent}% less damage for ${this.allyReductionDuration} turn(s).`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);

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

      for (const ally of allies) {
        ally.addShield(
          this.allyShieldAmount,
          this.allyShieldDecay,
          context,
          "regular",
          { source: SELINA_WARD },
        );

        ally.applyDamageReduction({
          amount: this.allyDamageReductionPercent,
          duration: this.allyReductionDuration,
          type: "percent",
          source: this.key,
          context,
        });
      }

      results.push({
        log: `${formatChampionName(user)} unleashes <b>Cataclysm of Dawn</b> — the enemy line is seared with light while every ally is shielded from the same blast.`,
      });

      return results;
    },
  },
];

export default selinaSkills;
