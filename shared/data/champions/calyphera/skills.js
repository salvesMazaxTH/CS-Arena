import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import { accrueLight, DAMAGE_PER_FACET } from "./passive.js";

const calypheraSkills = [
  basicStrike,

  {
    key: "offering_of_the_pane",
    name: "Offering of the Pane",

    bf: 85,
    shieldGranted: 80,
    shieldDecay: 30,
    recoilPercentOfMaxHp: 5,
    facetsGranted: 1,

    hitVfx: "slash",
    hitVfxPalette: "azure",
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `She opens the chosen target and lays a sheet of her own glass over the wound, the way the temple lays a pane over a saint. Deals physical damage and grants that target a ${this.shieldGranted} Shield that decays by ${this.shieldDecay} each turn — glass she has every intention of collecting back. The pane comes out of her own body, costing her ${this.recoilPercentOfMaxHp}% of her Max HP as Absolute Damage and cutting her ${this.facetsGranted} Facet.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const results = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(results) ? results : [results];

      context.extraDamageQueue ??= [];
      context.extraDamageQueue.push({
        baseDamage: (user.maxHP * this.recoilPercentOfMaxHp) / 100,
        mode: "absolute",
        attacker: user,
        defender: user,
        type: "physical",
        skill: this,
      });

      arr.push(...accrueLight(user, this.facetsGranted * DAMAGE_PER_FACET, context));

      if (!arr[0]?.landed || !enemy.alive) return arr;

      enemy.addShield(this.shieldGranted, this.shieldDecay, context, "regular", {
        source: "calyphera_glass",
      });

      arr.push({
        log: `${formatChampionName(user)} seals ${formatChampionName(
          enemy,
        )} behind ${this.shieldGranted} Shield of her own glass.`,
      });

      return arr;
    },
  },

  {
    key: "the_glass_comes_home",
    name: "The Glass Comes Home",

    bf: 100,
    shieldBroken: 150,
    brokenToDamagePercent: 50,
    maxBonusDamage: 45,

    hitVfx: "multislash",
    hitVfxPalette: "azure",
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Calyphera calls, and every pane she ever set into another body remembers whose it was. Breaks up to ${this.shieldBroken} Shield off the chosen target, then deals physical damage plus bonus damage equal to ${this.brokenToDamagePercent}% of the Shield broken (Max: ${this.maxBonusDamage}). Every point she breaks this way is written straight into her Facets.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const broken = enemy.breakShields(this.shieldBroken, {
        types: ["regular", "spell"],
      });

      const results = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: Math.min(
          (broken * this.brokenToDamagePercent) / 100,
          this.maxBonusDamage,
        ),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(results) ? results : [results];

      if (!broken) return arr;

      arr.push({
        log: `${formatChampionName(enemy)} loses ${broken} Shield as the glass answers Calyphera.`,
      });

      arr.push(...accrueLight(user, broken, context));

      return arr;
    },
  },

  {
    key: "the_body_made_window",
    name: "The Body Made Window",

    bf: 105,

    hitVfx: "multislash",
    hitVfxPalette: "azure",
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 0,
    targetSpec: ["all:enemy"],

    description() {
      return `Every Facet she has cut opens at once and the hall goes white, and for that moment Calyphera is not a woman of glass but the window itself. Deals physical damage to all enemies, strips every Shield they still hold and writes all of it into her Facets.`;
    },

    resolve({ user, targets, context = {} }) {
      const results = [];
      let harvested = 0;

      for (const enemy of targets) {
        if (!enemy?.alive) continue;

        harvested += enemy.breakShields(Infinity, {
          types: ["regular", "spell"],
        });

        const damage = new DamageEvent({
          baseDamage: (user.Attack * this.bf) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(...(Array.isArray(damage) ? damage : [damage]).filter(Boolean));
      }

      if (harvested) {
        results.push({
          log: `The light takes back ${harvested} Shield from the field.`,
        });

        results.push(...accrueLight(user, harvested, context));
      }

      return results;
    },
  },
];

export default calypheraSkills;
