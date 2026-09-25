import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import {
  IGNORES_REDUCTION_AT,
  MAX_PLATES,
  platesShed,
  shedPlates,
} from "./plates.js";

// The second plate is off, so nothing the target layers on softens the blow.
const ignoresReduction = (user) => platesShed(user) >= IGNORES_REDUCTION_AT;

const vornOmegaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // H1 — Sundering Reach
  // ========================
  {
    key: "sundering_reach",
    name: "Sundering Reach",

    bf: 70,
    bfPerPlate: 12,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `VØRN Ω lets the long arm fall the way a bridge falls, without hurry and without any particular malice toward what is under it. Deals physical damage equal to <b>${this.bf}%</b> of his <b>Attack</b>, plus <b>${this.bfPerPlate}%</b> for every plate he has already shed.`,
        pt: `VØRN Ω deixa o braço comprido cair como uma ponte desaba, sem pressa e sem malícia particular por aquilo que está embaixo. Causa dano físico igual a <b>${this.bf}%</b> do seu <b>Ataque</b>, mais <b>${this.bfPerPlate}%</b> para cada placa que ele já perdeu.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const bf = this.bf + this.bfPerPlate * platesShed(user);

      const result = new DamageEvent({
        baseDamage: (user.Attack * bf) / 100,
        ignoreDamageReduction: ignoresReduction(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },

  // ========================
  // H2 — Foundry Silence
  // ========================
  {
    key: "foundry_silence",
    name: "Foundry Silence",

    bf: 55,
    healBlockDuration: 2,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `VØRN Ω closes a hand around the chosen target and holds it the way his makers once held a part they had decided not to keep. Deals physical damage and afflicts them with <b>Heal Block</b> for <b>${this.healBlockDuration}</b> turns — whatever was mending them stops, the way it stopped for him.`,
        pt: `VØRN Ω fecha a mão em torno do alvo escolhido e o segura como seus criadores um dia seguraram uma peça que decidiram não manter. Causa dano físico e aflige-o com <b>Bloqueio de Cura</b> por <b>${this.healBlockDuration}</b> turnos — o que quer que o estivesse curando para, do mesmo jeito que parou para ele.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        ignoreDamageReduction: ignoresReduction(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainHit = results.find((entry) => entry?.targetId === enemy.id);

      if (effectConnected(mainHit, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Ω
  // ========================
  {
    key: "omega",
    name: "Ω",

    isUltimate: true,
    momentumCost: 55,

    bf: 87,
    bfPerPlate: 10,

    contact: true,
    damageMode: "standard",
    element: "steel",
    hitVfx: "multislash",
    ignoreAffinityResistance: true,
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `VØRN Ω opens the core he was built around, which is the one thing his makers told him never to do, and there is nobody left to tell him again. Every plate still on him comes off at once. Deals physical damage equal to <b>${this.bf}%</b> of his <b>Attack</b>, plus <b>${this.bfPerPlate}%</b> for every plate he had already thrown off before opening — a machine that waited is a heavier one. No elemental resistance turns the core aside.`,
        pt: `VØRN Ω abre o núcleo em torno do qual foi construído, a única coisa que seus criadores disseram para ele nunca fazer, e não sobrou ninguém para dizer de novo. Toda placa que ainda estava nele se solta de uma vez. Causa dano físico igual a <b>${this.bf}%</b> do seu <b>Ataque</b>, mais <b>${this.bfPerPlate}%</b> para cada placa que ele já havia perdido antes de abrir o núcleo — uma máquina que esperou é uma máquina mais pesada. Nenhuma resistência elemental desvia o núcleo.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      // Read before shedding: waiting for HP to take the plates off is what the
      // bonus pays for, so opening the core early must not earn it.
      const bf = this.bf + this.bfPerPlate * platesShed(user);

      const shed = shedPlates(user, MAX_PLATES, context);

      if (shed > 0) {
        context.registerDialog?.({
          message: `${formatChampionName(user)} opens the core — the last ${shed === 1 ? "plate goes" : `${shed} plates go`} with it.`,
          sourceId: user.id,
          targetId: user.id,
        });
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * bf) / 100,
        ignoreDamageReduction: ignoresReduction(user),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },
];

export default vornOmegaSkills;
