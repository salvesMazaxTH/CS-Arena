import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { detonateThunder } from "./passive.js";

const tonyRaiturusSkills = [
  totalBlock,

  {
    key: "the_eye_he_kept",
    name: "The Eye He Kept",

    bf: 105,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfxPalette: "lightning",
    splitsIntoThunder: false,
    priority: 0,

    description() {
      return {
        en: `Tony sights down the green eye, the one that is still only a boy's, and lets the bolt go on the second he chose. Deals lightning magical damage in full, right away — it does not split into thunder, so it carries no bonus damage and can be evaded like any other strike.`,
        pt: `Tony mira pelo olho verde, aquele que ainda é só de um garoto, e solta o raio no instante exato que escolheu. Causa dano mágico de relâmpago por completo, na hora — não se divide em trovão, então não carrega dano bônus e pode ser esquivado como qualquer outro golpe.`,
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

  {
    key: "the_dragons_eye",
    name: "The Dragon's Eye",

    bf: 70,
    recoilPercentOfMaxHp: 12,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfxPalette: "lightning",
    doublesThunder: true,
    priority: 0,

    description() {
      return {
        en: `Tony lets the gold eye open all the way, and for a moment the shape he is holding is far too small for what is looking out of it. Deals lightning magical damage and doubles the thunder left hanging over the target, at the cost of <b>${this.recoilPercentOfMaxHp}%</b> of his own <b>Max HP</b> as <b>Absolute Damage</b>.`,
        pt: `Tony deixa o olho dourado se abrir por completo, e por um instante a forma que ele ocupa fica pequena demais para o que olha através dela. Causa dano mágico de relâmpago e dobra o trovão que ainda paira sobre o alvo, ao custo de <b>${this.recoilPercentOfMaxHp}%</b> do seu próprio <b>HP Máximo</b> como <b>Dano Absoluto</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      context.extraDamageQueue ??= [];
      context.extraDamageQueue.push({
        baseDamage: (user.maxHP * this.recoilPercentOfMaxHp) / 100,
        mode: "absolute",
        attacker: user,
        defender: user,
        type: "magical",
        skill: this,
      });

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

  {
    key: "the_shape_he_outgrew",
    name: "The Shape He Outgrew",

    bf: 120,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    hitVfxPalette: "lightning",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    transformInto: "tony_raiturus_primordial",
    transformDuration: 2,

    description() {
      return {
        en: `The boy's shape was never the redemption, only the terms of it, and Tony stops honouring them. Deals lightning magical damage, then he unfolds into the storm he was sentenced to be, his <b>Primordial Form</b>, for <b>${this.transformDuration}</b> turn(s), replacing his skills, his passive and his stats. As he unfolds, every thunder still owed to an enemy arrives on the spot.`,
        pt: `A forma do garoto nunca foi a redenção, apenas os termos dela, e Tony deixa de honrá-los. Causa dano mágico de relâmpago e então se desdobra na tempestade que foi condenado a ser, sua <b>Forma Primordial</b>, por <b>${this.transformDuration}</b> turno(s), substituindo suas habilidades, sua passiva e seus atributos. Ao se desdobrar, todo trovão ainda devido a um inimigo chega na hora.`,
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

      const results = Array.isArray(result) ? [...result] : [result];

      context.requestChampionMutation({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.transformDuration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      results.push({
        log: `${formatChampionName(user)} stops holding the boy's shape and rises as his <b>Primordial Form</b> for ${this.transformDuration} turn(s)!`,
      });

      results.push(...detonateThunder(user, context));

      return results;
    },
  },
];

export default tonyRaiturusSkills;
