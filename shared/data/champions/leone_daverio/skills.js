import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const leoneSkills = [
  totalBlock,

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
        en: `Leone closes the gap between one heartbeat and the next, a flick of his nails opening the chosen target before they register he moved. Deals <b>physical damage</b> and leaves them <b>Bleeding</b> for <b>${this.bleedingStacks}</b> acúmulo(s).`,
        pt: `Leone cruza a distância entre uma batida do coração e a outra, e um só floreio de suas garras já abriu o alvo escolhido antes que ele perceba o movimento. Causa <b>dano físico</b> e o deixa <b>Sangrando</b> por <b>${this.bleedingStacks}</b> acúmulo(s).`,
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

      if (effectConnected(result, "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedingStacks, context, {
          sourceId: user.id,
        });
      }

      return result;
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
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Leone is simply gone, then at the chosen target's throat, teeth sunk into the jugular before they can flinch. Deals <b>physical damage</b> and tears enough away to lower their <b>Defense</b> by <b>${this.defenseShred}</b> for <b>${this.shredDuration}</b> turn(s).`,
        pt: `Leone simplesmente some, e no instante seguinte já está na garganta do alvo escolhido, dentes cravados na jugular antes que ele consiga reagir. Causa <b>dano físico</b> e arranca o suficiente para reduzir a <b>Defesa</b> dele em <b>${this.defenseShred}</b> por <b>${this.shredDuration}</b> turno(s).`,
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

      const arr = Array.isArray(result) ? result : [result];

      if (arr[0]?.landed) {
        enemy.modifyStat({
          statName: "Defense",
          amount: -this.defenseShred,
          duration: this.shredDuration,
          context,
          statModifierSrc: user,
        });
      }

      return arr;
    },
  },

  {
    key: "twilight_feast",
    name: "Twilight Feast",

    bf: 100,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Leone raises an imaginary toast to the chosen target, then is at their throat before the gesture finishes, draining them dry with a hunger he stopped pretending to hide. Deals <b>physical damage</b> and is always a <b>critical hit</b>.`,
        pt: `Leone ergue um brinde imaginário ao alvo escolhido, e antes de terminar o gesto já está na garganta dele, drenando-o com uma fome que já não se dá ao trabalho de esconder. Causa <b>dano físico</b> e é sempre um <b>acerto crítico</b>.`,
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
