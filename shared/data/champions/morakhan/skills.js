import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import basicStrike from "../generic/basicStrike.js";

const morakhanSkills = [
  basicStrike,

  {
    key: "second_sutra_mantra_of_living_iron",
    name: "Second Sutra: Mantra of Living Iron",
    shieldPercent: 45,
    contact: false,
    priority: 3,

    description() {
      return {
        en: `During this turn, the first time he is struck he gains a shield equal to <b>${this.shieldPercent}%</b> of the damage taken.`,
        pt: `Durante este turno, na primeira vez em que é atingido, ganha um Shield equivalente a <b>${this.shieldPercent}%</b> do dano sofrido.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, targets, context = {} }) {
      const shieldPercent = this.shieldPercent;
      let spent = false;

      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "mantra_of_living_iron_shield",
      );

      user.addHookEffect(
        {
          type: "buff",
          hookScope: {
            onAfterDmgTaking: "defender",
          },
          key: "mantra_of_living_iron_shield",
          expiresAtTurn: context.currentTurn + 1,
          name: "Mantra of Living Iron (Protection)",

          onAfterDmgTaking({ defender, actualDmg, context }) {
            if (spent || !(actualDmg > 0)) return;
            spent = true;

            const shieldAmount = Math.floor(actualDmg * (shieldPercent / 100));

            defender.addShield(shieldAmount, 0, context);

            return {
              log: {
                en: `<b>[${this.name}]</b> ${formatChampionName(
                  defender,
                )} gained a <b>${shieldAmount}</b> HP shield (<b>${shieldPercent}%</b> of the damage taken)!`,
                pt: `<b>[${this.name}]</b> ${formatChampionName(
                  defender,
                )} ganhou um Shield de <b>${shieldAmount}</b> HP (<b>${shieldPercent}%</b> do dano sofrido)!`,
              },
            };
          },
        },
        context,
      );

      context.registerDialog({
        message: {
          en: `${formatChampionName(user)} recites the <b>${this.name}</b>.`,
          pt: `${formatChampionName(user)} recita o <b>${this.name}</b>.`,
        },
        sourceId: user.id,
      });

      return {
        log: {
          en: `${formatChampionName(user)} braces behind the <b>${this.name}</b>: the first blow this turn feeds a shield.`,
          pt: `${formatChampionName(user)} se resguarda com o <b>${this.name}</b>: o primeiro golpe deste turno alimenta um Shield.`,
        },
      };
    },
  },

  {
    key: "third_sutra_blessing_of_the_mountain_god",
    name: "Third Sutra: Blessing of the Mountain God",

    contact: false,
    priority: 2,

    duration: 1,
    dmgReduct: 20,

    description() {
      return {
        en: `During this turn, Morakhan and all allies become immune to crowd control and gain <b>${this.dmgReduct}%</b> damage reduction.`,
        pt: `Durante este turno, Morakhan e todos os aliados ficam imunes a controle de grupo e ganham <b>${this.dmgReduct}%</b> de redução de dano.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);

      for (const ally of allies) {
        ally.applyDamageReduction({
          amount: this.dmgReduct,
          duration: this.duration,
          source: this.key,
          type: "percent",
          context,
        });

        ally.runtime ??= {};
        ally.runtime.hookEffects ??= [];

        ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
          (e) => e.key !== "blessing_of_the_mountain_god_cc",
        );

        ally.addHookEffect(
          {
            type: "buff",
            key: "blessing_of_the_mountain_god_cc",
            expiresAtTurn: context.currentTurn + this.duration,

            hookScope: {
              onStatusEffectIncoming: "target",
            },

            onStatusEffectIncoming({ target, statusEffect }) {
              if (!statusEffect?.subtypes) return;

              if (
                statusEffect.subtypes.includes("hardCC") ||
                statusEffect.subtypes.includes("softCC")
              ) {
                return {
                  cancel: true,
                  message: {
                    en: `${formatChampionName(
                      target,
                    )} is under the Blessing of the Mountain God and is immune to crowd control!`,
                    pt: `${formatChampionName(
                      target,
                    )} está sob a Bênção do Deus da Montanha e é imune a controle de grupo!`,
                  },
                };
              }
            },
          },
          context,
        );
      }

      context.registerDialog({
        message: {
          en: `${formatChampionName(
            user,
          )} invokes the Blessing of the Mountain God, protecting his allies!`,
          pt: `${formatChampionName(
            user,
          )} invoca a Bênção do Deus da Montanha, protegendo seus aliados!`,
        },
        sourceId: user.id,
      });

      return [
        {
          log: {
            en: `<b>${formatChampionName(
              user,
            )}</b> grants <b>${this.name}</b> to all allies!`,
            pt: `<b>${formatChampionName(
              user,
            )}</b> concede <b>${this.name}</b> a todos os aliados!`,
          },
        },
      ];
    },
  },

  {
    key: "fourth_sutra_mountain_stance",
    name: "Fourth Sutra: Mountain Stance",
    contact: false,

    isUltimate: true,
    momentumCost: 48,

    reflectPercent: 50,
    dmgReduct: 60,

    hits: [
      {
        id: "reflection",
        label: "Mountain Stance Counterattack",
        type: "magical",
        contact: false,
        damageMode: "piercing",
        piercingPercentage: 100,
        ignoreDamageReduction: true,
      },
    ],

    description() {
      return {
        en: `Unleashes Mountain Stance. During this turn:
        Becomes immune to crowd control.
        Reflects <b>${this.reflectPercent}%</b> of all damage taken from abilities.
        Gains an additional <b>${this.dmgReduct}%</b> damage reduction.`,
        pt: `Desencadeia a Postura da Montanha. Durante este turno:
        Fica imune a controle de grupo.
        Reflete <b>${this.reflectPercent}%</b> de todo dano recebido de habilidades.
        Ganha mais <b>${this.dmgReduct}%</b> de redução de dano.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const skill = this;
      const { name, reflectPercent, dmgReduct } = this;

      const effect = {
        type: "buff",
        key: "mountain_stance",
        expiresAtTurn: context.currentTurn + 1,

        hookScope: {
          onBeforeDmgTaking: "defender",
          onStatusEffectIncoming: "target",
        },

        onBeforeDmgTaking({ defender, attacker, damage, context }) {
          if (context.damageDepth > 0) return;

          const reflectedDamage = damage * (reflectPercent / 100);

          context.registerDialog?.({
            message: {
              en: `<b>[ULTIMATE — ${name}]</b> ${formatChampionName(
                defender,
              )} reflects <b>${Math.floor(
                reflectedDamage,
              )}</b> damage back to the attacker!`,
              pt: `<b>[ULTIMATE — ${name}]</b> ${formatChampionName(
                defender,
              )} reflete <b>${Math.floor(
                reflectedDamage,
              )}</b> de dano de volta no atacante!`,
            },
            sourceId: defender.id,
            targetId: defender.id,
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
                en: `${formatChampionName(
                  defender,
                )} reflects the damage with ${name}!`,
                pt: `${formatChampionName(
                  defender,
                )} reflete o dano com ${name}!`,
              },
              duration: 1000,
            },
          });

          return {
            damage: damage * (1 - dmgReduct / 100),
            log: {
              en: `<b>[ULTIMATE — ${name}]</b> ${formatChampionName(
                defender,
              )} reflects <b>${Math.floor(
                reflectedDamage,
              )}</b> damage back to the attacker and takes only <b>${100 - dmgReduct}%</b> of the blow!`,
              pt: `<b>[ULTIMATE — ${name}]</b> ${formatChampionName(
                defender,
              )} reflete <b>${Math.floor(
                reflectedDamage,
              )}</b> de dano de volta no atacante e sofre apenas <b>${100 - dmgReduct}%</b> do golpe!`,
            },
          };
        },

        onStatusEffectIncoming({ target, statusEffect }) {
          if (!statusEffect?.subtypes) return;

          if (
            statusEffect.subtypes.includes("hardCC") ||
            statusEffect.subtypes.includes("softCC")
          ) {
            return {
              cancel: true,
              message: {
                en: `${formatChampionName(
                  target,
                )} is immune to crowd control effects!`,
                pt: `${formatChampionName(
                  target,
                )} é imune a efeitos de controle de grupo!`,
              },
            };
          }
        },
      };

      user.runtime.hookEffects ??= [];

      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== effect.key,
      );

      user.addHookEffect(effect, context);

      context.registerDialog({
        message: {
          en: `${formatChampionName(user)} settles into <b>${this.name}</b>.`,
          pt: `${formatChampionName(user)} assume a <b>${this.name}</b>.`,
        },
        sourceId: user.id,
      });

      return {
        log: {
          en: `${formatChampionName(user)} takes <b>${this.name}</b>: crowd control fails against him, half of every blow rebounds on its source, and he stands behind heavy guard this turn.`,
          pt: `${formatChampionName(user)} assume a <b>${this.name}</b>: controle de grupo falha contra ele, metade de cada golpe retorna à sua origem, e ele se mantém em guarda pesada neste turno.`,
        },
      };
    },
  },
];

export default morakhanSkills;
