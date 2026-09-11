import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const tonyRaiturusSkills = [
  totalBlock,

  {
    key: "the_eye_he_kept",
    name: "The Eye He Kept",

    bf: 105,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfxPalette: "lightning",
    splitsIntoThunder: false,
    priority: 0,

    description() {
      return `Tony sights down the green eye, the one that is still only a boy's, and lets the bolt go on the second he chose. Deals Lightning magical damage in full, right away — it does not split into thunder, so it carries no bonus damage and can be evaded like any other strike.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
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
    key: "the_dragons_eye",
    name: "The Dragon's Eye",

    bf: 70,
    recoilPercentOfMaxHp: 12,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfxPalette: "lightning",
    doublesThunder: true,
    priority: 0,

    description() {
      return `Tony lets the gold eye open all the way, and for a moment the shape he is holding is far too small for what is looking out of it. Deals Lightning magical damage and doubles the thunder left hanging over the target, at the cost of ${this.recoilPercentOfMaxHp}% of his own Max HP as Absolute Damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      context.extraDamageQueue ??= [];
      context.extraDamageQueue.push({
        baseDamage: (user.maxHP * this.recoilPercentOfMaxHp) / 100,
        mode: "absolute",
        attacker: user,
        defender: user,
        type: "magical",
        skill: this,
      });

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
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
    key: "the_shape_he_outgrew",
    name: "The Shape He Outgrew",

    bf: 120,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfxPalette: "lightning",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    transformInto: "tony_raiturus_primordial",
    transformDuration: 2,

    description() {
      return `The boy's shape was never the redemption, only the terms of it, and Tony stops honouring them. Deals Lightning magical damage, then he unfolds into the storm he was sentenced to be, his <b>Primordial Form</b>, for ${this.transformDuration} turn(s), replacing his skills, his passive and his stats.`;
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
        log: `${formatChampionName(user)} stops holding the boy's shape and rises as his <b>Primordial Form</b> for ${this.transformDuration} turn(s)!`,
      });

      return results;
    },
  },
];

export default tonyRaiturusSkills;
