import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const theopetraSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "petrium_strike",
    name: "Petrium Strike",
    bf: 70,
    damageMode: "standard",
    contact: true,
    priority: 0,

    description() {
      return {
        en: `Theópetra closes in and strikes with her stone-forged body, dealing physical damage to the chosen target.`,
        pt: `Theópetra avança e golpeia com seu corpo forjado em pedra, causando dano físico ao alvo escolhido.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "ancestral_wall",
    name: "Ancestral Wall",

    defenseBonusPercent: 30,
    buffDuration: 2,

    contact: false,
    priority: 1,

    description() {
      return {
        en: `Theópetra plants her feet and lets the old stone answer in her place, raising her <b>Defense</b> by <b>${this.defenseBonusPercent}%</b> for <b>${this.buffDuration}</b> turn(s).`,
        pt: `Theópetra crava os pés no chão e deixa a pedra antiga responder em seu lugar, aumentando sua <b>Defesa</b> em <b>${this.defenseBonusPercent}%</b> por <b>${this.buffDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      return user.modifyStat({
        statName: "Defense",
        amount: this.defenseBonusPercent,
        duration: this.buffDuration,
        isPercent: true,
        context,
        statModifierSrc: "ancestral_wall",
      });
    },
  },

  {
    key: "earthshattering_judgment",
    name: "Earthshattering Judgment",
    bf: 85,

    damageMode: "standard",

    cannotBeEvaded: true,

    contact: false,

    isUltimate: true,
    momentumCost: 55,

    priority: 0,

    description() {
      return {
        en: `Theópetra commands the earth itself to pass judgment upon all enemies, dealing massive magical damage to them. This attack <b>cannot be evaded</b>.`,
        pt: `Theópetra convoca a própria terra para julgar todos os inimigos de uma vez, causando dano mágico devastador a todos eles. Este ataque <b>não pode ser esquivado</b>.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of targets) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(
          ...(Array.isArray(damageResult) ? damageResult : [damageResult]),
        );
      }

      return results;
    },
  },
];

export default theopetraSkills;