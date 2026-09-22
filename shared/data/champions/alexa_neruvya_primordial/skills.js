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

    description() {
      return {
        en: `Alexa Neruvya's draconic jaw closes on the chosen target like the last thing a current ever carries, dealing <b>Water</b> physical damage. What the bite tears away does not knit back together: the target's <b>Defense</b> is reduced by <b>${this.defenseShred}</b> for <b>${this.shredDuration}</b> turn(s).`,
        pt: `A mandíbula draconiana de Alexa Neruvya se fecha sobre o alvo escolhido como a última coisa que uma correnteza ainda carrega, causando dano físico de <b>Água</b>. O que a mordida arranca não se refaz: a <b>Defesa</b> do alvo é reduzida em <b>${this.defenseShred}</b> por <b>${this.shredDuration}</b> turno(s).`,
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
      const hitSuccess = results.some((r) => r?.landed);

      if (!hitSuccess) return results;

      enemy.modifyStat({
        statName: "Defense",
        amount: -this.defenseShred,
        duration: this.shredDuration,
        context,
        statModifierSrc: user,
      });

      context.registerDialog?.({
        message: `${formatChampionName(enemy)} is torn open: -${this.defenseShred} Defense!`,
        sourceId: user.id,
        targetId: enemy.id,
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
        en: `Alexa Neruvya calls down the full judgment of the drowned age on the chosen target, dealing devastating <b>Water</b> magical damage that ignores <b>${this.piercingPercentage}%</b> of their <b>Defense</b>. No elemental resistance holds the drowned age back.`,
        pt: `Alexa Neruvya convoca o julgamento pleno da era afogada sobre o alvo escolhido, causando devastador dano mágico de <b>Água</b> que ignora <b>${this.piercingPercentage}%</b> da <b>Defesa</b> dele. Nenhuma resistência elemental detém a era afogada.`,
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
