import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const torrenSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Skills
  // ========================

  {
    key: "resounding_sword",
    name: "Resounding Sword",
    bf: 50,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Torren swings his sword with crushing force, the resounding blow striking the chosen enemy and stunning another at random.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const damageEvent = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (
        damageEvent?.evaded ||
        damageEvent?.immune ||
        !(damageEvent?.totalDamage > 0)
      ) {
        return damageEvent;
      }

      const otherEnemies = context?.allChampions
        ? Array.from(context.allChampions.values()).filter(
            (champion) =>
              champion.team !== user.team &&
              champion.id !== enemy.id &&
              champion.alive,
          )
        : [];

      if (!otherEnemies.length) return damageEvent;

      const randomEnemy =
        otherEnemies[Math.floor(Math.random() * otherEnemies.length)];

      randomEnemy.applyStatusEffect("stunned", 1, context, {
        source: {
          type: "skill",
          skill: this,
          champion: user,
        },
      });

      return damageEvent;
    },
  },

  {
    key: "scorn_the_weak",
    name: "Scorn the Weak",
    bf: 40,
    contact: true,
    damageMode: "piercing",
    piercingPercentage: 100,
    thresholdMultiplier: 1.35,
    priority: 2,
    tauntDuration: 2,

    description() {
      return `Torren singles out the most fragile enemy, striking through their defenses with a piercing blow. If their fragility is significantly greater than his, they are Taunted for ${this.tauntDuration} turn(s) and deal 30% less damage to other targets.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const torrenScore = user.Attack / Math.max(1, user.HP + user.Defense);

      const scoredTargets = targets.map((t) => {
        const score = t.Attack / Math.max(1, t.HP + t.Defense);
        return { t, score };
      });

      // Always picks the most fragile, even if the threshold isn't met.
      const best = scoredTargets.reduce((best, curr) => {
        return !best || curr.score > best.score ? curr : best;
      }, null);

      if (!best) return null;

      const target = best.t;
      const targetScore = best.score;

      const damageEvent = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: target,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Actual weakness condition.
      const isWeakEnough =
        targetScore >= torrenScore * this.thresholdMultiplier;

      let tauntLog = null;

      if (isWeakEnough) {
        tauntLog = target.applyTaunt(user.id, this.tauntDuration, context);

        target.damageModifiers = target.damageModifiers.filter(
          (mod) => mod.id !== "scorned",
        );

        target.addDamageModifier({
          id: "scorned",
          expiresAtTurn: context.currentTurn + this.tauntDuration,

          apply: ({ baseDamage, defender }) => {
            if (!defender || defender.id !== user.id) {
              return baseDamage * 0.7;
            }

            return baseDamage;
          },
        });
      }

      return tauntLog ? [damageEvent, tauntLog] : damageEvent;
    },
  },

  {
    key: "juggernaut",
    name: "Juggernaut",
    bf: 115,
    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    stunDuration: 2,
    priority: 0,

    description() {
      return `Torren advances with unstoppable force, crushing the chosen enemy beneath a devastating blow and Stunning them for ${this.stunDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const damageEvent = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (
        !damageEvent?.evaded &&
        !damageEvent?.immune &&
        damageEvent?.totalDamage > 0
      ) {
        enemy.applyStatusEffect("stunned", this.stunDuration, context, {
          source: {
            type: "skill",
            skill: this,
            champion: user,
          },
        });
      }

      return damageEvent;
    },
  },
];

export default torrenSkills;