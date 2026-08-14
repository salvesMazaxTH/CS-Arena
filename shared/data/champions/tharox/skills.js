import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const tharoxSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  totalBlock,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "provocação_primeva",
    name: "Provocação Primeva",
    tauntDuration: 1,
    damageReductionAmount: 10,
    damageReductionDuration: 2,
    contact: false,
    priority: 3,
    description() {
      return `Provoca todos os inimigos por ${this.tauntDuration} turno(s) e ganha ${this.damageReductionAmount} de redução de dano por ${this.damageReductionDuration} turnos. Usos consecutivos têm chance de sucesso exponencialmente menor (reset ao falhar ou usar outra habilidade).`;
    },

    targetSpec: ["self"],
    resolve({ user, targets, context = {} }) {
      user.applyDamageReduction({
        amount: this.damageReductionAmount,
        duration: this.damageReductionDuration,
        context,
      });

      user.runtime.tauntStreak ??= 0;
      /* console.log(
        `[Skill - Provocação Primeva] ${user.name} usou Provocação Primeva. Taunt Streak atual: ${user.runtime.tauntStreak}`,
      );
      */
      const chance = 1 / Math.pow(3, user.runtime.tauntStreak); // Chance diminui exponencialmente a cada uso
      const sucess = Math.random() < chance;
      /* console.log(
        `[Skill - Provocação Primeva] ${user.name} tentou Provocação Primeva. Chance: ${chance}, Sucesso?: ${sucess}`,
      );
      */
      if (!sucess) {
        user.runtime.tauntStreak = 0; // Reset streak se a provocação for mal-sucedida

        context.registerDialog({
          message: `Mas falhou.`,
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: `${formatChampionName(user)} executou <b>Provocação Primeva</b>. Mas falhou. Taunt Streak resetada.`,
        };
      }

      user.runtime.lastTauntTurn = context.currentTurn;

      if (!context.currentTurn) {
        throw new Error(
          "Context must include currentTurn for Provocação Primeva.",
        );
      }

      // se foi bem-sucedida, incrementa a tauntStreak para a próxima tentativa
      user.runtime.tauntStreak += 1;
      /* console.log(
        `[Skill - Provocação Primeva] ${user.name} usou Provocação Primeva. Taunt Streak atual: ${user.runtime.tauntStreak}`,
      );
      */
      // Get all active champions on the opposing team

      const tauntLogs = [];

      const enemyChampions = Array.from(
        context?.allChampions?.values?.() || [],
      ).filter((c) => c.team !== user.team && c.alive);

      enemyChampions.forEach((enemy) => {
        tauntLogs.push(enemy.applyTaunt(user.id, this.tauntDuration, context));
      });

      const userName = formatChampionName(user);
      // Filter out falsy (e.g., if taunt not applied)
      const logs = tauntLogs.filter(Boolean);
      logs.unshift({
        log: `${userName} executou <b>Provocação Primeva</b>. Todos os inimigos foram provocados e ${userName} recebeu ${this.damageReductionAmount} de Redução de Dano.`,
      });
      return logs;
    },
  },

  {
    key: "impacto_da_couraça",
    name: "Impacto da Couraça",
    bf: 75,
    damageMode: "standard",
    defScaling: 15,
    contact: true,
    priority: 0,
    description() {
      return `Causa dano ao inimigo somado a ${this.defScaling}% da Defesa.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage =
        (user.Attack * this.bf) / 100 + user.Defense * (this.defScaling / 100);
      const result = new DamageEvent({
        attacker: user,
        baseDamage,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return result;
    },
  },

  {
    key: "apoteose_do_monolito",
    name: "Apoteose do Monólito",

    effectDuration: 2,
    defBonusWhileShielded: 20,
    defDamagePercent: 38,

    damageMode: "standard",
    contact: false,
    momentumCost: 55,
    isUltimate: true,
    priority: 2,

    description() {
      return `Libera a Apoteose do Monólito, curando proporcionalmente à sua Defesa bônus e assumindo sua forma inamovível por ${this.effectDuration} turnos. Ganha SupremeShield pela duração do efeito.

      Enquanto o escudo estiver ativo, Tharox recebe +${this.defBonusWhileShielded} de Defesa. Ao perder o escudo, cura em 25% da sua Defesa bônus. Além disso, seus ataques passam a causar dano adicional com base na Defesa excedente, escalando de forma crescente e tornando-se devastadores em níveis altos.`;
    },

    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      const userName = formatChampionName(user);
      const expiresAtTurn = context.currentTurn + this.effectDuration;

      // Remove eventual efeito anterior da Apoteose.
      user.damageModifiers = user
        .getDamageModifiers()
        .filter((mod) => mod.id !== "apoteose-do-monolito");

      // Remove eventual SupremeShield anterior da Apoteose.
      if (Array.isArray(user.runtime?.shields)) {
        user.runtime.shields = user.runtime.shields.filter(
          (shield) => shield?.sourceId !== "apoteose-do-monolito",
        );
      }

      // Remove eventual hook anterior da Apoteose.
      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (hook) => hook.key !== "apoteose-do-monolito",
      );

      // Registra o estado da Apoteose.
      user.runtime.apoteoseDoMonolito = {
        active: true,
        expiresAtTurn,
        defenseBonus: this.defBonusWhileShielded,
      };

      // +20 Defesa enquanto o efeito estiver ativo.
      user.modifyStat({
        statName: "Defense",
        amount: this.defBonusWhileShielded,
        duration: this.effectDuration,
        context,
        isPermanent: false,
      });

      // Cura proporcional à Defesa bônus atual.
      const proportionalHeal = Math.max(0, user.Defense - user.baseDefense);

      if (proportionalHeal > 0) {
        user.heal(proportionalHeal, context, user);
      }

      // SupremeShield.
      user.addShield(1, 0, context, "supreme", {
        sourceId: "apoteose-do-monolito",
        expiresAtTurn,
      });

      // Hook da Apoteose.
      user.runtime.hookEffects.push({
        key: "apoteose-do-monolito",
        name: "Apoteose do Monólito",
        expiresAtTurn,

        // ============================================================
        // ANTES DO DANO
        // ============================================================
        // Hook destinado às interações que precisam observar a Defesa
        // bônus da Apoteose antes que o dano seja aplicado.
        hookScope: {
          onBeforeDmgTaking: "defender",
          onAfterDmgTaking: "defender",
        },

        onBeforeDmgTaking({ defender, context }) {
          if (defender !== user) return;

          const supremeShield = defender.runtime?.shields?.some(
            (shield) =>
              shield?.type === "supreme" &&
              shield?.sourceId === "apoteose-do-monolito",
          );

          if (!supremeShield) return;

          const defenseBonus = this.defBonusWhileShielded;

          return {
            // Disponibiliza explicitamente o bônus para efeitos que
            // precisem consultar a Defesa concedida pela Apoteose.
            defenseBonus,
            log: null,
          };
        },

        // ============================================================
        // DEPOIS DO DANO
        // ============================================================
        // Se o dano acabou de destruir o SupremeShield, a cura ocorre
        // imediatamente após esse dano.
        onAfterDmgTaking({ defender, damage, context }) {
          if (defender !== user) return;
          if (damage <= 0) return;

          const supremeShield = defender.runtime?.shields?.some(
            (shield) =>
              shield?.type === "supreme" &&
              shield?.sourceId === "apoteose-do-monolito",
          );

          if (supremeShield) return;

          // O shield foi quebrado por dano.
          const state = defender.runtime.apoteoseDoMonolito;
          if (!state?.active) return;

          state.brokenByDamage = true;
          state.active = false;

          const healingAmount = this.defBonusWhileShielded * 0.25;

          if (healingAmount > 0) {
            defender.heal(healingAmount, context, defender);
          }

          defender.runtime.hookEffects = defender.runtime.hookEffects.filter(
            (hook) => hook.key !== "apoteose-do-monolito",
          );

          return {
            log:
              `<b>[Apoteose do Monólito]</b> ${formatChampionName(defender)} ` +
              `perdeu o SupremeShield e curou ${Math.floor(healingAmount)} HP.`,
          };
        },

        // ============================================================
        // EXPIRAÇÃO NATURAL
        // ============================================================
        onTurnStart({ owner, context }) {
          if (context.currentTurn < this.expiresAtTurn) return;

          const state = owner.runtime.apoteoseDoMonolito;

          // Se não foi quebrado por dano, a cura ocorre no início do turno, logo depois da expiração natural.
          if (!state?.brokenByDamage) {
            const healingAmount = this.defBonusWhileShielded * 0.25;

            if (healingAmount > 0) {
              owner.heal(healingAmount, context, owner);
            }
          }

          if (state) {
            state.active = false;
          }

          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (hook) => hook.key !== "apoteose-do-monolito",
          );
        },
      });

      // =================================
      // BÔNUS DE DANO
      //=================================
      user.addDamageModifier({
        id: "apoteose-do-monolito",
        name: "Bônus de Apoteose do Monólito",
        expiresAtTurn,

        apply: ({ baseDamage, attacker }) => {
          const baseDef = attacker.baseDefense;
          const bonusDef = Math.max(0, attacker.Defense - baseDef);

          const linear = bonusDef * 0.7;

          const scaling =
            (Math.pow(bonusDef, 1.4) * this.defDamagePercent) / 100;

          return baseDamage + linear + scaling;
        },
      });

      return {
        log:
          `${userName} executou <b>Apoteose do Monólito</b>, ` +
          `liberando sua forma de guerra. ` +
          `Recebeu +${this.defBonusWhileShielded} Defesa enquanto o SupremeShield estiver ativo ` +
          `e curou ${Math.floor(proportionalHeal)} HP. ` +
          `(Defense: ${user.Defense}, HP: ${user.HP}/${user.maxHP})`,
      };
    },
  },
];

export default tharoxSkills;
