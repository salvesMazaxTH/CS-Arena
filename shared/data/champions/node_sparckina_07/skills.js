import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const nodeSparckina07Skills = [
  basicStrike,
  // ========================
  // Special Abilities
  // ========================

  {
    key: "sparkling_slash",
    name: "Sparkling Slash",
    bf: 70,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,
    element: "lightning",
    description() {
      return {
        en: `Node-SPARCKINA-07 carves a live arc through the chosen target, dealing <b>Lightning magical damage</b>.`,
        pt: `Node-SPARCKINA-07 corta um arco vivo através do alvo escolhido, causando <b>dano mágico de Relâmpago</b>.`,
      };
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
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
    key: "radiant_rush",
    name: "Radiant Rush",
    speedBuff: 10,
    evasionPercent: 10, // Evasion gain, as a percentage of Speed
    contact: false,

    priority: 3,
    element: "lightning",
    description() {
      return {
        en: `Node-SPARCKINA-07 overclocks its drive and blurs into motion, gaining <b>+${this.speedBuff}</b> <b>Speed</b> and <b>Evasion</b> equal to <b>${this.evasionPercent}%</b> of its Speed.`,
        pt: `Node-SPARCKINA-07 sobrecarrega seu motor e dispara em alta velocidade, ganhando <b>+${this.speedBuff}</b> de <b>Velocidade</b> e <b>Esquiva</b> igual a <b>${this.evasionPercent}%</b> da sua Velocidade.`,
      };
    },
    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        isPermanent: true,
        context,
      });

      // Buff Evasion after Speed so the gain is based on the updated Speed.
      const evasionBuff = user.Speed * (this.evasionPercent / 100);

      user.modifyStat({
        statName: "Evasion",
        amount: evasionBuff,
        isPermanent: true,
        context,
      });

      return {
        log: {
          en: `${formatChampionName(user)} surges into a radiant rush (<b>+${this.speedBuff}</b> Speed, <b>+${evasionBuff}</b> Evasion).`,
          pt: `${formatChampionName(user)} dispara em uma investida radiante (<b>+${this.speedBuff}</b> de Velocidade, <b>+${evasionBuff}</b> de Esquiva).`,
        },
      };
    },
  },

  {
    // Ultimate
    key: "radiant_burst",
    name: "Radiant Burst",
    bf: 135,
    paralyzeDuration: 2,
    contact: false,
    damageMode: "standard",
    hitVfxPalette: "lightning",
    priority: 0,
    element: "lightning",

    isUltimate: true,
    momentumCost: 55,

    description() {
      return {
        en: `Node-SPARCKINA-07 dumps its whole charge at once, blasting the chosen target with heavy <b>Lightning magical damage</b> and leaving them <b>Paralyzed</b> for <b>${this.paralyzeDuration}</b> turn(s).`,
        pt: `Node-SPARCKINA-07 descarrega toda a sua carga de uma vez, atingindo o alvo escolhido com pesado <b>dano mágico de Relâmpago</b> e deixando-o <b>Paralisado</b> por <b>${this.paralyzeDuration}</b> turno(s).`,
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context);
      }

      return result;
    },
  },
];

export default nodeSparckina07Skills;
