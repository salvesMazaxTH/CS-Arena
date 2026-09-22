import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const lordOfTheShadowflameSkills = [
  totalBlock,

  {
    key: "ashen_grasp",
    name: "Ashen Grasp",

    bf: 70,
    burnDuration: 2,

    contact: true,
    damageMode: "standard",
    element: "fire",
    priority: 0,

    description() {
      return {
        en: `It doesn't grip so much as ignite. Deals <b>physical damage</b> and always sets the target <b>Burning</b> for <b>${this.burnDuration}</b> turn(s).`,
        pt: `Não é bem uma garra, é um estopim. Causa <b>dano físico</b> e sempre deixa o alvo <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "the_flame_takes_its_due",
    name: "The Flame Takes Its Due",

    bf: 150,
    recoilPercentOfMaxHP: 22,

    contact: true,
    damageMode: "standard",
    ignoreAffinityResistance: true,
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    hits: [
      {
        id: "recoil",
        label: "Recoil (The Flame Takes Its Due)",
        type: "magical",
        contact: false,
        damageMode: "absolute",
        suppressLog: true,
      },
    ],

    description() {
      return {
        en: `There was never anything left to hold back — the Flame spends this body like it's already spent. Deals <b>physical damage</b>, taking <b>${this.recoilPercentOfMaxHP}%</b> of its Max HP as <b>Absolute</b> recoil damage whether the blow lands or not. No elemental resistance dims the Shadowflame.`,
        pt: `Não sobra nada a ser poupado — a Chama consome este corpo como algo que já se entregou por inteiro. Causa <b>dano físico</b> e sofre <b>${this.recoilPercentOfMaxHP}%</b> do próprio HP Máximo como recuo de <b>dano Absoluto</b>, acerte ou não. Nenhuma resistência elemental ofusca a Chama Sombria.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];
      const recoilDamage = Math.floor(
        (user.maxHP * this.recoilPercentOfMaxHP) / 100,
      );

      const recoilResult = SkillHits.run(this, "recoil", {
        user,
        target: user,
        baseDamage: recoilDamage,
        context: { ...context, damageDepth: 1 },
      });

      results.push(
        ...(Array.isArray(recoilResult) ? recoilResult : [recoilResult]),
      );

      return results;
    },
  },
];

export default lordOfTheShadowflameSkills;
