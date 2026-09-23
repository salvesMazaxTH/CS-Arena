import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";

const UNDERTOW_MARK_KEY = "undertow_submerged";

function aoeTargets(user, targets, context) {
  const list = Array.isArray(targets) ? targets : targets ? [targets] : [];
  if (list.length) return list.filter((c) => c?.alive && c.team !== user.team);
  return (context.aliveChampions ?? []).filter((c) => c.team !== user.team);
}

const neraqaSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },

  // ========================
  // Special Abilities
  // ========================

  {
    key: "break_over_them",
    name: "Break Over Them",

    bf: 55,

    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "water",

    description() {
      return {
        en: `Neraqa lifts the sea and drops it on the enemy line at once, dealing <b>Water magical damage</b> to <b>every enemy</b>.`,
        pt: `Neraqa ergue o mar e o derruba sobre a linha inimiga de uma vez, causando <b>dano mágico de Água</b> a <b>todos os inimigos</b>.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of aoeTargets(user, targets, context)) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        if (Array.isArray(result)) results.push(...result);
        else if (result) results.push(result);
      }

      return results;
    },
  },

  {
    key: "tide_underfoot",
    name: "Tide Underfoot",

    bf: 30,
    speedReductionPercent: 20,
    speedReductionDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 2,
    element: "water",

    description() {
      return {
        en: `Neraqa lets the water rise cold around every enemy's feet, dealing <b>Water magical damage</b> to all of them and dragging their <b>Speed</b> down by <b>${this.speedReductionPercent}%</b> for <b>${this.speedReductionDuration}</b> turn(s).`,
        pt: `Neraqa deixa a água subir fria ao redor dos pés de cada inimigo, causando <b>dano mágico de Água</b> a todos eles e reduzindo sua <b>Velocidade</b> em <b>${this.speedReductionPercent}%</b> por <b>${this.speedReductionDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of aoeTargets(user, targets, context)) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const hits = Array.isArray(result) ? result : [result];
        results.push(...hits.filter(Boolean));

        if (hits.some((r) => r?.landed)) {
          enemy.modifyStat({
            statName: "Speed",
            amount: -this.speedReductionPercent,
            duration: this.speedReductionDuration,
            context,
            isPercent: true,
            statModifierSrc: user,
          });
        }
      }

      return results;
    },
  },

  {
    key: "the_undertow",
    name: "The Undertow",

    bf: 235,
    delayTurns: 2,
    piercingPercentage: 40,

    contact: false,
    damageMode: "piercing",
    isUltimate: true,
    momentumCost: 55,
    priority: 4,
    element: "water",
    hitVfx: "undertow",

    description() {
      return {
        en: `Neraqa draws the whole sea back from the field. Nothing happens where the enemies stand — not this turn, not the next — but at the close of that next turn the water she pulled away comes down on every enemy it left, dealing <b>Water magical damage</b> equal to <b>${this.bf}%</b> of her Attack and ignoring <b>${this.piercingPercentage}%</b> of their Defense: the weight of the sea does not care about armour, and it is the heaviest blow she can land. An enemy who dies or leaves before then is not there when it falls, and if Neraqa herself is gone the wave never returns.`,
        pt: `Neraqa retira o mar inteiro do campo. Nada acontece onde os inimigos estão — nem neste turno, nem no próximo — mas ao fim daquele próximo turno a água que ela retirou desaba sobre todo inimigo que ali ficou, causando <b>dano mágico de Água</b> igual a <b>${this.bf}%</b> do seu Ataque e ignorando <b>${this.piercingPercentage}%</b> da Defesa deles: o peso do mar não se importa com armadura, e é o golpe mais pesado que ela pode desferir. Um inimigo que morre ou sai antes disso não está lá quando o golpe cai, e se a própria Neraqa estiver fora de combate a onda nunca retorna.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const skillDef = this;
      const storedBaseDamage = (user.Attack * this.bf) / 100;
      const piercingPercentage = this.piercingPercentage;
      const detonateTurn = context.currentTurn + this.delayTurns;
      const marked = [];

      for (const enemy of aoeTargets(user, targets, context)) {
        enemy.runtime.hookEffects ??= [];
        enemy.runtime.hookEffects = enemy.runtime.hookEffects.filter(
          (e) => e.key !== UNDERTOW_MARK_KEY,
        );

        enemy.addHookEffect(
          {
            type: "debuff",
            key: UNDERTOW_MARK_KEY,
            name: "Submerged",
            group: "skill",
            ownerId: user.id,
            expiresAtTurn: detonateTurn + 1,
            detonateTurn,
            storedBaseDamage,
            piercingPercentage,
            skillDef,

            onTurnStart({ owner, context }) {
              if (context.currentTurn < this.detonateTurn) return;

              owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
                (e) => e !== this,
              );

              const neraqa = context.allChampions?.get?.(this.ownerId);
              if (!neraqa?.alive || !owner.alive) return;

              const result = new DamageEvent({
                baseDamage: this.storedBaseDamage,
                attacker: neraqa,
                defender: owner,
                skill: this.skillDef,
                type: "magical",
                mode: "piercing",
                piercingPercentage: this.piercingPercentage,
                context,
                allChampions: context.allChampions,
              }).execute();

              const main = Array.isArray(result) ? result[0] : result;
              const targetName = formatChampionName(owner);

              context.registerDialog?.({
                message: {
                  en: `🌊 The Undertow falls on ${targetName}!`,
                  pt: `🌊 O Refluxo cai sobre ${targetName}!`,
                },
                sourceId: neraqa.id,
                targetId: owner.id,
              });

              return {
                log: {
                  en: `<b>The Undertow</b> falls on ${targetName}.`,
                  pt: `<b>O Refluxo</b> cai sobre ${targetName}.`,
                },
              };
            },
          },
          context,
        );

        marked.push(formatChampionName(enemy));
      }

      context.registerDialog?.({
        message: {
          en: `🌊 Neraqa pulls the whole sea back — The Undertow is set on ${marked.length} enem${marked.length === 1 ? "y" : "ies"}.`,
          pt: `🌊 Neraqa retira o mar inteiro — O Refluxo é fixado em ${marked.length} inimigo${marked.length === 1 ? "" : "s"}.`,
        },
        sourceId: user.id,
        targetId: user.id,
      });

      return {
        log: {
          en: `${formatChampionName(user)} pulls the sea back from ${marked.join(", ")} — <b>The Undertow</b> is set.`,
          pt: `${formatChampionName(user)} retira o mar de ${marked.join(", ")} — <b>O Refluxo</b> é fixado.`,
        },
      };
    },
  },
];

export default neraqaSkills;
