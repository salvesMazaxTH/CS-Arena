import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import passive from "./passive.js";
import totalBlock from "../generic/totalBlock.js";

const azhkharonSkills = [
  totalBlock,

  // ========================
  // Skill 1 — basic attack
  // ========================
  {
    key: "rampart_cleave",
    name: "Rampart Cleave",
    bf: 65,
    chillDuration: 2,
    contact: true,
    damageMode: "standard",
    element: "ice",
    hitVfx: "slash",
    hitVfxPalette: "glacial",
    priority: 0,

    description() {
      return {
        en: `Azh'Kharon brings his frost-rimed blade down on the chosen target like a gate slamming shut. If the target is <b>Besieged</b>, the cold of that winter siege takes hold and leaves them <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s). Deals physical damage.`,
        pt: `Azh'Kharon desce a lâmina coberta de geada sobre o alvo escolhido como um portão batendo. Se o alvo estiver <b>Sitiado</b>, o frio daquele cerco de inverno o toma e o deixa <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s). Causa dano físico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const besieged = passive.isBesieged(user, enemy, context);

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

      if (besieged && effectConnected(arr[0], "chilled")) {
        enemy.applyStatusEffect("chilled", this.chillDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  // ========================
  // Skill 2 — taunt / defense
  // ========================
  {
    key: "desecrated_standard",
    name: "Desecrated Standard",
    defBuff: 25,
    buffDuration: 2,
    contact: false,
    priority: 3,
    tauntDuration: 1,

    description() {
      return {
        en: `Azh'Kharon plants the blackened banner of his fallen citadel and holds the line beneath it, gaining <b>+${this.defBuff}%</b> <b>Defense</b> for <b>${this.buffDuration}</b> turn(s). Every <b>Besieged</b> enemy is <b>Taunted</b> for <b>${this.tauntDuration}</b> turn.`,
        pt: `Azh'Kharon finca o estandarte enegrecido de sua cidadela caída e segura a linha sob ele, ganhando <b>+${this.defBuff}%</b> de <b>Defesa</b> por <b>${this.buffDuration}</b> turno(s). Todo inimigo <b>Sitiado</b> fica <b>Provocado</b> por <b>${this.tauntDuration}</b> turno.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const logs = [];

      user.modifyStat({
        statName: "Defense",
        amount: this.defBuff,
        duration: this.buffDuration,
        context,
        isPercent: true,
        statModifierSrc: user,
      });

      const besieged = TargetFilter.candidates(
        "enemy",
        user,
        context.aliveChampions ?? [],
      ).filter((enemy) => passive.isBesieged(user, enemy, context));

      for (const enemy of besieged) {
        const tauntLog = enemy.applyTaunt(user.id, this.tauntDuration, context);
        if (tauntLog) logs.push(tauntLog);
      }

      logs.push({
        log: {
          en: `<b>[${this.name}]</b> ${formatChampionName(user)} planted his standard, gaining +${this.defBuff}% Defense and taunting ${besieged.length} besieged enemy(ies).`,
          pt: `<b>[${this.name}]</b> ${formatChampionName(user)} fincou seu estandarte, ganhando +${this.defBuff}% de Defesa e provocando ${besieged.length} inimigo(s) sitiado(s).`,
        },
      });

      return logs;
    },
  },

  // ========================
  // Ultimate
  // ========================
  {
    key: "oath_of_the_long_winter",
    name: "Oath of the Long Winter",
    bf: 70,
    contact: false,
    damageMode: "standard",
    element: "poison",
    freezeDuration: 1,
    isUltimate: true,
    momentumCost: 55,
    poisonStacks: 2,
    priority: 0,

    description() {
      return {
        en: `Azh'Kharon speaks again the oath he made as the citadel burned, and the winter of that siege rolls over the field laced with venom. Every enemy is left <b>Poisoned</b> for <b>${this.poisonStacks}</b> stack(s), and every <b>Besieged</b> enemy is <b>Frozen</b> for <b>${this.freezeDuration}</b> turn. Deals magical damage.`,
        pt: `Azh'Kharon pronuncia de novo o juramento que fez enquanto a cidadela ardia, e o inverno daquele cerco varre o campo entremeado de veneno. Todo inimigo fica <b>Envenenado</b> por <b>${this.poisonStacks}</b> acúmulo(s), e todo inimigo <b>Sitiado</b> fica <b>Congelado</b> por <b>${this.freezeDuration}</b> turno. Causa dano mágico.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      // Read the siege before the blast lands: Kharon's own hit and poison
      // must not count as the allied pressure that besieges a target.
      const besieged = new Set(
        targets.filter((enemy) => passive.isBesieged(user, enemy, context)),
      );
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of targets) {
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

        if (effectConnected(arr[0], "poisoned")) {
          enemy.applyStatusEffect(
            "poisoned",
            undefined,
            context,
            { sourceId: user.id },
            this.poisonStacks,
          );
        }

        if (besieged.has(enemy) && effectConnected(arr[0], "frozen")) {
          enemy.applyStatusEffect("frozen", this.freezeDuration, context, {
            sourceId: user.id,
          });
        }
      }

      return results;
    },
  },
];

export default azhkharonSkills;
