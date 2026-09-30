import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const yresaPetronikaPrimordialSkills = [
  totalBlock,

  {
    key: "tremorfall",
    name: "Tremorfall",

    bf: 55,
    contact: false,
    damageMode: "standard",
    element: "earth",
    hitVfx: "earth_slam",
    priority: 0,

    description() {
      return {
        en: `Yrêsa Petroníka's true form slams the ground flat, sending the shock through <b>every enemy</b> on the field. Deals physical damage.`,
        pt: `A forma verdadeira de Yrêsa Petroníka esmaga o chão, mandando o tranco por <b>todos os inimigos</b> no campo. Causa dano físico.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      return targets
        .flatMap((enemy) =>
          new DamageEvent({
            baseDamage: (user.Attack * this.bf) / 100,
            attacker: user,
            defender: enemy,
            skill: this,
            type: "physical",
            context,
            allChampions: context?.allChampions,
          }).execute(),
        )
        .filter(Boolean);
    },
  },

  {
    key: "bulwark_of_ore",
    name: "Bulwark of Ore",

    defenseBonusPercent: 35,
    duration: 2,

    contact: false,
    priority: 0,

    description() {
      return {
        en: `The true form draws the surrounding ore into herself, raising her <b>Defense</b> by <b>${this.defenseBonusPercent}%</b> for <b>${this.duration}</b> turn(s), or until she leaves this form.`,
        pt: `A forma verdadeira puxa para dentro de si o minério ao redor, aumentando sua <b>Defesa</b> em <b>${this.defenseBonusPercent}%</b> por <b>${this.duration}</b> turno(s), ou até ela deixar esta forma.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      // Capped at the revert, so the ore goes back into the ground with the form.
      const revertAtTurn = user.runtime.transformation?.revertAtTurn;
      const duration = revertAtTurn
        ? Math.min(this.duration, revertAtTurn - context.currentTurn)
        : this.duration;

      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBonusPercent,
        isPercent: true,
        duration,
        context,
        statModifierSrc: "yresa_petronika_primordial_bulwark_of_ore",
      });

      return {
        log: {
          en: `${formatChampionName(user)} draws the surrounding ore into herself, raising her Defense.`,
          pt: `${formatChampionName(user)} puxa o minério ao redor para dentro de si, aumentando sua Defesa.`,
        },
      };
    },
  },

  {
    key: "the_weight_she_set_aside",
    name: "The Weight She Set Aside",

    bf: 120,
    cannotMiss: true,

    contact: false,
    damageMode: "standard",
    element: "earth",
    hitVfx: "earth_slam_big",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `Yrêsa Petroníka's true form puts back on every ounce she had been carrying lightly, and the ground gives under it. Strikes <b>every enemy</b> and <b>cannot miss</b>. Deals magical damage.`,
        pt: `A forma verdadeira de Yrêsa Petroníka para de carregar o próprio peso como se não fosse nada — e quando ele volta todo de uma vez, o chão inteiro afunda. O impacto alcança <b>todos os inimigos</b> e <b>não pode errar</b>. Causa dano mágico.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      return targets
        .flatMap((enemy) =>
          new DamageEvent({
            baseDamage: (user.Attack * this.bf) / 100,
            attacker: user,
            defender: enemy,
            skill: this,
            type: "magical",
            context,
            allChampions: context?.allChampions,
          }).execute(),
        )
        .filter(Boolean);
    },
  },
];

export default yresaPetronikaPrimordialSkills;
