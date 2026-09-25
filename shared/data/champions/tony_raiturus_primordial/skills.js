import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

const tonyRaiturusPrimordialSkills = [
  {
    key: "the_whole_sky_at_once",
    name: "The Whole Sky at Once",

    bf: 45,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    cannotBeEvaded: true,
    priority: 0,

    description() {
      return {
        en: `The storm stops choosing where to land. Deals lightning magical damage to <b>ALL</b> enemies. This attack <b>cannot be evaded</b>.`,
        pt: `A tempestade para de escolher onde cair. Causa dano mágico de relâmpago a <b>TODOS</b> os inimigos. Este ataque <b>não pode ser esquivado</b>.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const results = [];

      for (const enemy of targets) {
        if (!enemy?.alive) continue;

        const result = new DamageEvent({
          baseDamage: (user.Attack * this.bf) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(...(Array.isArray(result) ? result : [result]));
      }

      return results;
    },
  },

  {
    key: "sentence_served",
    name: "Sentence Served",

    bf: 100,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    cannotBeEvaded: true,
    isUltimate: true,
    momentumCost: 27,
    priority: 0,

    description() {
      return {
        en: `Tony Raiturus was sentenced to be exactly this, and for one strike he stops apologising for it. Deals devastating lightning magical damage to a single enemy. This attack <b>cannot be evaded</b>.`,
        pt: `Tony Raiturus foi condenado a ser exatamente isso, e por um golpe ele para de pedir desculpas por isso. Causa devastador dano mágico de relâmpago a um único inimigo. Este ataque <b>não pode ser esquivado</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default tonyRaiturusPrimordialSkills;
