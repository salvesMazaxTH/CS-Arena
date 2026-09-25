import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import basicShot from "../generic/basicShot.js";

const vulnaraSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "physical", hitVfx: "flaming_arrow" },

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Predatory Instincts
  // ========================
  {
    key: "predatory_instincts",
    name: "Predatory Instincts",

    critBuff: 30,
    speedBuff: 15,
    duration: 3,

    contact: false,
    priority: 2,

    description() {
      return {
        en: `Vulnara goes still and lets the hunter take over, her eye settling on every opening at once as her legs coil beneath her: she gains <b>+${this.critBuff}%</b> <b>Critical</b> and <b>+${this.speedBuff}</b> <b>Speed</b> for <b>${this.duration}</b> turn(s).`,
        pt: `Vulnara fica imóvel e deixa a caçadora assumir, o olhar se fixando em cada brecha ao mesmo tempo que as pernas se recolhem sob ela: ela ganha <b>+${this.critBuff}%</b> de <b>Crítico</b> e <b>+${this.speedBuff}</b> de <b>Velocidade</b> por <b>${this.duration}</b> turno(s).`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Critical",
        amount: this.critBuff,
        duration: this.duration,
        context,
      });

      user.modifyStat({
        statName: "Speed",
        amount: this.speedBuff,
        duration: this.duration,
        context,
      });

      return {
        log: `${formatChampionName(user)} sharpens her instincts, gaining +${this.critBuff}% Critical and +${this.speedBuff} Speed for ${this.duration} turn(s)!`,
      };
    },
  },

  // ========================
  // H2 — Rain of Burning Arrows
  // ========================
  {
    key: "rain_of_burning_arrows",
    name: "Rain of Burning Arrows",

    bf: 40,
    burnChance: 0.15,
    burnDuration: 2,

    damageMode: "standard",
    contact: false,
    priority: 0,
    element: "fire",
    hitVfx: "flaming_arrow",

    description() {
      return {
        en: `Vulnara looses a rain of burning arrows over the whole field, dealing Fire physical damage to every enemy. Each arrow that lands has a <b>${this.burnChance * 100}%</b> chance of setting its target <b>Burning</b> for <b>${this.burnDuration}</b> turn(s).`,
        pt: `Vulnara solta uma chuva de flechas em chamas sobre todo o campo, causando dano físico de Fogo em cada inimigo. Cada flecha que acerta tem <b>${this.burnChance * 100}%</b> de chance de deixar seu alvo <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      // Get all enemies
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      // Deal damage to each enemy
      for (const enemy of enemies) {
        const rawDamageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const damageResults = Array.isArray(rawDamageResult)
          ? rawDamageResult
          : [rawDamageResult];

        const mainDamage = damageResults[0];

        // Apply Burning if the hit connects and the roll succeeds.
        if (
          effectConnected(mainDamage, "burning") &&
          Math.random() < this.burnChance
        ) {
          enemy.applyStatusEffect("burning", this.burnDuration, context);
        }

        results.push(...damageResults);
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Hail of Fire Arrows
  // ========================
  {
    key: "hail_of_fire_arrows",
    name: "Hail of Fire Arrows",

    element: "fire",
    bf: 45,

    contact: false,
    damageMode: "standard",
    hitVfx: "flaming_arrow",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    arrows: 3,
    burnDuration: 2,

    description() {
      return {
        en: `Vulnara draws and looses <b>${this.arrows}</b> arrows before the first one lands, all of them burning, all of them on the chosen target. Each arrow rolls for a <b>critical hit</b> on its own, and every arrow that lands sets its target <b>Burning</b> for <b>${this.burnDuration}</b> turn(s).`,
        pt: `Vulnara saca e dispara <b>${this.arrows}</b> flechas antes mesmo da primeira acertar, todas em chamas, todas no alvo escolhido. Cada flecha rola seu próprio <b>acerto crítico</b>, e toda flecha que acerta deixa o alvo <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (let i = 0; i < this.arrows; i++) {
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

        const hitResults = Array.isArray(result) ? result : [result];
        const mainDamage = hitResults[0];

        if (effectConnected(mainDamage, "burning")) {
          enemy.applyStatusEffect("burning", this.burnDuration, context);
        }

        results.push(...hitResults);
      }

      return results;
    },
  },
];

export default vulnaraSkills;