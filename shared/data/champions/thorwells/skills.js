import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const thorwellsSkills = [
  // ========================
  // Basic Strike (global — charged variant)
  // ========================
  {
    ...basicStrike,
    element: "lightning",
    conductorDuration: 2,
    description() {
      return {
        en: `Thorwells makes a short offhand swing of his one-handed axe, the edge dragging a live thread of storm behind it — a plain lightning blow that deals physical damage and leaves the chosen target a <b>Conductor</b> for <b>${this.conductorDuration}</b> turn(s).`,
        pt: `Thorwells desfere um golpe curto com o machado de uma mão, a lâmina arrastando um fio vivo de tempestade atrás de si — um golpe simples de relâmpago que causa dano físico e deixa o alvo escolhido <b>Condutor</b> por <b>${this.conductorDuration}</b> turno(s).`,
      };
    },
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: this.bonusDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const resultArray = Array.isArray(result) ? result : [result];

      if (effectConnected(resultArray[0], "conductor")) {
        enemy.applyStatusEffect("conductor", this.conductorDuration, context, {
          sourceSkill: this,
        });
      }

      return resultArray;
    },
  },

  // ========================
  // Special Abilities
  // ========================

  {
    key: "skyfall_cleave",
    name: "Skyfall Cleave",
    bf: 95,
    contact: true,
    damageMode: "standard",
    hitVfxPalette: "lightning",
    priority: 0,
    element: "lightning",
    arcRatio: 0.45,

    hits: [
      { id: "cleave", type: "physical", hitVfx: "slash" },
      {
        id: "arc",
        type: "magical",
        contact: false,
        label: "Skyfall Cleave (Arc)",
      },
    ],

    description() {
      return {
        en: `Thorwells hooks the axe overhead and brings the whole weight of the sky down through it onto the chosen target — a heavy lightning blow that deals physical damage. If that target is a <b>Conductor</b>, the charge leaps: <b>${Math.round(this.arcRatio * 100)}%</b> of the blow arcs on to the other enemy holding the most current <b>HP</b>, and the Conductor mark is spent.`,
        pt: `Thorwells ergue o machado sobre a cabeça e traz todo o peso do céu através dele contra o alvo escolhido — um golpe pesado de relâmpago que causa dano físico. Se esse alvo estiver <b>Condutor</b>, a carga salta: <b>${Math.round(this.arcRatio * 100)}%</b> do golpe atinge o outro inimigo com mais <b>HP</b> atual, e a marca de Condutor é consumida.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      const wasConductor = enemy.hasStatusEffect("conductor");

      const result = SkillHits.run(this, "cleave", {
        user,
        target: enemy,
        context,
      });

      const resultArray = Array.isArray(result) ? result : [result];
      results.push(...resultArray);

      // The Conductor mark is only spent when the blow actually connects.
      if (!wasConductor || !effectConnected(resultArray[0], "conductor")) {
        return results;
      }

      enemy.removeStatusEffect("conductor");

      const candidates = context.aliveChampions.filter(
        (c) => c.team !== user.team && c.id !== enemy.id,
      );

      if (!candidates.length) return results;

      const mostHP = Math.max(...candidates.map((c) => c.HP));
      const tied = candidates.filter((c) => c.HP === mostHP);
      const arcTarget = tied[Math.floor(Math.random() * tied.length)];

      context.registerDialog({
        message: `The storm leaps off ${formatChampionName(enemy)} into ${formatChampionName(arcTarget)}!`,
        sourceId: user.id,
        targetId: arcTarget.id,
      });

      const arcResult = SkillHits.run(this, "arc", {
        user,
        target: arcTarget,
        baseDamage: baseDamage * this.arcRatio,
        context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
      });

      results.push(...(Array.isArray(arcResult) ? arcResult : [arcResult]));

      return results;
    },
  },

  {
    key: "rolling_thunder",
    name: "Rolling Thunder",
    bf: 40,
    contact: false,
    damageMode: "standard",
    hitVfxPalette: "lightning",
    priority: 1,
    element: "lightning",
    conductorDuration: 3,

    description() {
      return {
        en: `Thorwells drives the axe into the ground and a weather front rolls the length of the enemy line, striking every enemy for lightning damage and leaving each one a <b>Conductor</b> for <b>${this.conductorDuration}</b> turn(s).`,
        pt: `Thorwells crava o machado no chão e uma frente de tempestade avança por toda a linha inimiga, atingindo cada inimigo com dano de relâmpago e deixando todos <b>Condutores</b> por <b>${this.conductorDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const results = [];
      if (!enemies.length) return results;

      const baseDamage = (user.Attack * this.bf) / 100;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const resultArray = Array.isArray(result) ? result : [result];
        results.push(...resultArray.map((r) => ({ ...r, targetId: enemy.id })));

        if (effectConnected(resultArray[0], "conductor")) {
          enemy.applyStatusEffect("conductor", this.conductorDuration, context, {
            sourceSkill: this,
          });
        }
      }

      return results;
    },
  },

  {
    key: "wrath_of_the_open_sky",
    name: "Wrath of the Open Sky",
    bf: 110,
    piercingPercentage: 45,
    contact: false,
    damageMode: "standard",
    hitVfxPalette: "lightning",
    ignoreAffinityResistance: true,
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "lightning",
    speedGain: 10,

    description() {
      return {
        en: `Thorwells stops holding the sky up and lets the open weight of it fall on every enemy at once for heavy lightning damage. Each <b>Conductor</b> among them is struck as <b>Piercing</b>, ignoring <b>${this.piercingPercentage}%</b> of their <b>Defense</b>, and the mark burns out. The storm only climbs from here — Thorwells gains <b>+${this.speedGain}</b> <b>Speed</b> permanently. No elemental resistance stands under the open sky.`,
        pt: `Thorwells para de sustentar o céu e deixa todo o seu peso desabar sobre todos os inimigos ao mesmo tempo, causando pesado dano de relâmpago. Cada inimigo <b>Condutor</b> é atingido de forma <b>Perfurante</b>, ignorando <b>${this.piercingPercentage}%</b> da sua <b>Defesa</b>, e a marca se esgota. A tempestade só cresce a partir daqui — Thorwells ganha <b>+${this.speedGain}</b> de <b>Velocidade</b> permanentemente. Nenhuma resistência elemental resiste sob o céu aberto.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const results = [];
      const baseDamage = (user.Attack * this.bf) / 100;

      for (const enemy of enemies) {
        if (!enemy.alive) continue;

        const charged = enemy.hasStatusEffect("conductor");

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          ...(charged
            ? {
                mode: DamageEvent.Modes.PIERCING,
                piercingPercentage: this.piercingPercentage,
              }
            : {}),
          context,
          allChampions: context?.allChampions,
        }).execute();

        const resultArray = Array.isArray(result) ? result : [result];
        results.push(...resultArray.map((r) => ({ ...r, targetId: enemy.id })));

        if (charged && effectConnected(resultArray[0], "conductor")) {
          enemy.removeStatusEffect("conductor");
        }
      }

      user.modifyStat({
        statName: "Speed",
        amount: this.speedGain,
        context,
        isPermanent: true,
      });

      return results;
    },
  },
];

export default thorwellsSkills;
