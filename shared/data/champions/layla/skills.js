import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const laylaSkills = [
  totalBlock,

  {
    key: "count_every_breath",
    name: "Count Every Breath",

    bf: 75,
    paralyzeDuration: 1,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    priority: 0,

    description() {
      return `Layla studies the chosen enemy until their next move is already hers to call. Deals magical damage and leaves them Paralyzed for ${this.paralyzeDuration} turn(s).`;
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

      if (effectConnected(result, "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "last_word",
    name: "Last Word",

    hitCount: 3,
    bf: 25,
    bfFinal: 40,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    priority: 0,

    description() {
      return `Layla always gets the last word. Three bolts in quick order; she has already worked out where the last one has to land, so it strikes as a guaranteed critical hit. Deals magical lightning damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (let hit = 0; hit < this.hitCount; hit += 1) {
        const isFinal = hit === this.hitCount - 1;

        const result = new DamageEvent({
          baseDamage: (user.Attack * (isFinal ? this.bfFinal : this.bf)) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          critOptions: isFinal ? { force: true } : undefined,
          allChampions: context?.allChampions,
        }).execute();

        results.push(...(Array.isArray(result) ? result : [result]));
      }

      return results;
    },
  },

  {
    key: "the_secret_underneath",
    name: "The Secret Underneath",

    bf: 140,
    paralyzeDuration: 2,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Layla stops pretending the storm is an accident. She tears the seal off her magic and empties it into the chosen enemy: deals heavy magical damage and leave the target Paralyzed for ${this.paralyzeDuration} turn(s).`;
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

      if (effectConnected(result, "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context, {
          sourceId: user.id,
        });
      }

      context.registerDialog?.({
        message: `The room goes white. ${formatChampionName(enemy)} does not get to answer.`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      return result;
    },
  },
];

export default laylaSkills;
