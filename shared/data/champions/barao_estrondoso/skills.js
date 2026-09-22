import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const baraoEstrondosoSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "steel_impact",
    name: "Steel Impact",
    bf: 100,
    contact: true,
    damageMode: "standard",
    priority: -999,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `The Barão hurls his full weight behind a single blow, driving it into the chosen target.`,
        pt: `O Barão arremessa todo o seu peso atrás de um único golpe, cravando-o no alvo escolhido.`,
      };
    },

    resolve({ user, targets, context = {} }) {
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
    key: "reinforced_plating",
    name: "Reinforced Plating",
    contact: false,

    priority: -999,
    defenseBuff: 20,
    defBuffDuration: 2,

    description() {
      return {
        en: `The Barão braces the core and thickens his hull, gaining <b>+${this.defenseBuff}</b> <b>Defense</b> for <b>${this.defBuffDuration}</b> turn(s).`,
        pt: `O Barão reforça o núcleo e engrossa seu casco, ganhando <b>+${this.defenseBuff}</b> de <b>Defesa</b> por <b>${this.defBuffDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.reinforcedPlatingUntilTurn =
        context.currentTurn + this.defBuffDuration;

      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBuff,
        duration: this.defBuffDuration,
        context,
      });

      return {
        log: `${formatChampionName(user)} reinforced his plating!`,
      };
    },
  },

  {
    key: "super_hyper_ultra_mega_atomic_belly_flop",
    name: "Super Hyper Ultra Mega Atomic Belly Flop",
    bf: 730,
    contact: true,
    damageMode: "standard",
    priority: -999,

    isUltimate: true,
    momentumCost: 90,

    description() {
      return {
        en: `Deals ABSURD damage to the chosen target plus all <b>Stored Damage</b>. This attack is always a <b>Critical Hit</b>. After the attack, <b>Stored Damage</b> is reset to <b>0</b>.`,
        pt: `Causa dano ABSURDO ao alvo escolhido mais todo o <b>Dano Armazenado</b>. Este ataque é sempre um <b>Acerto Crítico</b>. Após o ataque, o <b>Dano Armazenado</b> é zerado.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const storedDamage = user.runtime?.storedDamage || 0;
      const baseDamage = (user.Attack * this.bf) / 100 + storedDamage;

      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: { force: true },
        allChampions: context?.allChampions,
      }).execute();

      // Resets Stored Damage after the attack
      user.runtime.storedDamage = 0;

      return damageResult;
    },
  },
];

export default baraoEstrondosoSkills;
