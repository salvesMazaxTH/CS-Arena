// shared/champions/tyren/passive.js

import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "living_metallurgy",
  name: "Living Metallurgy",

  shieldPercent: 20,
  bonusDamagePercent: 20,
  piercingPercentage: 30,

  description() {
    return {
      en: `Tyren's Living Steel adapts to the nature of the force that strikes him.

      The first time each turn he is struck, his body automatically restructures itself in response to the impact, granting a <b>Shield</b> equal to <b>${this.shieldPercent}%</b> of the damage received.

      Physical damage hardens his steel, granting a regular <b>Shield</b> and empowering his next damaging attack to deal <b>${this.bonusDamagePercent}%</b> increased damage.

      Magical damage makes his steel resonate with the incoming energy, granting a <b>Spellshield</b> and causing his next damaging ability to ignore <b>${this.piercingPercentage}%</b> of the target's <b>Defense</b>.

      Each offensive adaptation is consumed the next time Tyren deals damage.`,
      pt: `O Aço Vivo de Tyren se adapta à natureza da força que o atinge.

      Na primeira vez que é atingido a cada turno, seu corpo se reestrutura automaticamente em resposta ao impacto, concedendo um <b>Escudo</b> igual a <b>${this.shieldPercent}%</b> do dano recebido.

      Dano físico endurece seu aço, concedendo um <b>Escudo</b> comum e fortalecendo seu próximo ataque que causar dano, fazendo-o causar dano <b>${this.bonusDamagePercent}%</b> maior.

      Dano mágico faz seu aço ressoar com a energia recebida, concedendo um <b>Escudo Mágico</b> e fazendo sua próxima habilidade que causar dano ignorar <b>${this.piercingPercentage}%</b> da <b>Defesa</b> do alvo.

      Cada adaptação ofensiva é consumida na próxima vez que Tyren causar dano.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgTaking({ owner, actualDmg, type, context }) {
    if (!(actualDmg > 0)) return;

    const runtime = (owner.runtime ??= {});

    // Only the first damage instance taken each turn triggers
    // Living Metallurgy's adaptation.
    if (
      runtime.livingMetallurgyLastTriggerTurn ===
      context.currentTurn
    ) {
      return;
    }

    runtime.livingMetallurgyLastTriggerTurn =
      context.currentTurn;

    const shieldAmount = Math.floor(
      actualDmg * (this.shieldPercent / 100),
    );

    if (shieldAmount > 0) {
      if (type === "magical") {
        owner.addShield(1, 0, context, "spell");
      } else {
        owner.addShield(shieldAmount, 0, context, "regular");
      }
    }

    // Physical impact hardens Tyren's steel and empowers
    // his next damaging attack.
    if (type === "physical") {
      runtime.livingMetallurgyAdaptation = "physical";

      return {
        log: {
          en:
            `<b>[Passive — ${this.name}]</b> ` +
            `${formatChampionName(owner)}'s Living Steel hardens against the physical impact, ` +
            `forming a ${shieldAmount} HP Shield and empowering his next attack.`,
          pt:
            `<b>[Passiva — ${this.name}]</b> ` +
            `O Aço Vivo de ${formatChampionName(owner)} endurece contra o impacto físico, ` +
            `formando um Escudo de ${shieldAmount} de HP e fortalecendo seu próximo ataque.`,
        },
      };
    }

    // Magical impact causes the Living Steel to resonate
    // with the incoming energy and prepare a piercing response.
    if (type === "magical") {
      runtime.livingMetallurgyAdaptation = "magical";

      return {
        log: {
          en:
            `<b>[Passive — ${this.name}]</b> ` +
            `${formatChampionName(owner)}'s Living Steel resonates with the magical impact, ` +
            `forming a Spellshield and preparing his next damaging ability ` +
            `to pierce ${this.piercingPercentage}% of the target's Defense.`,
          pt:
            `<b>[Passiva — ${this.name}]</b> ` +
            `O Aço Vivo de ${formatChampionName(owner)} ressoa com o impacto mágico, ` +
            `formando um Escudo Mágico e preparando sua próxima habilidade de dano ` +
            `para perfurar ${this.piercingPercentage}% da Defesa do alvo.`,
        },
      };
    }

    // Other damage types still trigger the defensive adaptation,
    // but do not prepare an offensive adaptation.
    return {
      log: {
        en:
          `<b>[Passive — ${this.name}]</b> ` +
          `${formatChampionName(owner)}'s Living Steel adapts to the impact, ` +
          `forming a ${shieldAmount} HP Shield.`,
        pt:
          `<b>[Passiva — ${this.name}]</b> ` +
          `O Aço Vivo de ${formatChampionName(owner)} se adapta ao impacto, ` +
          `formando um Escudo de ${shieldAmount} de HP.`,
      },
    };
  },

  onBeforeDmgDealing({
    owner,
    damage,
    skill,
  }) {
    const adaptation =
      owner.runtime?.livingMetallurgyAdaptation;

    if (!adaptation) return;

    // The offensive adaptation is consumed by the next
    // instance of damage Tyren deals.
    owner.runtime.livingMetallurgyAdaptation = null;

    if (adaptation === "physical") {
      const newDamage =
        damage * (1 + this.bonusDamagePercent / 100);

      return {
        damage: newDamage,
        log: {
          en:
            `<b>[Passive — ${this.name}]</b> ` +
            `${formatChampionName(owner)} releases the hardened Living Steel, ` +
            `increasing the damage of ${skill?.name ?? "his attack"} by ` +
            `${this.bonusDamagePercent}%.`,
          pt:
            `<b>[Passiva — ${this.name}]</b> ` +
            `${formatChampionName(owner)} libera o Aço Vivo endurecido, ` +
            `aumentando o dano de ${skill?.name ?? "seu ataque"} em ` +
            `${this.bonusDamagePercent}%.`,
        },
      };
    }

    if (adaptation === "magical") {
      return {
        mode: "piercing",
        piercingPercentage: this.piercingPercentage,
        log: {
          en:
            `<b>[Passive — ${this.name}]</b> ` +
            `${formatChampionName(owner)} channels the stored magical resonance, ` +
            `causing ${skill?.name ?? "his ability"} to ignore ` +
            `${this.piercingPercentage}% of the target's Defense.`,
          pt:
            `<b>[Passiva — ${this.name}]</b> ` +
            `${formatChampionName(owner)} canaliza a ressonância mágica armazenada, ` +
            `fazendo ${skill?.name ?? "sua habilidade"} ignorar ` +
            `${this.piercingPercentage}% da Defesa do alvo.`,
        },
      };
    }
  },
};