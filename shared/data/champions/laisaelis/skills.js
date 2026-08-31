import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { findTwin, survivalDamage, wouldBeLethal } from "../pairs/twinBond.js";

const SISTER_KEYS = ["laisaelis", "laiserisa"];

const laisaelisSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },

  // ========================
  // Manifest
  // ========================
  {
    key: "manifest",
    name: "Manifest",

    echoScale: 0.375,
    echoSpeedScale: 0.75,
    echoDuration: 3,

    contact: false,
    priority: 2,

    description() {
      return `Laisaelis looks at something on the field and answers that there could be more of it. At the start of the next turn an Echo of the chosen entity takes the field at her side with its skills, its passive and everything currently upon it, at ${this.echoScale * 100}% of its base stats — ${this.echoSpeedScale * 100}% for Speed. Only one Echo can hold the field at a time: casting again unravels the old one. The Echo fades after ${this.echoDuration} turns, and its ending is not a death: it concedes no points, and nothing that answers to dying answers to it. Neither sister can be echoed, and neither can an Echo.`;
    },

    targetSpec: [
      {
        type: "select:any",
        excludesKeys: SISTER_KEYS,
        excludesRuntimeFlag: "manifestEcho",
      },
    ],

    resolve({ user, targets, context }) {
      const [source] = targets;
      const echoScale = this.echoScale;
      const echoSpeedScale = this.echoSpeedScale;
      const skillName = this.name;
      const fadesAtTurn = context.currentTurn + 1 + this.echoDuration;

      // Only one Echo may hold the field, so a recast replaces the current one.
      const castToken = (user.runtime.manifestCastToken ?? 0) + 1;
      user.runtime.manifestCastToken = castToken;

      for (const other of context.aliveChampions) {
        if (other.team !== user.team || !other.runtime?.manifestEcho) continue;
        other.HP = 0;
        other.alive = false;
        context.registerDialog({
          message: `<b>${skillName}</b> — ${formatChampionName(other)} comes apart as ${formatChampionName(user)} answers anew.`,
          sourceId: user.id,
          targetId: other.id,
        });
      }

      context.schedule({
        type: "spawnChampion",
        turnToHappen: context.currentTurn + 1,

        payload: {
          championKey: source.championKey,
          team: user.team,
          asEntityType: "minion",
          statScale: echoScale,
          statScaleByStat: { Speed: echoSpeedScale },

          onSpawn: (echo, spawnContext) => {
            echo.runtime.leavesNoDeath = true;
            echo.runtime.manifestEcho = true;

            // A newer Manifest was cast before this Echo could form: it never takes the field.
            if (user.runtime.manifestCastToken !== castToken) {
              echo.HP = 0;
              echo.alive = false;
              return;
            }

            echo.name = `Echo of ${source.name}`;
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

            // Its expiresAtTurn rides the same turn clock, so it carries over as-is.
            for (const modifier of source.damageModifiers) {
              echo.addDamageModifier({ ...modifier });
            }

            for (const effect of source.statusEffects.values()) {
              const remaining = effect.expiresAtTurn - spawnContext.currentTurn;
              if (remaining <= 0) continue;

              echo.applyStatusEffect(effect.key, remaining, spawnContext, {
                stackCount: effect.stacks ?? 1,
                persistent: !Number.isFinite(remaining),
              });
            }

            echo.addHookEffect({
              type: "neutral",
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
            }, context);
          },
        },
      });

      return {
        log: `${formatChampionName(user)} looks at ${formatChampionName(source)} and answers that there could be more of it.`,
      };
    },
  },

  // ========================
  // That Will Not Reach You
  // ========================
  {
    key: "that_will_not_reach_you",
    name: "That Will Not Reach You",

    wardDuration: 2,

    contact: false,
    priority: 3,

    description() {
      return `Laisaelis steps between an ally and the next thing meant to diminish them. For ${this.wardDuration} turn(s) the chosen ally — herself or her sister included — carries <b>Affliction Ward</b>: the first negative effect that would take hold never does, and the ward is spent turning it away. It stops nothing that merely deals damage.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally = user] = targets;

      ally.applyStatusEffect("debuffImmunity", this.wardDuration, context, {
        sourceId: user.id,
      });

      return {
        log: `${formatChampionName(user)} stands between ${formatChampionName(ally)} and whatever comes next.`,
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
      return `Laisaelis refuses the one departure she cannot bear and lays an anchor of presence over her sister. For ${this.auraDuration} turn(s), the first lethal effect that would take Laiserisa instead leaves her on the field with ${this.survivalHP} HP. The anchor never spends what Laiserisa carries of her own, and cannot be laid at all while she is absent from the field or lost to the Nothingness.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const twin = findTwin(user, context);

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

      twin.addHookEffect(
        {
          type: "buff",
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
            // Laiserisa's own binding answers the same hit and outranks this.
            if (owner.runtime.hookEffects?.some((e) => e.key === "twin_departure"))
              return;
            if (!wouldBeLethal(owner, damage)) return;

            owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

            // One anchor, one save: spend it by removing it.
            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (e) => e.key !== "keep_you_here",
            );

            context.registerDialog({
              message: `<b>${skillName}</b> — ${formatChampionName(owner)} is held here, and the ending does not take.`,
              sourceId: owner.id,
              targetId: owner.id,
            });

            return {
              damage: survivalDamage(owner, survivalHP),
              log: `${formatChampionName(owner)} is kept on the field with ${survivalHP} HP.`,
            };
          },
        },
        context,
      );

      return {
        log: `${formatChampionName(user)} anchors ${formatChampionName(twin)} to the field: she is not going anywhere.`,
      };
    },
  },
];

export default laisaelisSkills;
