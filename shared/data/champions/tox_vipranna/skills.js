import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const toxViprannaSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // Special Skills
  // ========================

  // ========================
  // H1 — Venomous Tongue
  // ========================
  {
    key: "venomous_tongue",
    name: "Venomous Tongue",

    bf: 30,
    contact: true,
    damageMode: "standard",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return `Tox Vipranna lashes out with her venomous tongue, dealing light damage to the chosen enemy and inflicting Poisoned.

      • 4 stacks if the target is not Poisoned
      • 2 stacks if the target is already Poisoned`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const damageArray = Array.isArray(damageResult)
        ? damageResult
        : [damageResult];

      results.push(...damageArray);

      const mainDamage = damageArray[0];

      if (
        !mainDamage?.evaded &&
        !mainDamage?.immune &&
        mainDamage?.totalDamage > 0
      ) {
        const alreadyPoisoned = enemy.hasStatusEffect("poisoned");
        const stacks = alreadyPoisoned ? 2 : 4;

        enemy.applyStatusEffect(
          "poisoned",
          undefined,
          context,
          {},
          stacks,
        );
      }

      return results;
    },
  },

  // ========================
  // H2 — Toxic Coating
  // ========================
  {
    key: "toxic_coating",
    name: "Toxic Coating",

    contact: false,
    priority: 3,

    auraDuration: 2,
    poisonedStacks: 2,
    defenseBuff: 35,

    targetSpec: ["self"],

    description() {
      return `Tox Vipranna cloaks herself in a toxic coating for ${this.auraDuration} turn(s), gaining +${this.defenseBuff} Defense.

      Enemies that make contact attacks against her are afflicted with ${this.poisonedStacks} stacks of Poisoned.`;
    },

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBuff,
        duration: this.auraDuration,
        context,
        statModifierSrc: user,
      });

      const activatedTurn = context.currentTurn;

      user.runtime.hookEffects ??= [];

      // --- Enemies that attack by contact are afflicted with Poisoned ---
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "toxic_coating_retaliation",
      );

      user.runtime.hookEffects.push({
        key: "toxic_coating_retaliation",
        expiresAtTurn: activatedTurn + this.auraDuration,
        poisonedStacks: this.poisonedStacks,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        onBeforeDmgTaking({ owner, attacker, skill, context }) {
          if (!skill?.contact) return;
          if (!attacker) return;

          attacker.applyStatusEffect(
            "poisoned",
            undefined,
            context,
            {},
            this.poisonedStacks,
          );

          return {
            log: `<b>[${this.name}]</b> ${formatChampionName(
              attacker,
            )} is afflicted with ${this.poisonedStacks} stacks of <b>Poisoned</b> after attacking ${formatChampionName(
              owner,
            )}.`,
          };
        },
      });

      context.registerDialog?.({
        message: `${formatChampionName(
          user,
        )} activates <b>Toxic Coating</b>!`,
        sourceId: user.id,
      });

      return {
        log: `${formatChampionName(
          user,
        )} activates <b>Toxic Coating</b>!`,
      };
    },
  },

  // ========================
  // Ultimate — Venomous Queen's Decree
  // ========================
  {
    key: "venomous_queen_decree",
    name: "Venomous Queen's Decree",

    contact: false,
    isUltimate: true,
    momentumCost: 55,

    damageRatioPerStack: 0.125,

    priority: 1,

    targetSpec: ["enemy"],

    description() {
      return `Tox Vipranna forces the venom within the chosen enemy to surge, doubling their Poisoned stacks before consuming them.

      Deals Absolute Damage equal to:

      <b>Consumed stacks × ${this.damageRatioPerStack * 100}% of the target's lost HP</b>`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      if (!enemy?.hasStatusEffect("poisoned")) {
        const failMessage = "But it failed.";

        context.registerDialog?.({
          message: failMessage,
          sourceId: user.id,
          targetId: enemy?.id ?? user.id,
        });

        return {
          log: failMessage,
        };
      }

      const poisonInstance = enemy.getStatusEffect("poisoned");
      const stacks = Number(poisonInstance.stacks) || 0;

      if (poisonInstance) {
        const doubledStacks = Math.max(1, stacks * 2);

        poisonInstance.stacks = doubledStacks;
        poisonInstance.stackCount = doubledStacks;
        poisonInstance.metadata = {
          ...(poisonInstance.metadata || {}),
          stacks: doubledStacks,
          stackCount: doubledStacks,
        };

        enemy.removeStatusEffect("poisoned");
      }

      const lostHP = Math.max(0, enemy.maxHP - enemy.HP);

      const baseDamage =
        Math.max(1, Number(poisonInstance.stacks) || 1) *
        this.damageRatioPerStack *
        lostHP;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
        mode: DamageEvent.Modes.ABSOLUTE,
      }).execute();

      return result;
    },
  },
];

export default toxViprannaSkills;