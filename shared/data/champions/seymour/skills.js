import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const seymourSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // H1 — Bleaching Ray
  // ========================
  {
    key: "bleaching_ray",
    name: "Bleaching Ray",

    bf: 55,
    healingReduction: 0.6,
    bleachedDuration: 2,

    contact: false,
    damageMode: "standard",
    hitVfx: "radiant_bolt",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Seymour narrows the light to a single white thread and lays it across the chosen target. Deals radiant magical damage and leaves them <b>Bleached</b> for <b>${this.bleachedDuration}</b> turns — under that light almost nothing mends, and healing they receive is cut by <b>${this.healingReduction * 100}%</b>.`,
        pt: `Seymour reduz a luz a um único fio branco e o risca sobre o alvo escolhido. Causa dano mágico radiante e deixa o alvo <b>Descolorido</b> por <b>${this.bleachedDuration}</b> turnos — sob aquela luz, quase nada cicatriza, e toda cura que ele receber é cortada em <b>${this.healingReduction * 100}%</b>.`,
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hit = Array.isArray(result) ? result[0] : result;

      if (hit?.landed) {
        enemy.runtime.hookEffects = (enemy.runtime.hookEffects ?? []).filter(
          (e) => e.key !== "bleached",
        );

        enemy.addHookEffect(
          {
            type: "debuff",
            key: "bleached",
            expiresAtTurn: context.currentTurn + this.bleachedDuration,
            healingReduction: this.healingReduction,
            hookScope: { onBeforeHealing: "healTarget" },
            onBeforeHealing({ owner, amount }) {
              if (!(amount > 0)) return;
              const reduced = Math.max(
                0,
                Math.floor(amount * (1 - this.healingReduction)),
              );
              return {
                amount: reduced,
                log: `<b>[Bleached]</b> the light lets almost nothing mend on ${formatChampionName(owner)} (${amount} → ${reduced}).`,
              };
            },
          },
          context,
        );

        context.registerDialog?.({
          message: `${formatChampionName(user)} leaves ${formatChampionName(enemy)} <b>Bleached</b> — their wounds will barely close.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return result;
    },
  },

  // ========================
  // H2 — Overexposure
  // ========================
  {
    key: "overexposure",
    name: "Overexposure",

    bf: 35,
    blindDuration: 1,

    contact: false,
    damageMode: "standard",
    hitVfx: "radiant_bolt",
    priority: 1,

    targetSpec: ["all:enemy"],

    description() {
      return {
        en: `Seymour opens his hand and lets the light flare white across the whole enemy line. Deals radiant magical damage to every enemy and leaves them <b>Blind</b> for <b>${this.blindDuration}</b> turn(s).`,
        pt: `Seymour abre a mão e deixa a luz estourar em branco sobre toda a linha inimiga. Causa dano mágico radiante a todos os inimigos e os deixa <b>Cegos</b> por <b>${this.blindDuration}</b> turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of targets) {
        if (!enemy?.alive || enemy.team === user.team) continue;

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const arr = Array.isArray(result) ? result : [result];
        results.push(...arr);

        if (effectConnected(arr[0], "blind")) {
          enemy.applyStatusEffect("blind", this.blindDuration, context, {
            sourceId: user.id,
            sourceName: user.name,
          });
        }
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Solar Meridian
  // ========================
  {
    key: "solar_meridian",
    name: "Solar Meridian",

    isUltimate: true,
    momentumCost: 55,

    bf: 110,
    setupBonus: 0.3,

    contact: false,
    damageMode: "standard",
    hitVfx: "radiant_beam",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Seymour lets the light reach its peak and brings the whole weight of it down on the chosen target. Deals heavy radiant magical damage, increased by <b>${this.setupBonus * 100}%</b> if the target is <b>Bleached</b> or <b>Blind</b>.`,
        pt: `Seymour deixa a luz atingir seu ápice e descarrega todo aquele peso sobre o alvo escolhido. Causa dano mágico radiante pesado, aumentado em <b>${this.setupBonus * 100}%</b> se o alvo estiver <b>Descolorido</b> ou <b>Cego</b>.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const primed =
        enemy.hasStatusEffect("blind") ||
        (enemy.runtime?.hookEffects ?? []).some((e) => e.key === "bleached");

      const baseDamage =
        ((user.Attack * this.bf) / 100) * (primed ? 1 + this.setupBonus : 1);

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default seymourSkills;
