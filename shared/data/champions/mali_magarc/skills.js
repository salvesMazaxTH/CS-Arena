import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";

const maliMagarcSkills = [
  { ...basicShot, type: "magical", bonusFlat: 30 },

  {
    key: "unshaped_arc",
    name: "Unshaped Arc",

    bf: 80,
    damageMode: "piercing",
    piercingPercentage: 40,
    momentumSpend: 10,
    essenceBonus: 25,

    contact: false,
    hitVfx: "arcane_bolt",
    priority: 0,

    description() {
      return `Mali Magarc opens the star-charted hand and lets the hoarded essence go the way raw magic wants to, straight through the chosen target's guard — it ignores ${this.piercingPercentage}% of their Defense. When he can spend ${this.momentumSpend} Momentum the arc carries ${this.essenceBonus} bonus damage; when he cannot, it still lands without it. Deals magical damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {}, resolver }) {
      const [enemy] = targets;

      let paid = false;
      if (user.momentum >= this.momentumSpend) {
        const { applied } = resolver.applyResourceChange({
          target: user,
          amount: -this.momentumSpend,
          context,
          sourceId: user.id,
          debugLabel: "mali_unshaped_arc",
        });
        paid = Math.abs(applied) > 0;
      }

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: paid ? this.essenceBonus : 0,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "unwrite_the_spell",
    name: "Unwrite the Spell",

    bf: 70,
    momentumRefund: 8,

    contact: false,
    damageMode: "standard",
    hitVfx: "arcane_bolt",
    priority: 0,

    description() {
      return `Mali Magarc reads the borrowed magic wrapped around the chosen target, names it aloud, and lets it come apart. Unmakes one positive status effect on them, and if one falls its essence returns to him as ${this.momentumRefund} Momentum. Deals magical damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {}, resolver }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];
      if (!results.some((r) => r?.landed)) return results;

      const [stripped] = enemy.getStatusEffects({ type: "buff" });
      if (!stripped) return results;

      enemy.removeStatusEffect(stripped.key);

      resolver.applyResourceChange({
        target: user,
        amount: this.momentumRefund,
        context,
        sourceId: user.id,
        debugLabel: "mali_unwrite_the_spell",
      });

      context.registerDialog?.({
        message: `${formatChampionName(user)} unwrites ${stripped.name ?? stripped.key} from ${formatChampionName(enemy)}.`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      results.push({
        log: `${formatChampionName(user)} unmakes a positive effect on ${formatChampionName(enemy)} and takes back ${this.momentumRefund} Momentum.`,
      });

      return results;
    },
  },

  {
    key: "unfold_the_first_magic",
    name: "Unfold the First Magic",

    bf: 110,

    contact: false,
    damageMode: "standard",
    hitVfx: "arcane_bolt_big",
    isUltimate: true,
    momentumCost: 50,
    priority: 0,

    transformInto: "mali_magarc_primordial",
    transformDuration: 2,

    description() {
      return `The shape Mali Magarc wears was always a courtesy to the arena, and he withdraws it. He strikes the chosen target once, then unfolds into the raw arcane he ruled before it had a name — his <b>Primordial Form</b> — for ${this.transformDuration} turn(s), replacing his skills, his passive and his stats. Deals magical damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];

      context.requestChampionMutation({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.transformDuration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      results.push({
        log: `${formatChampionName(user)} withdraws his worn shape and unfolds into his <b>Primordial Form</b> for ${this.transformDuration} turn(s)!`,
      });

      return results;
    },
  },
];

export default maliMagarcSkills;
