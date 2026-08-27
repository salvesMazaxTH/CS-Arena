import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const TWIN_KEY = "laiserisa";
const SISTER_KEYS = ["laisaelis", "laiserisa"];

const laisaelisSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Manifest
  // ========================
  {
    key: "manifest",
    name: "Manifest",

    echoScale: 0.375,
    echoDuration: 3,

    contact: false,
    momentumCost: 55,
    priority: 2,

    description() {
      return `Laisaelis looks at something on the field and answers that there could be more of it. At the start of the next turn an Echo of the chosen entity takes the field at her side with its skills, its passive and everything currently upon it, at ${this.echoScale * 100}% of its base stats. The Echo fades after ${this.echoDuration} turns, and its ending is not a death: it concedes no points, and nothing that answers to dying answers to it. Neither sister can be echoed.`;
    },

    targetSpec: [{ type: "select:any", excludesKeys: SISTER_KEYS }],

    resolve({ user, targets, context }) {
      const source = targets.any;

      if (!source || SISTER_KEYS.includes(source.championKey)) {
        return {
          log: `${formatChampionName(user)} finds nothing there worth echoing.`,
        };
      }

      const echoScale = this.echoScale;
      const skillName = this.name;
      const fadesAtTurn = context.currentTurn + 1 + this.echoDuration;

      context.schedule({
        type: "spawnChampion",
        turnToHappen: context.currentTurn + 1,

        payload: {
          championKey: source.championKey,
          team: user.team,
          asEntityType: "minion",
          statScale: echoScale,

          onSpawn: (echo, spawnContext) => {
            echo.name = `Echo of ${source.name}`;
            echo.runtime.leavesNoDeath = true;
            echo.momentum = source.momentum;

            for (const modifier of source.statModifiers) {
              echo.modifyStat({
                statName: modifier.statName,
                amount: modifier.percentAmount ?? modifier.amount,
                isPercent: modifier.percentAmount != null,
                duration: modifier.expiresAtTurn - spawnContext.currentTurn,
                context: spawnContext,
                isPermanent: modifier.isPermanent,
                statModifierSrc: echo,
              });
            }

            for (const effect of source.statusEffects.values()) {
              const remaining = effect.expiresAtTurn - spawnContext.currentTurn;
              if (remaining <= 0) continue;

              echo.applyStatusEffect(effect.key, remaining, spawnContext, {
                stackCount: effect.stacks ?? 1,
                persistent: !Number.isFinite(remaining),
              });
            }

            echo.runtime.hookEffects ??= [];
            echo.runtime.hookEffects.push({
              key: "manifest_fade",
              group: "skill",
              ownerId: echo.id,

              onTurnStart({ owner, context }) {
                if (context.currentTurn < fadesAtTurn) return;

                owner.HP = 0;
                owner.alive = false;

                context.registerDialog({
                  message: `<b>${skillName}</b> — ${formatChampionName(owner)} was only ever an answer, and it stops being one.`,
                  sourceId: owner.id,
                  targetId: owner.id,
                });
              },
            });
          },
        },
      });

      return {
        log: `${formatChampionName(user)} looks at ${formatChampionName(source)} and answers that there could be more of it.`,
      };
    },
  },

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
