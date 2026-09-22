import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const yukiSkills = [
  totalBlock,

  {
    key: "moonlit_cut",
    name: "Moonlit Cut",

    bf: 100,

    contact: true,
    damageMode: "standard",
    priority: 1,
    hitVfx: "slash",
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Yuki is already past the chosen target before the moonlight catches his blade. Deals physical damage.`,
        pt: `Yuki já passou pelo alvo escolhido antes que o luar alcance sua lâmina. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "water_shuriken",
    name: "Water Shuriken",

    bf: 80,
    snareDuration: 2,

    contact: false,
    damageMode: "standard",
    element: "water",
    priority: 0,
    hitVfx: "water_shuriken",
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Yuki flings a shuriken shaped from raw water, and it lashes tight around the chosen target the instant it lands. Deals physical damage and applies <b>Snared</b> for ${this.snareDuration} turn(s).`,
        pt: `Yuki lança uma shuriken moldada em água pura, que se enrola com força ao redor do alvo escolhido no instante em que o atinge. Causa dano físico e o deixa <b>Enredado</b> por ${this.snareDuration} turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "drowning_moon",
    name: "Drowning Moon",

    bf: 130,
    snareDuration: 2,

    contact: false,
    damageMode: "standard",
    element: "water",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Yuki brings both hands together, and the water around the chosen target answers all at once. Deals physical damage and applies Snared for ${this.snareDuration} turn(s).`,
        pt: `Yuki junta as duas mãos, e toda a água ao redor do alvo escolhido responde de uma só vez. Causa dano físico e o deixa <b>Enredado</b> por ${this.snareDuration} turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },
];

export default yukiSkills;
