import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const TWIN_KEY = "laiserisa";

const laisaelisSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Ultimate
  // ========================
  {
    key: "i_will_keep_you_here",
    name: "I Will Keep You Here",

    auraDuration: 2,
    survivalHP: 1,

    contact: false,
    isUltimate: true,
    momentumCost: 60,
    priority: 4,

    description() {
      return `Laisaelis refuses the one departure she cannot bear and lays an anchor of presence over her sister. For ${this.auraDuration} turn(s), any lethal effect that would take Laiserisa instead leaves her on the field with ${this.survivalHP} HP. The anchor never spends what Laiserisa carries of her own, and cannot be laid at all while she is absent from the field or lost to the Nothingness.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const twin = context.aliveChampions.find(
        (champion) =>
          champion.team === user.team && champion.championKey === TWIN_KEY,
      );

      if (!twin) {
        return {
          log: `${formatChampionName(user)} reaches for her sister and finds nothing to hold.`,
        };
      }

      twin.runtime.hookEffects ??= [];
      twin.runtime.hookEffects = twin.runtime.hookEffects.filter(
        (effect) => effect.key !== "keep_you_here",
      );

      const survivalHP = this.survivalHP;
      const skillName = this.name;

      twin.runtime.hookEffects.push({
        key: "keep_you_here",
        group: "skill",
        ownerId: user.id,
        expiresAtTurn: context.currentTurn + this.auraDuration,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        hookPolicies: {
          onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
        },

        onBeforeDmgTaking({ defender, owner, damage, context }) {
          if (defender !== owner) return;
          if (owner.HP - damage > 0) return;

          owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

          context.registerDialog({
            message: `<b>${skillName}</b> — ${formatChampionName(owner)} is held here, and the ending does not take.`,
            sourceId: owner.id,
            targetId: owner.id,
          });

          return {
            damage: Math.max(owner.HP - survivalHP, 0),
            log: `${formatChampionName(owner)} is kept on the field with ${survivalHP} HP.`,
          };
        },
      });

      return {
        log: `${formatChampionName(user)} anchors ${formatChampionName(twin)} to the field: she is not going anywhere.`,
      };
    },
  },
];

export default laisaelisSkills;
