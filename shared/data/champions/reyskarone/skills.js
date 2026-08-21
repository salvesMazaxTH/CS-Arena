import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const reyskaroneSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,
  // =========================
  // Special Abilities

  // =========================
  // H1 — Blood Tithe
  // =========================
  {
    key: "blood_tithe",
    name: "Blood Tithe",
    bf: 45,
    damageMode: "standard",
    hpSacrificePercent: 15,
    titheDuration: 2,
    titheHeal: 15,
    titheBonusDamage: 10,
    contact: false,

    priority: 1,
    description() {
      return `Reyskarone spills ${this.hpSacrificePercent}% of his own Max HP to brand the chosen target with the Tithe for ${this.titheDuration} turn(s), then strikes them for magical damage.

      While the brand holds, every ally who strikes the marked target restores ${this.titheHeal} HP and deals +${this.titheBonusDamage} bonus damage. The brand cannot take hold through Absolute Immunity, Supreme Shield or Spell Shield — it burns one of those shields away instead.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const hpSacrifice = user.maxHP * (this.hpSacrificePercent / 100);

      user.takeDamage(hpSacrifice);

      enemy.runtime.hookEffects ??= [];
      const shields = Array.isArray(enemy.runtime?.shields)
        ? enemy.runtime.shields
        : [];

      const hasAbsoluteImmunity = enemy.hasStatusEffect?.("absoluteImmunity");
      const supremeShieldIdx = shields.findIndex(
        (shield) => shield?.type === "supreme" && shield?.amount > 0,
      );
      const spellShieldIdx = shields.findIndex(
        (shield) => shield?.type === "spell" && shield?.amount > 0,
      );

      const titheBlocked =
        hasAbsoluteImmunity || supremeShieldIdx !== -1 || spellShieldIdx !== -1;

      if (!titheBlocked) {
        // =========================
        // TEMPORARY HOOK: TITHE
        // =========================
        enemy.runtime.hookEffects.push({
          key: "tithe",
          group: "skill",

          expiresAtTurn: context.currentTurn + this.titheDuration,

          hookScope: {
            onAfterDmgDealing: "defender",
          },

          onBeforeDmgDealing: ({ defender, damage }) => {
            if (defender !== enemy) return;

            return {
              damage: damage + this.titheBonusDamage,
            };
          },

          onAfterDmgDealing: ({ attacker, defender, owner, context }) => {
            if (defender !== enemy) return;

            // The attacker drinks from the brand.
            attacker.heal(this.titheHeal, context, owner);
          },
        });

        context.registerDialog({
          message: `${formatChampionName(enemy)} is branded with the <b>Tithe</b>!`,
          sourceId: user.id,
          targetId: enemy.id,
          duration: 1000,
        });
      } else {
        if (supremeShieldIdx !== -1) {
          shields.splice(supremeShieldIdx, 1);
        } else if (spellShieldIdx !== -1) {
          shields.splice(spellShieldIdx, 1);
        }
      }

      // Immediate follow-up attack.
      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (!titheBlocked && result?.log) {
        result.log += `\n${formatChampionName(enemy)} is branded with the Tithe.`;
      }

      return result;
    },
  },

  // =========================
  // H2 — Martial Transfusion
  // =========================
  {
    key: "martial_transfusion",
    name: "Martial Transfusion",
    atkBuff: 20,
    lifeStealBuff: 15,
    buffDuration: 2,
    contact: false,

    priority: 4,
    description() {
      return `Reyskarone pours his own blood into the chosen ally, granting them +${this.atkBuff} Attack and +${this.lifeStealBuff}% LifeSteal for ${this.buffDuration} turn(s).`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return {
        log:
          user === ally
            ? `${formatChampionName(user)} strengthens himself with Martial Transfusion.`
            : `${formatChampionName(user)} strengthens ${formatChampionName(ally)} with Martial Transfusion.`,
      };
    },
  },

  // =========================
  // ULT — Crimson Pact
  // =========================
  {
    key: "crimson_pact",
    name: "Crimson Pact",
    atkBuffPercent: 18,
    lifeStealBuff: 30,
    buffDuration: 2,
    contact: false,
    isUltimate: true,
    momentumCost: 55,

    priority: 5,
    description() {
      return `Reyskarone seals a pact in blood with the chosen ally: for ${this.buffDuration} turn(s), they gain +${this.atkBuffPercent}% Attack and +${this.lifeStealBuff}% LifeSteal.`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuffPercent,
        duration: this.buffDuration,
        context,
        isPercent: true,
        statModifierSrc: user,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return {
        log: `${formatChampionName(user)} seals a Crimson Pact with ${formatChampionName(ally)}.`,
      };
    },
  },
];

export default reyskaroneSkills;
