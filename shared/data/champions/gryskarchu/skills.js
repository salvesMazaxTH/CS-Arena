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
    key: "lifebind",
    name: "Lifebind",
    bf: 75,
    damageMode: "standard",
    snareDuration: 2,
    contact: false,
    hitVfx: "ribbon_lash",
    hitVfxPalette: "verdant",

    priority: 0,

    description() {
      return {
        en: `Gryskarchu sends his living current into the chosen target, dealing <b>magical damage</b> and coiling around them until they are <b>Snared</b> for <b>${this.snareDuration}</b> turn(s).`,
        pt: `Gryskarchu lança sua corrente vital sobre o alvo escolhido, causando <b>dano mágico</b> e o enlaçando até deixá-lo <b>Enredado</b> por <b>${this.snareDuration}</b> turno(s).`,
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

      if (effectConnected(result, "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context);
      }

      return result;
    },
  },

  {
    key: "vital_surge",
    name: "Vital Surge",
    healAmount: 40,
    contact: false,

    priority: 0,

    description() {
      return {
        en: `A green light swells across the field, restoring <b>${this.healAmount}</b> HP to Gryskarchu and every active ally.`,
        pt: `Uma luz verde se expande pelo campo, restaurando <b>${this.healAmount}</b> de HP a Gryskarchu e a todos os aliados ativos.`,
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
              en: `${formatChampionName(user)} invoked Vital Surge.`,
              pt: `${formatChampionName(user)} invocou Onda Vital.`,
            }
          : {
              en: `${formatChampionName(user)} invoked Vital Surge, but no one needed HP restored.`,
              pt: `${formatChampionName(user)} invocou Onda Vital, mas ninguém precisava de HP restaurado.`,
            },
      };
    },
  },

  {
    key: "wardens_vigor",
    name: "Warden's Vigor",

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
        en: `Gryskarchu pours his own vitality into the chosen ally, restoring <b>${this.healPercent}%</b> of their <b>Max HP</b>.

        For <b>${this.buffDuration}</b> turn(s), they gain <b>+${this.defBuff}%</b> <b>Defense</b>, and that vitality carries their blows: their attacks deal <b>bonus damage</b> equal to <b>${this.defDamageBonus}%</b> of their <b>Defense</b>.`,
        pt: `Gryskarchu derrama a própria vitalidade no aliado escolhido, restaurando <b>${this.healPercent}%</b> de seu <b>HP Máximo</b>.

        Por <b>${this.buffDuration}</b> turno(s), ele ganha <b>+${this.defBuff}%</b> de <b>Defesa</b>, e essa vitalidade carrega seus golpes: seus ataques causam <b>dano bônus</b> igual a <b>${this.defDamageBonus}%</b> de sua <b>Defesa</b>.`,
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
        (mod) => mod.id !== "wardens_vigor",
      );

      ally.addDamageModifier({
        id: "wardens_vigor",
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
