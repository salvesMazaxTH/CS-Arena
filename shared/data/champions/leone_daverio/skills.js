import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const leoneSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================
  {
    key: "flicker_cut",
    name: "Flicker Cut",

    bf: 70,
    bleedingStacks: 1,

    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    hitVfxPalette: "crimson",
    priority: 1,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Leone closes the gap between one heartbeat and the next, a flick of his nails opening the chosen target before they register he moved. If it lands, it applies <b>${this.bleedingStacks}</b> stack(s) of <b>Bleeding</b>. Deals physical damage.`,
        pt: `Leone cruza a distância entre uma batida do coração e a outra, e um só floreio de suas garras já abriu o alvo escolhido antes que ele perceba o movimento. Se acertar, aplica <b>${this.bleedingStacks}</b> acúmulo(s) de <b>Sangrando</b>. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedingStacks, context, {
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "jugular_bite",
    name: "Jugular Bite",

    bf: 55,
    defenseShred: 30,
    shredDuration: 2,

    contact: true,
    damageMode: "standard",
    hitVfx: "bite",
    hitVfxPalette: "crimson",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Leone is simply gone, then at the chosen target's throat, teeth sunk into the jugular before they can flinch. If it lands, it tears enough away to lower their <b>Defense</b> by <b>${this.defenseShred}</b> for <b>${this.shredDuration}</b> turn(s). Deals physical damage.`,
        pt: `Leone simplesmente some, e no instante seguinte já está na garganta do alvo escolhido, dentes cravados na jugular antes que ele consiga reagir. Se acertar, arranca o suficiente para reduzir a <b>Defesa</b> dele em <b>${this.defenseShred}</b> por <b>${this.shredDuration}</b> turno(s). Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (results[0]?.landed) {
        enemy.modifyStat({
          statName: "Defense",
          amount: -this.defenseShred,
          duration: this.shredDuration,
          context,
          statModifierSrc: user,
        });
      }

      return results;
    },
  },

  {
    key: "twilight_feast",
    name: "Twilight Feast",

    isUltimate: true,
    momentumCost: 55,

    bf: 100,

    contact: true,
    damageMode: "standard",
    hitVfx: "bite",
    hitVfxPalette: "crimson",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Leone raises an imaginary toast to the chosen target, then is at their throat before the gesture finishes, draining them dry with a hunger he stopped pretending to hide. It is always a <b>critical hit</b>. Deals physical damage.`,
        pt: `Leone ergue um brinde imaginário ao alvo escolhido, e antes de terminar o gesto já está na garganta dele, drenando-o com uma fome que já não se dá ao trabalho de esconder. É sempre um <b>acerto crítico</b>. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: { force: true },
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default leoneSkills;
