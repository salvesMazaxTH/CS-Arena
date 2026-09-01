import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import weightOfTheBolt from "./passive.js";

const julianSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // H1 — Serpentbite Bolt
  // ========================
  {
    key: "serpentbite_bolt",
    name: "Serpentbite Bolt",

    maxHPPercent: 8,
    poisonedStacks: 1,

    contact: false,
    damageMode: "piercing",
    piercingPercentage: 100,
    hitVfx: "poisoned_arrow",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Julian rolls a bolt-head across a vial of his own making, unhurried, and admires the sheen on it before firing into the chosen target. Deals Piercing damage equal to ${this.maxHPPercent}% of their Max HP and leaves ${this.poisonedStacks} stack of Poisoned.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const percent = this.maxHPPercent + weightOfTheBolt.onHitMaxHPPercent;
      const baseDamage = enemy.maxHP * (percent / 100);

      const result = new DamageEvent({
        baseDamage,
        piercingPercentage: this.piercingPercentage,
        mode: "piercing",
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hit = Array.isArray(result) ? result[0] : result;

      if (effectConnected(hit, "poisoned")) {
        enemy.applyStatusEffect(
          "poisoned",
          undefined,
          context,
          { sourceId: user.id, sourceName: user.name },
          this.poisonedStacks,
        );
      }

      return result;
    },
  },

  // ========================
  // H2 — Breaching Bolt
  // ========================
  {
    key: "breaching_bolt",
    name: "Breaching Bolt",

    maxHPPercent: 11,
    perStackPercent: 2,
    countedStackCap: 8,
    scoreStackThreshold: 4,
    scorePoints: 1,

    contact: false,
    damageMode: "piercing",
    piercingPercentage: 100,
    hitVfx: "poisoned_arrow",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Julian shoulders the heavy crossbow he keeps for gates and for anything that calls itself unbreakable, and puts a quarrel through the chosen target. Deals Piercing damage equal to ${this.maxHPPercent}% of their Max HP, plus ${this.perStackPercent}% for every stack of Poisoned they carry. If they carry ${this.scoreStackThreshold} or more, Julian collects on the mark and his player scores ${this.scorePoints} point.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const poison = enemy.getStatusEffect("poisoned");
      const stacks = Math.max(0, Number(poison?.stacks) || 0);
      const countedStacks = Math.min(stacks, this.countedStackCap);

      const percent =
        this.maxHPPercent +
        weightOfTheBolt.onHitMaxHPPercent +
        countedStacks * this.perStackPercent;
      const baseDamage = enemy.maxHP * (percent / 100);

      const result = new DamageEvent({
        baseDamage,
        piercingPercentage: this.piercingPercentage,
        mode: "piercing",
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (stacks >= this.scoreStackThreshold) {
        context.registerScore({
          amount: this.scorePoints,
          scoringSlot: user.team - 1,
          reason: this.key,
          sourceId: user.id,
        });

        context.registerDialog?.({
          message: `${formatChampionName(user)} collects on a well-poisoned mark — +${this.scorePoints} point.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return result;
    },
  },

  // ========================
  // Ultimate — Nonpareil
  // ========================
  {
    key: "nonpareil",
    name: "Nonpareil",

    isUltimate: true,
    momentumCost: 55,

    bf: 135,
    maxHPPercent: 15,
    poisonedMultiplier: 2,

    contact: false,
    damageMode: "standard",
    type: "physical",
    hitVfx: "poisoned_arrow",
    priority: 0,

    hits: [
      { id: "impact", label: "Impact" },
      {
        id: "punch_through",
        label: "Punch-Through",
        damageMode: "piercing",
        piercingPercentage: 100,
      },
    ],

    targetSpec: ["enemy"],

    description() {
      return `Julian takes his time, because the room is watching, and draws the siege lock all the way back for the one shot he holds worthy of his name. Deals physical damage to the chosen target, then Piercing damage equal to ${this.maxHPPercent}% of their Max HP — doubled if they are Poisoned.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      // Read before the hits land: the doubling rewards poison already on the
      // target, not the stack Weight of the Bolt leaves this cast.
      const wasPoisoned = enemy.hasStatusEffect("poisoned");

      const impact = SkillHits.run(this, "impact", {
        user,
        target: enemy,
        context,
      });
      results.push(...(Array.isArray(impact) ? impact : [impact]));

      const pierceDamage = Math.floor(
        enemy.maxHP *
          (this.maxHPPercent / 100) *
          (wasPoisoned ? this.poisonedMultiplier : 1),
      );

      const punchThrough = SkillHits.run(this, "punch_through", {
        user,
        target: enemy,
        baseDamage: pierceDamage,
        context,
      });
      results.push(
        ...(Array.isArray(punchThrough) ? punchThrough : [punchThrough]),
      );

      return results;
    },
  },
];

export default julianSkills;
