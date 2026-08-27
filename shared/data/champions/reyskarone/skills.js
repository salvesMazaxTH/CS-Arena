import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

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
      return `Reyskarone spills ${this.hpSacrificePercent}% of his own Max HP — never falling below 1 HP — to brand the chosen target with the Tithe for ${this.titheDuration} turn(s), then strikes them for magical damage.

      While the brand holds, every ally who strikes the marked target restores ${this.titheHeal} HP and deals +${this.titheBonusDamage} bonus damage. The brand cannot take hold through Absolute Immunity, Supreme Shield or Spell Shield — it burns one of those shields away instead.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      // The cost is a self-imposed drain rather than damage: it ignores
      // shields and never brings Reyskarone below 1 HP. With no blood left to
      // spill there is nothing to pay the brand with, so the skill fails.
      const hpSacrifice = Math.min(
        Math.floor(user.maxHP * (this.hpSacrificePercent / 100)),
        user.HP - 1,
      );

      if (hpSacrifice <= 0) {
        context.registerDialog({
          message: `But it failed.`,
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: `${formatChampionName(user)} had no blood left to spill. <b>Blood Tithe</b> failed.`,
        };
      }

      // The drain never goes through a DamageEvent, so it registers its own
      // visual event and dialog, or the HP loss lands on the client
      // unannounced. Paying it first also makes it the anchor every later
      // dialog of this skill attaches to, keeping them in narrative order.
      user.modifyHP(-hpSacrifice, { context });

      context.registerDamage({
        target: user,
        amount: hpSacrifice,
        rawAmount: hpSacrifice,
        sourceId: user.id,
      });

      context.registerDialog({
        message: `${formatChampionName(user)} spills his own blood for the <b>Tithe</b>!`,
        sourceId: user.id,
        targetId: user.id,
        duration: 1000,
      });

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
        // Recasting refreshes the brand rather than stacking a second one.
        enemy.runtime.hookEffects = enemy.runtime.hookEffects.filter(
          (effect) => effect.key !== "tithe",
        );

        enemy.runtime.hookEffects.push({
          key: "tithe",
          group: "skill",

          expiresAtTurn: context.currentTurn + this.titheDuration,

          // The brand rides on the branded champion, so both hooks are the
          // taking side of the exchange and the scope alone already keeps them
          // from firing on anyone else's damage.
          hookScope: {
            onBeforeDmgTaking: "defender",
            onAfterDmgTaking: "defender",
          },

          onBeforeDmgTaking: ({ attacker, damage }) => {
            if (attacker.team !== user.team) return;

            return {
              damage: damage + this.titheBonusDamage,
            };
          },

          onAfterDmgTaking: ({ attacker, owner, context }) => {
            if (attacker.team !== user.team) return;

            // The brand is Reyskarone's, so the healing is credited to him.
            new HealEvent({
              target: attacker,
              amount: this.titheHeal,
              context,
              source: user,
            }).execute();
          },
        });

        context.registerDialog({
          message: `${formatChampionName(enemy)} is branded with the <b>Tithe</b>!`,
          sourceId: user.id,
          targetId: enemy.id,
          duration: 1000,
        });
      } else {
        const burnedShieldIdx =
          supremeShieldIdx !== -1 ? supremeShieldIdx : spellShieldIdx;
        const burnedShieldName =
          supremeShieldIdx !== -1 ? "Supreme Shield" : "Spell Shield";

        if (burnedShieldIdx !== -1) shields.splice(burnedShieldIdx, 1);

        context.registerDialog({
          message:
            burnedShieldIdx !== -1
              ? `The <b>Tithe</b> burns away ${formatChampionName(enemy)}'s ${burnedShieldName} instead!`
              : `${formatChampionName(enemy)} is immune to the <b>Tithe</b>!`,
          sourceId: user.id,
          targetId: enemy.id,
          duration: 1000,
        });
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
        log:
          user === ally
            ? `${formatChampionName(user)} seals a Crimson Pact in his own blood.`
            : `${formatChampionName(user)} seals a Crimson Pact with ${formatChampionName(ally)}.`,
      };
    },
  },
];

export default reyskaroneSkills;
