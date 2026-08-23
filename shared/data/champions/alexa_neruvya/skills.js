import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const alexaNeruvyaSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },
  // ========================
  // Special Abilities
  // ========================

  {
    key: "tidecall_benediction",
    name: "Tidecall Benediction",

    healAmount: 60,
    contact: false,
    priority: 2,
    element: "water",

    description() {
      return `Alexa Neruvya lifts two fingers and the sea lifts with them, because it has never once been asked twice. The water comes up around the chosen ally in slow coils and closes over everything it finds open, restoring ${this.healAmount} HP.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      const restored = ally.heal(this.healAmount, context, user);

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
      return `The Queen of every water outside the body speaks over the chosen ally, and what does not belong to them is named aloud and dismissed. The tide runs through and comes out carrying it, restoring ${this.healAmount} HP and lifting away every negative status effect they are under.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      const restored = ally.heal(this.healAmount, context, user);

      const debuffs = ally.getStatusEffects({ type: "debuff" });
      debuffs.forEach((statusEffect) =>
        ally.removeStatusEffect(statusEffect.key),
      );

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

    bf: 74,
    damageMode: "piercing",
    piercingPercentage: 80,
    contact: false,
    element: "water",

    isUltimate: true,
    momentumCost: 60,
    priority: 0,

    rootDuration: 2,

    description() {
      return `Alexa Neruvya stops holding the shape she has been wearing, and the thing that surfaces is a blue dragon with the whole ocean hanging off it. Every drop she has ever spent mending an ally is still hers, and she calls all of it home through the chosen target at once, dealing Water magical damage that ignores ${this.piercingPercentage}% of their Defense.

      Nothing walks out of a tide that size. The undertow closes over the target and leaves them Rooted for ${this.rootDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        mode: "piercing",
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
      }).execute();

      if (!result?.evaded && !result?.immune) {
        enemy.applyStatusEffect("rooted", this.rootDuration, context);

        const rootLog = `The tide closes over ${formatChampionName(enemy)}, leaving them <b>Rooted</b>!`;
        result.log = result.log ? `${result.log}\n${rootLog}` : rootLog;
      }

      return result;
    },
  },
];

export default alexaNeruvyaSkills;
