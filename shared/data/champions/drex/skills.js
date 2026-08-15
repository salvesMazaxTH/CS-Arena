import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../basicStrike.js";

const drexSkills = [
  basicStrike,

  {
    key: "crimson_incision",
    name: "Crimson Incision",

    bf: 35,
    contact: true,
    damageMode: "standard",

    bleedingStacks: 2,

    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Deals light to moderate damage to the chosen target and applies ${this.bleedingStacks} Bleeding stacks. If the target is already Bleeding, applies 1 additional stack.`;
    },

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

      const results = Array.isArray(result) ? result : [result];
      const mainDamage = results[0];

      if (
        !mainDamage?.evaded &&
        !mainDamage?.immune &&
        (mainDamage?.totalDamage ?? 0) > 0
      ) {
        const bleedStacks = enemy.hasStatusEffect("bleeding")
          ? this.bleedingStacks + 1
          : this.bleedingStacks;

        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          bleedStacks,
        );
      }

      return results;
    },
  },

  {
    key: "bloodletting",
    name: "Bloodletting",

    bf: 40,
    bleedingStacksApplied: 2,
    bonusBleedStacksIfBleeding: 1,

    contact: false,
    damageMode: "standard",
    priority: 1,
    targetSpec: ["all:enemy"],

    description() {
      return `Deals damage to all enemies and applies ${this.bleedingStacksApplied} Bleeding stacks to each. If an enemy is already Bleeding, applies ${this.bonusBleedStacksIfBleeding} additional stack. Each existing Bleeding stack also triggers an immediate instance of Bleeding damage without consuming the status.`;
    },

    resolve({ user, targets, context = {} }) {
      const results = [];

      for (const enemy of targets) {
        if (!enemy?.alive) continue;

        const existingStacks =
          Number(enemy.getStatusEffect("bleeding")?.stacks) || 0;

        const tickDamage = Math.floor(enemy.maxHP * 0.05);

        // Existing Bleeding stacks trigger immediate damage.
        for (let index = 0; index < existingStacks; index += 1) {
          const tickResult = new DamageEvent({
            baseDamage: tickDamage,
            attacker: user,
            defender: enemy,
            skill: {
              name: "Bleeding",
              key: "bleeding_tick",
            },
            type: "physical",
            mode: DamageEvent.Modes.ABSOLUTE,
            context: {
              ...context,
              isDot: true,
              allowsLifeSteal: true,
            },
            allChampions: context?.allChampions,
          }).execute();

          if (Array.isArray(tickResult)) {
            results.push(...tickResult);
          } else if (tickResult) {
            results.push(tickResult);
          }
        }

        const stacksToApply =
          this.bleedingStacksApplied +
          (existingStacks > 0 ? this.bonusBleedStacksIfBleeding : 0);

        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          stacksToApply,
        );
      }

      return results;
    },
  },

  {
    key: "hemorrhagic_eclipse",
    name: "Hemorrhagic Eclipse",

    bf: 75,
    damagePerBleedStack: 18,

    minimumBleedStacks: 4,
    shieldFromTargetMaxHpRatio: 0.35,
    shieldDecayTurns: 3,

    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Deals moderate-high damage to the chosen target. Deals +${this.damagePerBleedStack}% bonus damage for each Bleeding stack on the target. If the target has fewer than ${this.minimumBleedStacks} Bleeding stacks, applies enough stacks to reach ${this.minimumBleedStacks}. If this ability hits a target with ${this.minimumBleedStacks}+ Bleeding stacks, Drex gains a shield equal to 35% of the target's Max HP for ${this.shieldDecayTurns} turns.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      let bleedStacks = Number(enemy.getStatusEffect("bleeding")?.stacks) || 0;

      // The Ultimate guarantees its own Bleeding threshold.
      if (bleedStacks < this.minimumBleedStacks) {
        const stacksToApply = this.minimumBleedStacks - bleedStacks;

        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          stacksToApply,
        );

        bleedStacks = this.minimumBleedStacks;
      }

      const damageMultiplier =
        1 + (bleedStacks * this.damagePerBleedStack) / 100;

      const baseDamage = ((user.Attack * this.bf) / 100) * damageMultiplier;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainDamage = results[0];

      const dealtDamage = Number(mainDamage?.totalDamage ?? 0) > 0;

      const connected =
        !mainDamage?.evaded && !mainDamage?.immune && dealtDamage;

      if (connected && bleedStacks >= this.minimumBleedStacks) {
        const shieldAmount = Math.floor(
          Number(enemy?.maxHP || 0) * this.shieldFromTargetMaxHpRatio,
        );

        if (shieldAmount > 0) {
          user.addShield(shieldAmount, 0, context, "regular", {
            expiresAtTurn: context.currentTurn + this.shieldDecayTurns,
            sourceKey: this.key,
            visualVariant: "drex_blood",
          });

          results.push({
            log: `${formatChampionName(user)} converts the target's Bleeding into protection and gains a ${shieldAmount} HP shield.`,
          });
        }
      }

      return results;
    },
  },
];

export default drexSkills;
