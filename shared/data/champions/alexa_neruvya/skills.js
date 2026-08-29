import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const alexaNeruvyaSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },
  // ========================
  // Special Abilities
  // ========================

  {
    key: "the_tide_bows",
    name: "The Tide Bows",

    healAmount: 60,
    contact: false,
    priority: 2,
    element: "water",

    description() {
      return `The Exiled One lifts two fingers and the sea lifts with them, because it has never once been asked twice. The water comes up around the chosen ally in slow coils and closes over everything it finds open, restoring ${this.healAmount} HP.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      const restored = new HealEvent({
        target: ally,
        amount: this.healAmount,
        context,
        source: user,
      }).execute();

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} restores ${restored} HP to ${
          userName === allyName ? "herself" : allyName
        }. ${allyName} is now at ${ally.HP}/${ally.maxHP} HP.`,
      };
    },
  },

  {
    key: "sovereign_absolution",
    name: "Sovereign Absolution",

    healAmount: 38,
    contact: false,
    priority: 2,
    element: "water",

    description() {
      return `The Sovereign of every water outside the body speaks over the chosen ally, and what does not belong to them is named aloud and dismissed. The tide runs through and comes out carrying it, restoring ${this.healAmount} HP and lifting away every negative status effect they are under.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      // Cleansed first, so nothing left on them can suppress the mending.
      const debuffs = ally.getStatusEffects({ type: "debuff" });
      debuffs.forEach((statusEffect) =>
        ally.removeStatusEffect(statusEffect.key),
      );

      const restored = new HealEvent({
        target: ally,
        amount: this.healAmount,
        context,
        source: user,
      }).execute();

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);
      const absolutionLog = debuffs.length
        ? ` and lifts away ${debuffs.length} negative effect(s)`
        : ", finding nothing on them to dismiss";

      return {
        log: `${userName} restores ${restored} HP to ${
          userName === allyName ? "herself" : allyName
        }${absolutionLog}.`,
      };
    },
  },

  {
    key: "advent_of_the_colossal_tide",
    name: "Advent of the Colossal Tide",

    bf: 65,
    damageMode: "piercing",
    piercingPercentage: 80,
    contact: false,
    element: "water",

    isUltimate: true,
    momentumCost: 55,
    priority: 1,

    healPercentOfDamage: 90,
    minHealPerAlly: 60,
    momentumGainPercentOfDamage: 6,
    transformInto: "alexa_neruvya_primordial",
    transformDuration: 2,

    description() {
      return `Alexa Neruvya answers one foe first, calling home through them every drop she has ever spent mending an ally, dealing Water magical damage that ignores ${this.piercingPercentage}% of their Defense. The tide that returns from that strike does not disperse: it carries ${this.healPercentOfDamage}% of the damage dealt — never less than ${this.minHealPerAlly} — back to her and every active ally, restoring HP, and leaves ${this.momentumGainPercentOfDamage}% of it behind in her as Momentum.

      Only then does she stop holding the shape she has been wearing. What surfaces is a blue dragon with the whole ocean hanging off it, her <b>Primordial Form</b>, for ${this.transformDuration} turn(s), replacing her skills, her passive and her stats.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context, resolver }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const damageResult = new DamageEvent({
        baseDamage,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
      }).execute();

      const results = Array.isArray(damageResult)
        ? [...damageResult]
        : [damageResult];
      const [mainDamageResult] = results;

      const healAmount = Math.max(
        Math.floor(
          ((mainDamageResult?.totalDamage || 0) * this.healPercentOfDamage) /
            100,
        ),
        this.minHealPerAlly,
      );

      // The tide only carries healing back if the strike connected.
      if (mainDamageResult?.landed) {
        const allies = context.aliveChampions.filter(
          (champ) => champ.team === user.team,
        );

        allies.forEach((ally) => {
          const restored = new HealEvent({
            target: ally,
            amount: healAmount,
            context,
            source: user,
          }).execute();

          if (restored <= 0) return;

          results.push({
            log: `The tide rolls back and restores ${restored} HP to ${formatChampionName(ally)}.`,
          });
        });
      }

      const momentumGain = Math.floor(
        ((mainDamageResult?.totalDamage || 0) *
          this.momentumGainPercentOfDamage) /
          100,
      );

      if (momentumGain > 0) {
        resolver.applyResourceChange({
          target: user,
          amount: momentumGain,
          context,
          sourceId: user.id,
        });

        results.push({
          log: `The tide leaves ${momentumGain} Momentum behind in ${formatChampionName(user)}.`,
        });
      }

      context.requestChampionMutation({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.transformDuration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      results.push({
        log: `${formatChampionName(user)} awakens her <b>Primordial Form</b> for ${this.transformDuration} turn(s)!`,
      });

      return results;
    },
  },
];

export default alexaNeruvyaSkills;
