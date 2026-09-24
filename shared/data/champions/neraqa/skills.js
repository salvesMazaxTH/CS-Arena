import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";

const UNDERTOW_COUNTDOWN_KEY = "undertow_countdown";

// Strikes every enemy with the skill's bf; onLanded runs per enemy it landed on.
function strikeAll(skill, user, targets, context, onLanded) {
  const list = Array.isArray(targets) ? targets : targets ? [targets] : [];
  const enemies = TargetFilter.candidates(
    "enemy",
    user,
    list.length ? list : (context.aliveChampions ?? []),
  );
  const baseDamage = (user.Attack * skill.bf) / 100;
  const results = [];

  for (const enemy of enemies) {
    const result = new DamageEvent({
      baseDamage,
      attacker: user,
      defender: enemy,
      skill,
      type: "magical",
      context,
      allChampions: context.allChampions,
    }).execute();

    const hits = (Array.isArray(result) ? result : [result]).filter(Boolean);
    results.push(...hits);

    if (onLanded && hits.some((r) => r.landed)) onLanded(enemy);
  }

  return results;
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
        en: `Neraqa lifts the sea and drops it on the enemy line at once, striking <b>every enemy</b>. Deals magical damage.`,
        pt: `Neraqa ergue o mar e o derruba sobre a linha inimiga de uma vez, atingindo <b>todos os inimigos</b>. Causa dano mágico.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      return strikeAll(this, user, targets, context);
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
        en: `Neraqa lets the water rise cold around every enemy's feet, striking all of them and dragging their <b>Speed</b> down by <b>${this.speedReductionPercent}%</b> for <b>${this.speedReductionDuration}</b> turn(s). Deals magical damage.`,
        pt: `Neraqa deixa a água subir fria ao redor dos pés de cada inimigo, atingindo todos eles e reduzindo sua <b>Velocidade</b> em <b>${this.speedReductionPercent}%</b> por <b>${this.speedReductionDuration}</b> turno(s). Causa dano mágico.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      return strikeAll(this, user, targets, context, (enemy) =>
        enemy.modifyStat({
          statName: "Speed",
          amount: -this.speedReductionPercent,
          duration: this.speedReductionDuration,
          context,
          isPercent: true,
          statModifierSrc: user,
        }),
      );
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
        en: `Neraqa draws the whole sea back from the field, and a countdown on her shows how long it stays away. <b>${this.delayTurns}</b> turns later, as that turn begins, the water comes down on every enemy standing on the field at that moment, ignoring <b>${this.piercingPercentage}%</b> of their <b>Defense</b>; its weight is set by her <b>Attack</b> when she pulled the sea back, not when it falls. If Neraqa is gone before then, the wave never returns. Deals magical damage.`,
        pt: `Neraqa retira o mar inteiro do campo, e uma contagem regressiva sobre ela mostra quanto tempo ele fica longe. <b>${this.delayTurns}</b> turnos depois, logo no início do turno, a água desaba sobre todo inimigo que estiver em campo naquele momento, ignorando <b>${this.piercingPercentage}%</b> da <b>Defesa</b> deles; o peso da onda é medido pelo <b>Ataque</b> que ela tinha ao retirar o mar, não ao devolvê-lo. Se Neraqa estiver fora de combate antes disso, a onda nunca retorna. Causa dano mágico.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const skillDef = this;
      const storedBaseDamage = (user.Attack * this.bf) / 100;
      const piercingPercentage = this.piercingPercentage;
      const detonateTurn = context.currentTurn + this.delayTurns;

      const previous = user.runtime.hookEffects.filter(
        (e) => e.key === UNDERTOW_COUNTDOWN_KEY,
      );

      const placed = user.addHookEffect(
        {
          type: "buff",
          key: UNDERTOW_COUNTDOWN_KEY,
          name: "The Undertow",
          group: "skill",
          expiresAtTurn: detonateTurn + 1,
          // Turns left until the wave falls, read by the countdown indicator.
          stacks: this.delayTurns,

          onTurnStart({ owner, context }) {
            if (context.currentTurn < detonateTurn) {
              this.stacks = detonateTurn - context.currentTurn;
              return;
            }

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (e) => e !== this,
            );

            const enemies = TargetFilter.candidates(
              "enemy",
              owner,
              context.aliveChampions ?? [],
            );
            if (!enemies.length) return;

            for (const enemy of enemies) {
              new DamageEvent({
                baseDamage: storedBaseDamage,
                attacker: owner,
                defender: enemy,
                skill: skillDef,
                type: "magical",
                mode: "piercing",
                piercingPercentage,
                context,
                allChampions: context.allChampions,
              }).execute();
            }

            const names = enemies.map(formatChampionName).join(", ");

            context.registerDialog?.({
              message: {
                en: `${formatChampionName(owner)} lets the sea fall back on the whole enemy line.`,
                pt: `${formatChampionName(owner)} deixa o mar desabar de volta sobre toda a linha inimiga.`,
              },
              sourceId: owner.id,
              targetId: owner.id,
            });

            return {
              log: {
                en: `<b>The Undertow</b> comes down on ${names}.`,
                pt: `<b>O Refluxo</b> desaba sobre ${names}.`,
              },
            };
          },
        },
        context,
      );
      if (!placed) return null;

      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => !previous.includes(e),
      );

      context.registerDialog?.({
        message: {
          en: `${formatChampionName(user)} pulls the whole sea back — it returns in ${this.delayTurns} turns.`,
          pt: `${formatChampionName(user)} retira o mar inteiro — ele volta em ${this.delayTurns} turnos.`,
        },
        sourceId: user.id,
        targetId: user.id,
      });

      return [
        {
          log: {
            en: `${formatChampionName(user)} pulls the sea back from the field — <b>The Undertow</b> falls in ${this.delayTurns} turns.`,
            pt: `${formatChampionName(user)} retira o mar do campo — <b>O Refluxo</b> cai em ${this.delayTurns} turnos.`,
          },
        },
      ];
    },
  },
];

export default neraqaSkills;
