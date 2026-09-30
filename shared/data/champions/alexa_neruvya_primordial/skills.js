import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const alexaNeruvyaPrimordialSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
  // ========================

  {
    key: "riftjaw_strike",
    name: "Riftjaw Strike",

    bf: 55,
    defenseShred: 30,
    shredDuration: 2,
    damageMode: "standard",
    contact: true,
    priority: 0,
    element: "water",
    hitVfx: "bite",
    hitVfxPalette: "water",

    description() {
      return {
        en: `Alexa Neruvya's draconic jaw closes on the chosen target like the last thing a current ever carries. What the bite tears away does not knit back together: every temporary <b>Defense</b> bonus on the target is torn off, then their <b>Defense</b> is reduced by <b>${this.defenseShred}</b> for <b>${this.shredDuration}</b> turn(s). Deals physical damage.`,
        pt: `A mandíbula draconiana de Alexa Neruvya se fecha sobre o alvo escolhido como a última coisa que uma correnteza ainda carrega. O que a mordida arranca não se refaz: todo bônus temporário de <b>Defesa</b> do alvo é arrancado, e depois a <b>Defesa</b> dele é reduzida em <b>${this.defenseShred}</b> por <b>${this.shredDuration}</b> turno(s). Causa dano físico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
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

      if (!results[0]?.landed) return results;

      // Only timed, standalone Defense bonuses; permanent and status-owned ones stay.
      const tornBonuses = enemy.statModifiers.filter(
        (modifier) =>
          modifier.statName === "Defense" &&
          modifier.amount > 0 &&
          !modifier.isPermanent &&
          !modifier.statusKey,
      );
      enemy.removeStatModifiers(tornBonuses);

      if (tornBonuses.length) {
        const count = tornBonuses.length;
        results.push({
          log: {
            en: `The bite tears ${count} Defense bonus${count === 1 ? "" : "es"} off ${formatChampionName(enemy)}.`,
            pt: `A mordida arranca ${count} bônus de Defesa de ${formatChampionName(enemy)}.`,
          },
        });
      }

      enemy.modifyStat({
        statName: "Defense",
        amount: -this.defenseShred,
        duration: this.shredDuration,
        context,
        statModifierSrc: user,
      });

      return results;
    },
  },

  {
    key: "judgment_of_the_drowned_age",
    name: "Judgment of the Drowned Age",

    bf: 95,
    damageMode: "piercing",
    ignoreAffinityResistance: true,
    piercingPercentage: 55,
    contact: false,
    element: "water",

    isUltimate: true,
    momentumCost: 27,
    priority: 0,

    description() {
      return {
        en: `Alexa Neruvya calls down the full judgment of the drowned age on the chosen target, ignoring <b>${this.piercingPercentage}%</b> of their <b>Defense</b>. No elemental resistance holds the drowned age back. Deals magical damage.`,
        pt: `Alexa Neruvya convoca o julgamento pleno da era afogada sobre o alvo escolhido, ignorando <b>${this.piercingPercentage}%</b> da <b>Defesa</b> dele. Nenhuma resistência elemental detém a era afogada. Causa dano mágico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
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

export default alexaNeruvyaPrimordialSkills;
