import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const INDICT_MARK_KEY = "sky_courts_indicted";

const orynSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "draw_the_sky_down",
    name: "Draw the Sky Down",

    tauntDuration: 2,
    damageReductionAmount: 12,
    damageReductionDuration: 2,

    contact: false,
    priority: 3,
    element: "lightning",

    description() {
      return `Oryn lifts the pins in his forearms and the air leans toward him. He Taunts two chosen enemies for ${this.tauntDuration} turn(s) and braces for the answer, gaining ${this.damageReductionAmount} Damage Reduction for ${this.damageReductionDuration} turn(s).`;
    },

    targetSpec: [
      { type: "enemy", unique: true },
      { type: "enemy", unique: true },
    ],

    resolve({ user, targets, context = {} }) {
      user.applyDamageReduction({
        amount: this.damageReductionAmount,
        duration: this.damageReductionDuration,
        source: this.key,
        context,
      });

      const logs = [];
      for (const enemy of targets) {
        if (!enemy?.alive) continue;
        const tauntLog = enemy.applyTaunt(user.id, this.tauntDuration, context);
        if (tauntLog) logs.push(tauntLog);
      }

      logs.unshift({
        log: `${formatChampionName(user)} uses <b>Draw the Sky Down</b> and braces, gaining ${this.damageReductionAmount} Damage Reduction.`,
      });
      return logs;
    },
  },

  {
    key: "earthing_lance",
    name: "Earthing Lance",

    defenseScaling: 55,
    paralyzeDuration: 2,

    contact: true,
    damageMode: "standard",
    priority: 1,
    element: "lightning",

    description() {
      return `Oryn drives a pin into the chosen enemy and lets the charge he has been carrying run down it, dealing Lightning magical damage equal to ${this.defenseScaling}% of his Defense and leaving them Paralyzed for ${this.paralyzeDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Defense * this.defenseScaling) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "sentence_of_the_sky_courts",
    name: "Sentence of the Sky-Courts",

    indictDuration: 2,
    dischargePercent: 65,
    dischargePiercing: 40,
    paralyzeDuration: 2,
    maxDischarges: 2,
    shieldAmount: 90,

    contact: false,
    isUltimate: true,
    momentumCost: 58,
    priority: 2,
    element: "lightning",

    description() {
      return `The pins in Oryn's body finish their work and the sky-courts hand down their sentence on the whole enemy line — a sentence, not a blow. For ${this.indictDuration} turns, the first time each Indicted enemy deals damage the charge grounds through them for Lightning magical damage equal to ${this.dischargePercent}% of that blow, following the path of least resistance past ${this.dischargePiercing}% of their Defense, leaving them Paralyzed for ${this.paralyzeDuration} turn(s) and banking Oryn's team 1 point; at most once per turn and ${this.maxDischarges} times each, and nothing if Oryn has fallen. He stands under a ${this.shieldAmount} Shield while the courts sit.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const list = Array.isArray(targets) ? targets : targets ? [targets] : [];
      const castTurn = context.currentTurn;
      const marked = [];

      for (const enemy of list) {
        if (!enemy?.alive) continue;

        enemy.runtime.hookEffects ??= [];
        enemy.runtime.hookEffects = enemy.runtime.hookEffects.filter(
          (e) => e.key !== INDICT_MARK_KEY,
        );

        enemy.addHookEffect(
          {
            type: "debuff",
            key: INDICT_MARK_KEY,
            name: "Indicted",
            group: "skill",
            ownerId: user.id,
            expiresAtTurn: castTurn + this.indictDuration + 1,
            castTurn,
            dischargePercent: this.dischargePercent,
            dischargePiercing: this.dischargePiercing,
            paralyzeDuration: this.paralyzeDuration,
            maxDischarges: this.maxDischarges,
            dischargesUsed: 0,
            lastDischargeTurn: 0,

            hookScope: { onAfterDmgDealing: "attacker" },

            onAfterDmgDealing({ owner, damage, context }) {
              if (context.currentTurn <= this.castTurn) return;
              if (!(damage > 0)) return;
              if (this.lastDischargeTurn === context.currentTurn) return;
              if (this.dischargesUsed >= this.maxDischarges) return;

              const oryn = context.allChampions?.get?.(this.ownerId);
              if (!oryn?.alive || !owner.alive) return;

              this.lastDischargeTurn = context.currentTurn;
              this.dischargesUsed += 1;
              if (this.dischargesUsed >= this.maxDischarges) {
                owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
                  (e) => e !== this,
                );
              }

              const result = new DamageEvent({
                baseDamage: (damage * this.dischargePercent) / 100,
                attacker: oryn,
                defender: owner,
                skill: {
                  key: "sentence_of_the_sky_courts",
                  name: "Sentence of the Sky-Courts",
                  element: "lightning",
                  contact: false,
                },
                type: "magical",
                mode: "piercing",
                piercingPercentage: this.dischargePiercing,
                context,
                allChampions: context.allChampions,
              }).execute();

              const arr = Array.isArray(result) ? result : [result];

              if (effectConnected(arr[0], "paralyzed")) {
                owner.applyStatusEffect(
                  "paralyzed",
                  this.paralyzeDuration,
                  context,
                  { sourceId: oryn.id },
                );
              }

              context.registerScore?.({
                amount: 1,
                scoringSlot: oryn.team - 1,
                reason: this.key,
                sourceId: oryn.id,
              });

              const targetName = formatChampionName(owner);
              context.registerDialog?.({
                message: `⚡ The sky-courts ground their sentence through ${targetName}!`,
                sourceId: oryn.id,
                targetId: owner.id,
              });

              return {
                log: arr[0]?.log
                  ? `<b>Sentence of the Sky-Courts</b> grounds through ${targetName} — Oryn's team banks 1 point.\n${arr[0].log}`
                  : `<b>Sentence of the Sky-Courts</b> grounds through ${targetName} — Oryn's team banks 1 point.`,
              };
            },
          },
          context,
        );

        marked.push(formatChampionName(enemy));
      }

      user.addShield(this.shieldAmount, 0, context);

      context.registerDialog?.({
        message: `⚖️ The sky-courts sit — ${marked.length} enem${marked.length === 1 ? "y is" : "ies are"} Indicted.`,
        sourceId: user.id,
        targetId: user.id,
      });

      return {
        log: `${formatChampionName(user)} hands down <b>Sentence of the Sky-Courts</b> on ${marked.join(", ")} and stands under a ${this.shieldAmount} Shield.`,
      };
    },
  },
];

export default orynSkills;
