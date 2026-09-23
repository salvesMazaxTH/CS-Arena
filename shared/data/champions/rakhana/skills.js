import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const rakhanaSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================
  {
    key: "iron_lotus",
    name: "Iron Lotus",

    bf: 75,
    shieldPercent: 15,
    stunDuration: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `Strikes the chosen target with a powerful iron-infused palm, dealing <b>physical damage</b>.

        If any <b>Shield</b> is on her when this ability hits, she consumes it to <b>stun</b> the target for <b>${this.stunDuration}</b> turn and restores HP equal to <b>${this.shieldPercent}%</b> of her Max HP.

        Otherwise, she gains a <b>Shield</b> equal to <b>${this.shieldPercent}%</b> of her Max HP after dealing damage.`,
        pt: `Golpeia o alvo escolhido com uma poderosa palma revestida de ferro, causando <b>dano físico</b>.

        Se ela tiver algum <b>Escudo</b> ativo quando essa habilidade acertar, ela o consome para <b>atordoar</b> o alvo por <b>${this.stunDuration}</b> turno e restaurar HP igual a <b>${this.shieldPercent}%</b> de seu HP Máximo.

        Caso contrário, ela ganha um <b>Escudo</b> igual a <b>${this.shieldPercent}%</b> de seu HP Máximo após causar dano.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      user.runtime ??= {};
      user.runtime.shields ??= [];

      const hadShield = user.runtime.shields.length > 0;

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

      // Reflects and counter-attacks ride along in `results` aimed back at her.
      const mainResult = results.find((entry) => entry.targetId === enemy.id);

      if (!mainResult.landed) return results;

      const value = Math.floor(
        user.maxHP * (this.shieldPercent / 100),
      );

      if (hadShield) {
        user.runtime.shields.splice(0, 1);

        new HealEvent({
          target: user,
          amount: value,
          context,
          source: user,
        }).execute();

        if (effectConnected(mainResult, "stunned")) {
          enemy.applyStatusEffect("stunned", this.stunDuration, context, {
            sourceId: user.id,
          });
        }

        context.registerDialog?.({
          message: {
            en: `${formatChampionName(
              user,
            )} consumes her Iron Lotus shield, stunning ${formatChampionName(
              enemy,
            )} and restoring ${value} HP!`,
            pt: `${formatChampionName(
              user,
            )} consome o escudo de Lótus de Ferro, atordoando ${formatChampionName(
              enemy,
            )} e restaurando ${value} de HP!`,
          },
          sourceId: user.id,
          targetId: enemy.id,
        });
      } else {
        user.addShield(value, 0, context);

        context.registerDialog?.({
          message: {
            en: `${formatChampionName(user)} forms an Iron Lotus shield!`,
            pt: `${formatChampionName(user)} forma um escudo de Lótus de Ferro!`,
          },
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "silver_mirror",
    name: "Silver Mirror",

    shieldPercent: 20,
    reflectPercent: 50,
    duration: 1,

    contact: false,
    priority: 3,

    hits: [
      {
        id: "reflection",
        label: "Silver Mirror Counterattack",
        type: "physical",
        contact: false,
        damageMode: "piercing",
        piercingPercentage: 100,
        ignoreDamageReduction: true,
      },
    ],

    description() {
      return {
        en: `Rakhana enters a defensive stance and gains a <b>Shield</b> equal to <b>${this.shieldPercent}%</b> of her Max HP, half of it fading with each turn that passes.

        The first time she is struck while the Shield is active, she reduces that damage by <b>${this.reflectPercent}%</b> and reflects the prevented damage back to the attacker as physical damage.

        If the incoming attack is <b>Contact</b>, she also stuns the attacker for <b>1</b> turn.`,
        pt: `Rakhana assume uma postura defensiva e ganha um <b>Escudo</b> igual a <b>${this.shieldPercent}%</b> de seu HP Máximo, com metade dele se dissipando a cada turno que passa.

        Na primeira vez que é atingida com o Escudo ativo, ela reduz esse dano em <b>${this.reflectPercent}%</b> e reflete o dano evitado de volta ao atacante como dano físico.

        Se o ataque recebido for de <b>Contato</b>, ela também atordoa o atacante por <b>1</b> turno.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const shieldValue = Math.floor(
        user.maxHP * (this.shieldPercent / 100),
      );

      user.addShield(shieldValue, Math.ceil(shieldValue / 2), context);

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "silver_mirror_reflect",
      );

      const skill = this;
      const reflectPercent = this.reflectPercent;
      let spent = false;

      user.addHookEffect({
        type: "buff",
        key: "silver_mirror_reflect",
        expiresAtTurn: context.currentTurn + this.duration,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        name: "Silver Mirror (Reflection)",

        onBeforeDmgTaking({
          defender,
          attacker,
          damage,
          contact,
          context,
        }) {
          if (context.damageDepth > 0 || spent) return;

          const shieldActive =
            Array.isArray(defender.runtime?.shields) &&
            defender.runtime.shields.length > 0;

          if (!shieldActive) return;

          spent = true;

          const reflectedDamage = Math.floor(damage * (reflectPercent / 100));
          const reducedDamage = damage - reflectedDamage;

          context.registerDialog?.({
            message: {
              en: `<b>[${this.name}]</b> ${formatChampionName(
                defender,
              )} reflects ${reflectedDamage} damage back to ${formatChampionName(
                attacker,
              )}!`,
              pt: `<b>[${this.name}]</b> ${formatChampionName(
                defender,
              )} reflete ${reflectedDamage} de dano de volta em ${formatChampionName(
                attacker,
              )}!`,
            },
            sourceId: defender.id,
            targetId: attacker.id,
          });

          context.extraDamageQueue.push({
            ...SkillHits.params(skill, "reflection", {
              user: defender,
              target: attacker,
              baseDamage: reflectedDamage,
              context,
            }),

            dialog: {
              message: {
                en: `${formatChampionName(defender)} reflects damage with ${this.name}!`,
                pt: `${formatChampionName(defender)} reflete dano com ${this.name}!`,
              },
              duration: 1000,
            },
          });

          // If the incoming attack was a contact skill, stun the attacker
          if (contact) {
            attacker.applyStatusEffect("stunned", 1, context);

            context.registerDialog?.({
              message: {
                en: `${formatChampionName(
                  defender,
                )} stuns ${formatChampionName(
                  attacker,
                )} with the mirror's reflection!`,
                pt: `${formatChampionName(
                  defender,
                )} atordoa ${formatChampionName(
                  attacker,
                )} com o reflexo do espelho!`,
              },
              sourceId: defender.id,
              targetId: attacker.id,
            });
          }

          return {
            damage: reducedDamage,
            log: {
              en: `<b>[${this.name}]</b> ${formatChampionName(
                defender,
              )} reduces incoming damage by ${reflectPercent}% and reflects ${reflectedDamage} damage!`,
              pt: `<b>[${this.name}]</b> ${formatChampionName(
                defender,
              )} reduz o dano recebido em ${reflectPercent}% e reflete ${reflectedDamage} de dano!`,
            },
          };
        },
      }, context);

      context.registerDialog?.({
        message: {
          en: `${formatChampionName(user)} enters a defensive stance with the Silver Mirror!`,
          pt: `${formatChampionName(user)} assume uma postura defensiva com o Espelho de Prata!`,
        },
        sourceId: user.id,
      });

      return [
        {
          log: {
            en: `<b>${formatChampionName(
              user,
            )}</b> activates <b>${this.name}</b>, gaining a ${shieldValue} HP shield!`,
            pt: `<b>${formatChampionName(
              user,
            )}</b> ativa <b>${this.name}</b>, ganhando um escudo de ${shieldValue} de HP!`,
          },
        },
      ];
    },
  },

  {
    key: "heaven_splitting_descent",
    name: "Heaven-Splitting Descent",

    bf: 115,
    contact: true,
    damageMode: "piercing",

    piercingPercentage: 50,

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    missingHpPercent: 0.25,
    threshold: 0.35,

    description() {
      return {
        en: `Rakhana descends upon the chosen target with overwhelming force, dealing <b>physical damage</b> and ignoring <b>${this.piercingPercentage}%</b> of their Defense.

        If the target is below <b>${this.threshold * 100}%</b> HP, deals bonus damage equal to <b>${this.missingHpPercent * 100}%</b> of their missing HP.`,
        pt: `Rakhana desce sobre o alvo escolhido com força avassaladora, causando <b>dano físico</b> e ignorando <b>${this.piercingPercentage}%</b> de sua Defesa.

        Se o alvo estiver abaixo de <b>${this.threshold * 100}%</b> de HP, causa dano bônus igual a <b>${this.missingHpPercent * 100}%</b> de seu HP faltante.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const belowThreshold = enemy.HP / enemy.maxHP < this.threshold;
      const executeBonus = belowThreshold
        ? (enemy.maxHP - enemy.HP) * this.missingHpPercent
        : 0;

      const result = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        bonusDamage: executeBonus,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },
];

export default rakhanaSkills;
