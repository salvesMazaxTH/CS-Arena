import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const gryskarchuSkills = [
  // =========================
  // Total Block (global)
  // =========================

  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "earthroot",
    name: "Earthroot",
    bf: 75,
    damageMode: "standard",
    element: "earth",
    rootDuration: 2,
    contact: false,
    hitVfx: "roots",

    priority: 0,

    description() {
      return {
        en: `Gryskarchu calls the roots up through the ground beneath the chosen target, dealing <b>Earth magical damage</b> and holding them <b>Rooted</b> for <b>${this.rootDuration}</b> turn(s).`,
        pt: `Gryskarchu convoca as raízes através do solo sob o alvo escolhido, causando <b>dano mágico de Terra</b> e mantendo-o <b>Enraizado</b> por <b>${this.rootDuration}</b> turno(s).`,
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(result, "rooted")) {
        enemy.applyStatusEffect("rooted", this.rootDuration, context);
      }

      return result;
    },
  },

  {
    key: "vital_bloom",
    name: "Vital Bloom",
    healAmount: 40,
    contact: false,

    priority: 0,

    description() {
      return {
        en: `Green light opens across the field like something in bloom, restoring <b>${this.healAmount}</b> HP to Gryskarchu and every active ally.`,
        pt: `Uma luz verde se abre pelo campo como algo desabrochando, restaurando <b>${this.healAmount}</b> de HP a Gryskarchu e a todos os aliados ativos.`,
      };
    },

    targetSpec: ["all:ally"],

    resolve({ user, targets, context }) {
      let someoneHealed = false;

      for (const target of targets) {
        if (!target.alive) continue;
        if (target.team !== user.team) continue;

        new HealEvent({
          target,
          amount: this.healAmount,
          context,
          source: user,
        }).execute();
        someoneHealed = true;
      }

      return {
        log: someoneHealed
          ? {
              en: `${formatChampionName(user)} invoked Vital Bloom.`,
              pt: `${formatChampionName(user)} invocou Florescer Vital.`,
            }
          : {
              en: `${formatChampionName(user)} invoked Vital Bloom, but no one needed HP restored.`,
              pt: `${formatChampionName(user)} invocou Florescer Vital, mas ninguém precisava de HP restaurado.`,
            },
      };
    },
  },

  {
    key: "mother_earths_protection",
    name: "Mother Earth's Protection",

    defBuff: 25,
    healPercent: 30,
    buffDuration: 2,
    defDamageBonus: 35,
    contact: false,
    isUltimate: true,
    momentumCost: 55,

    priority: 5,

    description() {
      return {
        en: `Gryskarchu lays Mother Earth's own protection over the chosen ally, restoring <b>${this.healPercent}%</b> of their <b>Max HP</b>.

        For <b>${this.buffDuration}</b> turn(s), they gain <b>+${this.defBuff}%</b> <b>Defense</b>, and the ground itself carries their blows: their attacks deal <b>bonus damage</b> equal to <b>${this.defDamageBonus}%</b> of their <b>Defense</b>.`,
        pt: `Gryskarchu envolve o aliado escolhido na própria proteção da Mãe Terra, restaurando <b>${this.healPercent}%</b> de seu <b>HP Máximo</b>.

        Por <b>${this.buffDuration}</b> turno(s), ele ganha <b>+${this.defBuff}%</b> de <b>Defesa</b>, e o próprio solo carrega seus golpes: seus ataques causam <b>dano bônus</b> igual a <b>${this.defDamageBonus}%</b> de sua <b>Defesa</b>.`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      const healAmount =
        ally.maxHP * (this.healPercent / 100);

      new HealEvent({
        target: ally,
        amount: healAmount,
        context,
        source: user,
      }).execute();

      ally.modifyStat({
        statName: "Defense",
        amount: this.defBuff,
        duration: this.buffDuration,
        context,
        isPercent: true,
        statModifierSrc: user,
      });

      const bonus =
        ally.Defense * (this.defDamageBonus / 100);

      ally.damageModifiers = ally.damageModifiers.filter(
        (mod) => mod.id !== "mother_earths_protection",
      );

      ally.addDamageModifier({
        id: "mother_earths_protection",
        expiresAtTurn:
          context.currentTurn + this.buffDuration,

        apply({ baseDamage }) {
          return baseDamage + bonus;
        },
      });

      return {
        log: {
          en:
            `${formatChampionName(user)} grants ${formatChampionName(
              ally,
            )} ${healAmount} restored HP, +${this.defBuff}% Defense ` +
            `and bonus damage for ${this.buffDuration} turn(s)!`,
          pt:
            `${formatChampionName(user)} concede a ${formatChampionName(
              ally,
            )} ${healAmount} de HP restaurado, +${this.defBuff}% de Defesa ` +
            `e dano bônus por ${this.buffDuration} turno(s)!`,
        },
      };
    },
  },
];

export default gryskarchuSkills;
