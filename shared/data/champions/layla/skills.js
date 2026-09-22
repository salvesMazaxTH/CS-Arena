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
      return {
        en: `Layla studies the chosen enemy until their next move is already hers to call. Deals <b>magical damage</b> and leaves them <b>Paralyzed</b> for <b>${this.paralyzeDuration}</b> turn(s).`,
        pt: `Layla estuda o inimigo escolhido até que o próximo movimento dele já seja dela para decidir. Causa <b>dano mágico</b> e o deixa <b>Paralisado</b> por <b>${this.paralyzeDuration}</b> turno(s).`,
      };
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
      return {
        en: `Layla always gets the last word. <b>Three</b> bolts in quick order; she has already worked out where the last one has to land, so it strikes as a guaranteed <b>critical hit</b>. Deals <b>magical lightning damage</b>.`,
        pt: `Layla sempre tem a última palavra. <b>Três</b> raios em rápida sucessão; ela já sabe exatamente onde o último precisa acertar, então ele chega como um <b>acerto crítico</b> garantido. Causa <b>dano mágico de raio</b>.`,
      };
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
      return {
        en: `Layla stops pretending the storm is an accident. She tears the seal off her magic and empties it into the chosen enemy: deals heavy <b>magical damage</b> and leaves the target <b>Paralyzed</b> for <b>${this.paralyzeDuration}</b> turn(s).`,
        pt: `Layla para de fingir que a tempestade é um acidente. Ela arranca o selo de sua magia e a despeja inteira no inimigo escolhido: causa pesado <b>dano mágico</b> e deixa o alvo <b>Paralisado</b> por <b>${this.paralyzeDuration}</b> turno(s).`,
      };
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
        message: {
          en: `The room goes white. ${formatChampionName(enemy)} does not get to answer.`,
          pt: `A sala fica branca. ${formatChampionName(enemy)} não tem chance de resposta.`,
        },
        sourceId: user.id,
        targetId: enemy.id,
      });

      return result;
    },
  },
];

export default laylaSkills;
