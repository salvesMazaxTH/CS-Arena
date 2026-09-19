import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import passive from "./passive.js";
import totalBlock from "../generic/totalBlock.js";

const bergrisaSkills = [
  totalBlock,

  {
    key: "valleystride",
    name: "Valleystride",
    bf: 45,
    damageMode: "standard",
    contact: true,
    priority: 0,
    stunDuration: 1,
    stunSedimentCost: 8,
    stunGapThreshold: 110,

    description() {
      return `Bergrisa takes one step, and the whole line of them has to decide where it stands. She strikes every enemy at once; if she is holding ${this.stunSedimentCost} Sediment she spends it to Stun for ${this.stunDuration} turn the enemy whose Defense she most outweighs, and only if that gap is at least ${this.stunGapThreshold}. Deals physical damage.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of targets) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(
          ...(Array.isArray(damageResult) ? damageResult : [damageResult]),
        );
      }

      const sediment = user.runtime?.bergrisaSediment || 0;
      if (sediment < this.stunSedimentCost) return results;

      const outweighed = targets
        .filter((enemy) => enemy.alive)
        .sort((a, b) => (a.Defense || 0) - (b.Defense || 0))[0];

      if (!outweighed) return results;

      const gap = (user.Defense || 0) - (outweighed.Defense || 0);
      if (gap < this.stunGapThreshold) return results;

      const hit = results.find((r) => r?.defender?.id === outweighed.id);
      if (!effectConnected(hit, "stunned")) return results;

      passive.setSediment(user, sediment - this.stunSedimentCost);

      outweighed.applyStatusEffect("stunned", this.stunDuration, context, {
        source: { type: "skill", skill: this, champion: user },
      });

      results.push({
        log: `<b>[${this.name}]</b> ${formatChampionName(user)} spent ${this.stunSedimentCost} Sediment and pinned ${formatChampionName(outweighed)} to the ground.`,
      });

      return results;
    },
  },

  {
    key: "under_the_palm",
    name: "Under the Palm",
    contact: false,
    priority: 3,
    tauntDuration: 1,

    description() {
      return `Bergrisa lowers an open hand over one enemy and the valley leans with her. The chosen target is Taunted for ${this.tauntDuration} turn, and until her next turn every blow her allies take is blunted by as much as Strata blunts her own, except Absolute damage, damage over time and piercing hits.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const logs = [];

      const tauntLog = target.applyTaunt(user.id, this.tauntDuration, context);
      if (tauntLog) logs.push(tauntLog);

      const subtraction = passive.subtractionFor(user);
      const expiresAtTurn = (context.currentTurn || 0) + 1;
      const allies = TargetFilter.candidates(
        "ally",
        user,
        context.aliveChampions ?? [],
      );

      for (const ally of allies) {
        ally.addHookEffect(
          {
            type: "buff",
            key: "under-the-palm",
            name: "Under the Palm",
            expiresAtTurn,
            hookScope: { onBeforeDmgTaking: "defender" },
            onBeforeDmgTaking({ damage, mode, piercingPercentage }) {
              if (!(damage > 0)) return;
              if (mode === "piercing" || (piercingPercentage || 0) > 0) return;

              return { damage: passive.blunt(damage, subtraction) };
            },
          },
          context,
        );
      }

      logs.push({
        log: `<b>[${this.name}]</b> ${formatChampionName(user)} set her hand over the field; every ally now subtracts ${subtraction} from each blow.`,
      });

      return logs;
    },
  },

  {
    key: "the_valley_turns_over",
    name: "The Valley Turns Over",
    bf: 30,
    damageMode: "standard",
    defenseGapRatio: 0.8,
    maxGapBonus: 110,
    cannotBeEvaded: true,
    contact: true,
    isUltimate: true,
    momentumCost: 60,
    priority: 0,
    sedimentGain: 4,

    description() {
      return `Bergrisa takes the floor of the world in both hands and tips it, and everything standing on it goes down with the stone. She strikes every enemy carrying ${this.defenseGapRatio * 100}% of the Defense gap as bonus damage, up to ${this.maxGapBonus}, rather than Strata's usual share, and settles ${this.sedimentGain} Sediment into herself. Deals physical damage.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of targets) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(
          ...(Array.isArray(damageResult) ? damageResult : [damageResult]),
        );
      }

      passive.setSediment(
        user,
        (user.runtime?.bergrisaSediment || 0) + this.sedimentGain,
      );

      return results;
    },
  },
];

export default bergrisaSkills;
