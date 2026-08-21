import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import basicShot from "../basicShot.js";

const vulnaraSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "physical" },

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Predatory Instincts
  // ========================
  {
    key: "predatory_instincts",
    name: "Predatory Instincts",

    critBuff: 30,
    duration: 3,

    contact: false,
    priority: 0,

    description() {
      return `Vulnara goes still and lets the hunter take over, her eye settling on every opening at once: she gains +${this.critBuff}% Critical for ${this.duration} turn(s).`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Critical",
        amount: this.critBuff,
        duration: this.duration,
        context,
      });

      return {
        log: `${formatChampionName(user)} sharpens her instincts, gaining +${this.critBuff}% Critical for ${this.duration} turn(s)!`,
      };
    },
  },

  // ========================
  // H2 — Rain of Burning Arrows
  // ========================
  {
    key: "rain_of_burning_arrows",
    name: "Rain of Burning Arrows",

    bf: 40,
    burnChance: 0.15,
    burnDuration: 2,

    damageMode: "standard",
    contact: false,
    priority: 0,
    element: "fire",

    description() {
      return `Vulnara looses a rain of burning arrows over the whole field, dealing Fire physical damage to every enemy. Each arrow that lands has a ${this.burnChance * 100}% chance of setting its target Burning for ${this.burnDuration} turn(s).`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      // Get all enemies
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      // Deal damage to each enemy
      for (const enemy of enemies) {
        const rawDamageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const damageResults = Array.isArray(rawDamageResult)
          ? rawDamageResult
          : [rawDamageResult];

        const mainDamage = damageResults[0];

        // Apply Burning if the hit connects and the roll succeeds.
        if (
          !mainDamage?.evaded &&
          !mainDamage?.immune &&
          Math.random() < this.burnChance
        ) {
          enemy.applyStatusEffect("burning", this.burnDuration, context);
        }

        results.push(...damageResults);
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Hail of Fire Arrows
  // ========================
  {
    key: "hail_of_fire_arrows",
    name: "Hail of Fire Arrows",

    element: "fire",
    bf: 45,

    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    arrows: 3,

    description() {
      return `Vulnara draws and looses ${this.arrows} arrows before the first one lands, all of them burning, all of them on the chosen target. Each arrow rolls for a critical hit on its own.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (let i = 0; i < this.arrows; i++) {
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

        const hitResults = Array.isArray(result) ? result : [result];
        results.push(...hitResults);
      }

      return results;
    },
  },
];

export default vulnaraSkills;