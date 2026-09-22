import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { BLEEDING_DAMAGE_PER_STACK_RATIO } from "../../statusEffects/bleeding.js";

const drexSkills = [
  totalBlock,

  {
    key: "crimson_incision",
    name: "Crimson Incision",

    bf: 35,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    hitVfxPalette: "crimson",

    bleedingStacks: 2,
    healBlockDuration: 2,

    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Deals light to moderate damage to the chosen target and applies <b>${this.bleedingStacks}</b> <b>Bleeding</b> stacks. If the target is already <b>Bleeding</b>, applies <b>1</b> additional stack. The cut will not close: the target is afflicted with <b>Heal Block</b> for <b>${this.healBlockDuration}</b> turn(s).`,
        pt: `Causa dano leve a moderado ao alvo escolhido e aplica <b>${this.bleedingStacks}</b> cargas de <b>Sangramento</b>. Se o alvo já estiver <b>Sangrando</b>, aplica <b>1</b> carga adicional. O corte, porém, não se fecha: o alvo é afligido com <b>Bloqueio de Cura</b> por <b>${this.healBlockDuration}</b> turno(s).`,
      };
    },

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

      const results = Array.isArray(result) ? result : [result];
      const mainDamage = results[0];

      if (effectConnected(mainDamage, "bleeding")) {
        const bleedStacks = enemy.hasStatusEffect("bleeding")
          ? this.bleedingStacks + 1
          : this.bleedingStacks;

        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          bleedStacks,
        );
      }

      if (effectConnected(mainDamage, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      return results;
    },
  },

  {
    key: "bloodletting",
    name: "Bloodletting",

    bf: 40,
    bleedingStacksApplied: 2,
    bonusBleedStacksIfBleeding: 1,

    contact: false,
    damageMode: "standard",
    priority: 1,
    targetSpec: ["all:enemy"],

    description() {
      return {
        en: `Deals damage to all enemies and applies <b>${this.bleedingStacksApplied}</b> <b>Bleeding</b> stacks to each, taking hold on any hit that reaches the target even when it deals no damage. If an enemy is already <b>Bleeding</b>, applies <b>${this.bonusBleedStacksIfBleeding}</b> additional stack. Each existing <b>Bleeding</b> stack also triggers an immediate instance of <b>Bleeding</b> damage without consuming the status.`,
        pt: `Causa dano a todos os inimigos e aplica <b>${this.bleedingStacksApplied}</b> cargas de <b>Sangramento</b> a cada um, pegando em qualquer golpe que alcance o alvo mesmo sem causar dano. Se um inimigo já estiver <b>Sangrando</b>, aplica <b>${this.bonusBleedStacksIfBleeding}</b> carga adicional. Cada carga de <b>Sangramento</b> já existente também dispara uma instância imediata de dano de <b>Sangramento</b> sem consumir o status.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const results = [];

      for (const enemy of targets) {
        if (!enemy?.alive) continue;

        // Deal initial damage to the enemy
        const initialDamage = new DamageEvent({
          baseDamage: (user.Attack * this.bf) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const initialResults = Array.isArray(initialDamage)
          ? initialDamage
          : [initialDamage];
        results.push(...initialResults.filter(Boolean));

        const mainDamage =
          initialResults.find((r) => r?.targetId === enemy.id) ??
          initialResults[0];

        // Reaching the target is enough — no blood need be drawn — but a whiffed
        // strike bursts no existing wounds and adds no stacks.
        if (
          !effectConnected(mainDamage, "bleeding", {
            ignoreDamageRequirement: true,
          })
        ) {
          continue;
        }

        const existingStacks =
          Number(enemy.getStatusEffect("bleeding")?.stacks) || 0;

        const tickDamage = Math.floor(
          enemy.maxHP * BLEEDING_DAMAGE_PER_STACK_RATIO,
        );

        // One instance scaled by the stacks, exactly as Bleeding's own turn
        // tick does, so replaying the wound is worth a single proc.
        if (existingStacks > 0) {
          const tickResult = new DamageEvent({
            baseDamage: tickDamage * existingStacks,
            attacker: user,
            defender: enemy,
            skill: {
              name: "Bleeding",
              key: "bleeding_tick",
            },
            type: "physical",
            mode: DamageEvent.Modes.ABSOLUTE,
            context: {
              ...context,
              isDot: true,
              allowsLifeSteal: true,
            },
            allChampions: context?.allChampions,
          }).execute();

          if (Array.isArray(tickResult)) {
            results.push(...tickResult);
          } else if (tickResult) {
            results.push(tickResult);
          }
        }

        const stacksToApply =
          this.bleedingStacksApplied +
          (existingStacks > 0 ? this.bonusBleedStacksIfBleeding : 0);

        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          stacksToApply,
        );
      }

      return results;
    },
  },

  {
    key: "hemorrhagic_eclipse",
    name: "Hemorrhagic Eclipse",

    bf: 70,
    damagePerBleedStack: 15,

    minimumBleedStacks: 5,
    stacksApplied: 2,
    shieldFromTargetMaxHpRatio: 0.245,
    shieldDecayTurns: 3,

    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    hitVfx: "arcane_bolt_big",
    hitVfxPalette: "crimson",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Deals moderate-high damage to the chosen target. Deals <b>+${this.damagePerBleedStack}%</b> bonus damage for each <b>Bleeding</b> stack on the target. If the target has fewer than <b>${this.minimumBleedStacks}</b> Bleeding stacks, applies <b>${this.stacksApplied}</b> stacks, or only enough to reach <b>${this.minimumBleedStacks}</b>. If this ability hits a target with <b>${this.minimumBleedStacks}+</b> Bleeding stacks, Drex gains a <b>shield</b> equal to <b>${this.shieldFromTargetMaxHpRatio * 100}%</b> of the target's <b>Max HP</b> for <b>${this.shieldDecayTurns}</b> turns.`,
        pt: `Causa dano moderado a alto ao alvo escolhido. Causa <b>+${this.damagePerBleedStack}%</b> de dano bônus para cada carga de <b>Sangramento</b> no alvo. Se o alvo tiver menos de <b>${this.minimumBleedStacks}</b> cargas de Sangramento, aplica <b>${this.stacksApplied}</b> cargas, ou apenas o suficiente para atingir <b>${this.minimumBleedStacks}</b>. Se esta habilidade atingir um alvo com <b>${this.minimumBleedStacks}+</b> cargas de Sangramento, Drex ganha um <b>escudo</b> igual a <b>${this.shieldFromTargetMaxHpRatio * 100}%</b> do <b>HP Máximo</b> do alvo por <b>${this.shieldDecayTurns}</b> turnos.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      let bleedStacks = Number(enemy.getStatusEffect("bleeding")?.stacks) || 0;

      // If below the minimum, apply +2 stacks or enough to reach the minimum.
      if (bleedStacks < this.minimumBleedStacks) {
        const stacksToApply = Math.min(
          this.stacksApplied,
          this.minimumBleedStacks - bleedStacks,
        );

        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          stacksToApply,
        );

        // Re-read after applying the Ultimate's Bleeding.
        bleedStacks = Number(enemy.getStatusEffect("bleeding")?.stacks) || 0;
      }

      const damageMultiplier =
        1 + (bleedStacks * this.damagePerBleedStack) / 100;

      const baseDamage = ((user.Attack * this.bf) / 100) * damageMultiplier;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainDamage = results[0];

      const dealtDamage = Number(mainDamage?.totalDamage ?? 0) > 0;

      const connected = mainDamage?.landed && dealtDamage;

      // Shield check happens AFTER the Ultimate applies its own Bleeding.
      if (connected && bleedStacks >= this.minimumBleedStacks) {
        const shieldAmount = Math.floor(
          Number(enemy?.maxHP || 0) * this.shieldFromTargetMaxHpRatio,
        );

        if (shieldAmount > 0) {
          user.addShield(shieldAmount, 0, context, "regular", {
            expiresAtTurn: context.currentTurn + this.shieldDecayTurns,
            sourceKey: this.key,
            visualVariant: "blood",
          });

          results.push({
            log: {
              en: `${formatChampionName(user)} converts the target's Bleeding into protection and gains a ${shieldAmount} HP shield.`,
              pt: `${formatChampionName(user)} converte o Sangramento do alvo em proteção e ganha um escudo de ${shieldAmount} HP.`,
            },
          });
        }
      }

      return results;
    },
  },
];

export default drexSkills;
