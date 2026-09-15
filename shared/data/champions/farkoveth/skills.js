import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import { spendDefense } from "./passive.js";

const farkovethSkills = [
  basicStrike,

  {
    key: "perched",
    name: "Perched",

    effectDuration: 2,
    nextSkillBonus: 30,

    contact: false,
    priority: 2,
    targetSpec: ["self"],

    description() {
      return `Four metres of hooded stone settle onto whatever will hold them and stop being a thing anyone thinks to look at. Farkoveth spends his action to become Invisible for ${this.effectDuration} turn(s), acting through it without breaking cover, and the next damaging skill he uses deals +${this.nextSkillBonus}% damage.`;
    },

    resolve({ user, context = {} }) {
      const bonus = this.nextSkillBonus;

      user.removeStatusEffect("invisible");
      user.applyStatusEffect("invisible", this.effectDuration, context, {
        source: this.key,
        breaksOnAction: false,
      });

      user.addHookEffect(
        {
          type: "buff",
          key: "perched_edge",
          group: "skill",
          expiresAtTurn: context.currentTurn + this.effectDuration,
          hookScope: { onBeforeDmgDealing: "attacker" },
          onBeforeDmgDealing({ attacker, owner, damage }) {
            if (attacker !== owner) return;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (effect) => effect.key !== "perched_edge",
            );
            return { damage: Number(damage) * (1 + bonus / 100) };
          },
        },
        context,
      );

      context.registerDialog?.({
        message: `${formatChampionName(user)} folds into the stone and stops being there.`,
        sourceId: user.id,
      });

      return [
        {
          log: `${formatChampionName(user)} perches, unseen, waiting for the drop.`,
        },
      ];
    },
  },

  {
    key: "chipped_edge",
    name: "Chipped Edge",

    bf: 90,
    defenseCost: 35,
    bonusPerDefense: 1,

    element: "earth",
    hitVfx: "slash",
    hitVfxPalette: "earth",
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `He breaks a shard off his own forearm, sets it against the kunai and lets the edge carry the weight of the piece he just lost. Farkoveth spends ${this.defenseCost} of his Defense to deal physical damage plus bonus damage equal to ${this.bonusPerDefense}x the Defense actually spent.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const spent = spendDefense({
        user,
        amount: this.defenseCost,
        context,
      });

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: spent * this.bonusPerDefense,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "the_statue_comes_down",
    name: "The Statue Comes Down",

    bf: 120,
    bonusPerDefense: 0.6,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Farkoveth stops holding himself together and drops the whole four metres of it onto the chosen target at once. He spends every point of Defense he still has to deal physical damage plus bonus damage equal to ${this.bonusPerDefense}x the Defense spent, and is left with none of it.`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const spent = spendDefense({
        user,
        amount: user.Defense,
        context,
      });

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: spent * this.bonusPerDefense,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default farkovethSkills;
