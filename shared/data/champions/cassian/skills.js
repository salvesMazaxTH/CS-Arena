import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const cassianSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  // ========================
  // H1 — Living Blood
  // ========================
  {
    key: "living_blood",
    name: "Living Blood",

    shieldRatio: 0.45,
    damageReduction: 10,
    damageReductionDuration: 2,
    attackBuff: 45,
    critBuff: 20,
    buffDuration: 2,

    contact: false,
    priority: 2,

    description(champion) {
      if (champion?.runtime?.cassianForm === "offense") {
        return {
          en: `Cassian's blood thickens along his forearms into a razor edge: he gains <b>+${this.attackBuff} Attack</b> and <b>+${this.critBuff}% Critical</b> for <b>${this.buffDuration}</b> turn(s).`,
          pt: `O sangue de Cassian se espessa ao longo dos antebraços até virar um fio de lâmina: ele ganha <b>+${this.attackBuff} de Ataque</b> e <b>+${this.critBuff}% de Crítico</b> por <b>${this.buffDuration}</b> turno(s).`,
        };
      }

      return {
        en: `Cassian calls his own blood to the surface, wrapping himself in a living, physical aura of protection: he gains a <b>Shield</b> worth <b>${this.shieldRatio * 100}%</b> of his <b>Defense</b> and reduces the damage he takes by <b>${this.damageReduction}%</b> for <b>${this.damageReductionDuration}</b> turn(s).`,
        pt: `Cassian chama o próprio sangue à superfície, envolvendo-se numa aura física e viva de proteção: ele ganha um <b>Escudo</b> equivalente a <b>${this.shieldRatio * 100}%</b> de sua <b>Defesa</b> e reduz o dano que sofre em <b>${this.damageReduction}%</b> por <b>${this.damageReductionDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      if (user.runtime?.cassianForm === "offense") {
        user.modifyStat({
          statName: "Attack",
          amount: this.attackBuff,
          duration: this.buffDuration,
          context,
        });

        user.modifyStat({
          statName: "Critical",
          amount: this.critBuff,
          duration: this.buffDuration,
          context,
        });

        return {
          log: {
            en: `${formatChampionName(user)} sharpens his blood claws, gaining +${this.attackBuff} Attack and +${this.critBuff}% Critical for ${this.buffDuration} turn(s)!`,
            pt: `${formatChampionName(user)} afia as garras de sangue, ganhando +${this.attackBuff} de Ataque e +${this.critBuff}% de Crítico por ${this.buffDuration} turno(s)!`,
          },
        };
      }

      const shieldAmount = Math.round(user.Defense * this.shieldRatio);
      user.addShield(shieldAmount, 0, context, "regular", {
        visualVariant: "blood",
      });

      user.applyDamageReduction({
        amount: this.damageReduction,
        duration: this.damageReductionDuration,
        type: "percent",
        source: this.key,
        context,
      });

      return {
        log: {
          en: `${formatChampionName(user)} wraps himself in living blood armor, gaining a ${shieldAmount}-point shield and ${this.damageReduction}% damage reduction for ${this.damageReductionDuration} turn(s)!`,
          pt: `${formatChampionName(user)} se envolve em armadura de sangue vivo, ganhando ${shieldAmount} pontos de escudo e ${this.damageReduction}% de redução de dano por ${this.damageReductionDuration} turno(s)!`,
        },
      };
    },
  },

  // ========================
  // H2 — Blood Lash
  // ========================
  {
    key: "blood_lash",
    name: "Blood Lash",

    defenseBf: 30,
    offenseBf: 55,
    slowAmount: 20,
    slowDuration: 2,
    bleedDuration: 2,

    damageMode: "standard",
    hitVfxPalette: "crimson",
    priority: 0,

    description(champion) {
      if (champion?.runtime?.cassianForm === "offense") {
        return {
          en: `Cassian's hand hardens into a claw and tears into the target, dealing <b>physical damage</b> and setting them <b>Bleeding</b> for <b>${this.bleedDuration}</b> turn(s).`,
          pt: `A mão de Cassian endurece em garra e rasga o alvo, causando <b>dano físico</b> e deixando-o <b>Sangrando</b> por <b>${this.bleedDuration}</b> turno(s).`,
        };
      }

      return {
        en: `A whip of living blood lashes out from Cassian's hand, dealing <b>magical damage</b> and slowing the target by <b>${this.slowAmount} Speed</b> for <b>${this.slowDuration}</b> turn(s).`,
        pt: `Um chicote de sangue vivo dispara da mão de Cassian, causando <b>dano mágico</b> e reduzindo em <b>${this.slowAmount}</b> a <b>Velocidade</b> do alvo por <b>${this.slowDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const isOffense = user.runtime?.cassianForm === "offense";
      const bf = isOffense ? this.offenseBf : this.defenseBf;
      const baseDamage = (user.Attack * bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: isOffense ? "physical" : "magical",
        contact: isOffense,
        hitVfx: isOffense ? null : "lash",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hitResults = Array.isArray(result) ? result : [result];
      const mainDamage = hitResults[0];

      if (isOffense) {
        if (effectConnected(mainDamage, "bleeding")) {
          enemy.applyStatusEffect("bleeding", this.bleedDuration, context);
        }
      } else if (mainDamage?.landed) {
        enemy.modifyStat({
          statName: "Speed",
          amount: -this.slowAmount,
          duration: this.slowDuration,
          context,
          statModifierSrc: user,
        });
      }

      return hitResults;
    },
  },

  // ========================
  // Ultimate — Turn of the Tide
  // ========================
  {
    key: "turn_of_the_tide",
    name: "Turn of the Tide",

    bf: 65,
    bonusDamage: 60,
    bleedDuration: 3,
    shieldRatio: 0.5,

    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 1,

    description(champion) {
      if (champion?.runtime?.cassianForm !== "offense") {
        return {
          en: `Cassian forces the tide early, his blood exploding outward into claws: he deals <b>magical damage</b> to the target with <b>${this.bonusDamage}</b> bonus damage and sets them <b>Bleeding</b> for <b>${this.bleedDuration}</b> turn(s), immediately turning to <b>offense</b>.`,
          pt: `Cassian força a maré antes da hora, seu sangue explodindo para fora em garras: causa <b>dano mágico</b> ao alvo com <b>${this.bonusDamage}</b> de dano bônus e o deixa <b>Sangrando</b> por <b>${this.bleedDuration}</b> turno(s), virando imediatamente para <b>ofensiva</b>.`,
        };
      }

      return {
        en: `Cassian forces the tide early, calling his blood back into a living shield: he deals <b>physical damage</b> to the target, and if the strike lands, gains a <b>Shield</b> worth <b>${this.shieldRatio * 100}%</b> of his <b>Max HP</b>, immediately turning to <b>defense</b>.`,
        pt: `Cassian força a maré antes da hora, chamando o sangue de volta num escudo vivo: causa <b>dano físico</b> ao alvo e, se o golpe acertar, ganha um <b>Escudo</b> equivalente a <b>${this.shieldRatio * 100}%</b> de seu <b>HP Máximo</b>, virando imediatamente para <b>defesa</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const enteringOffense = user.runtime?.cassianForm !== "offense";
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: enteringOffense ? "magical" : "physical",
        contact: !enteringOffense,
        bonusDamage: enteringOffense ? this.bonusDamage : 0,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hitResults = Array.isArray(result) ? result : [result];
      const mainDamage = hitResults[0];

      if (enteringOffense) {
        if (effectConnected(mainDamage, "bleeding")) {
          enemy.applyStatusEffect("bleeding", this.bleedDuration, context);
        }
      } else if (mainDamage?.landed) {
        const shieldAmount = Math.round(user.maxHP * this.shieldRatio);
        user.addShield(shieldAmount, 0, context, "regular", {
          visualVariant: "blood",
        });
      }

      user.passive.flipForm(user, context);

      return hitResults;
    },
  },
];

export default cassianSkills;
