import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const reyskaroneSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,
  // =========================
  // Special Abilities

  // =========================
  // H1 — Blood Tithe
  // =========================
  {
    key: "blood_tithe",
    name: "Blood Tithe",
    bf: 45,
    damageMode: "standard",
    hpSacrificePercent: 15,
    titheDuration: 2,
    titheHeal: 15,
    titheBonusDamage: 10,
    contact: false,

    priority: 1,
    description() {
      return {
        en: `Reyskarone spills <b>${this.hpSacrificePercent}%</b> of his own Max HP — never falling below 1 HP — then strikes the chosen target for magical damage. A strike that connects brands them with the <b>Tithe</b> and locks their wounds shut with <b>Heal Block</b> for <b>${this.titheDuration}</b> turn(s).

        While the brand holds, every ally who strikes the marked target restores <b>${this.titheHeal}</b> HP and deals <b>+${this.titheBonusDamage}</b> bonus damage.`,
        pt: `Reyskarone derrama <b>${this.hpSacrificePercent}%</b> de seu próprio HP Máximo — nunca caindo abaixo de 1 HP — e então golpeia o alvo escolhido com dano mágico. Um golpe que acerta o marca com o <b>Tributo</b> e trava suas feridas com <b>Bloqueio de Cura</b> por <b>${this.titheDuration}</b> turno(s).

        Enquanto a marca se mantém, todo aliado que golpear o alvo marcado restaura <b>${this.titheHeal}</b> HP e causa <b>+${this.titheBonusDamage}</b> de dano bônus.`,
      };
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      // The cost is a self-imposed drain rather than damage: it ignores
      // shields and never brings Reyskarone below 1 HP. With no blood left to
      // spill there is nothing to pay the brand with, so the skill fails.
      const hpSacrifice = Math.min(
        Math.floor(user.maxHP * (this.hpSacrificePercent / 100)),
        user.HP - 1,
      );

      if (hpSacrifice <= 0) {
        context.registerDialog({
          message: {
            en: `But it failed.`,
            pt: `Mas falhou.`,
          },
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: {
            en: `${formatChampionName(user)} had no blood left to spill. <b>Blood Tithe</b> failed.`,
            pt: `${formatChampionName(user)} não tinha mais sangue para derramar. <b>Tributo de Sangue</b> falhou.`,
          },
        };
      }

      // The drain never goes through a DamageEvent, so it registers its own
      // visual event and dialog, or the HP loss lands on the client
      // unannounced. Paying it first also makes it the anchor every later
      // dialog of this skill attaches to, keeping them in narrative order.
      user.modifyHP(-hpSacrifice, { context });

      context.registerDamage({
        target: user,
        amount: hpSacrifice,
        rawAmount: hpSacrifice,
        sourceId: user.id,
      });

      context.registerDialog({
        message: {
          en: `${formatChampionName(user)} spills his own blood for the <b>Tithe</b>!`,
          pt: `${formatChampionName(user)} derrama seu próprio sangue pelo <b>Tributo</b>!`,
        },
        sourceId: user.id,
        targetId: user.id,
        duration: 1000,
      });

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const connected = results.some(
        (r) =>
          r?.targetId === enemy.id && r?.landed && (r?.totalDamage ?? 0) > 0,
      );

      // Like any post-damage status: the brand only takes hold on a strike that
      // connects, and wards turn it away through the normal hook-incoming path.
      if (connected) {
        enemy.runtime.hookEffects ??= [];
        // Recasting refreshes the brand rather than stacking a second one.
        enemy.runtime.hookEffects = enemy.runtime.hookEffects.filter(
          (effect) => effect.key !== "tithe",
        );

        const branded = enemy.addHookEffect(
          {
            type: "debuff",
            key: "tithe",
            group: "skill",
            expiresAtTurn: context.currentTurn + this.titheDuration,

            // The brand rides on the branded champion, so both hooks are the
            // taking side of the exchange and the scope alone already keeps
            // them from firing on anyone else's damage.
            hookScope: {
              onBeforeDmgTaking: "defender",
              onAfterDmgTaking: "defender",
            },

            onBeforeDmgTaking: ({ attacker }) => {
              if (attacker.team !== user.team) return;

              return {
                bonusDamage: this.titheBonusDamage,
              };
            },

            onAfterDmgTaking: ({ attacker, actualDmg, context }) => {
              if (attacker.team !== user.team || !(actualDmg > 0)) return;

              // The brand is Reyskarone's, so the healing is credited to him.
              new HealEvent({
                target: attacker,
                amount: this.titheHeal,
                context,
                source: user,
              }).execute();
            },
          },
          context,
        );

        if (branded) {
          context.registerDialog({
            message: {
              en: `${formatChampionName(enemy)} is branded with the <b>Tithe</b>!`,
              pt: `${formatChampionName(enemy)} é marcado com o <b>Tributo</b>!`,
            },
            sourceId: user.id,
            targetId: enemy.id,
            duration: 1000,
          });
        }
      }

      const mainHit = results.find((r) => r?.targetId === enemy.id);
      if (effectConnected(mainHit, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.titheDuration, context, {
          source: this.key,
        });
      }

      return results;
    },
  },

  // =========================
  // H2 — Martial Transfusion
  // =========================
  {
    key: "martial_transfusion",
    name: "Martial Transfusion",
    atkBuff: 20,
    lifeStealBuff: 15,
    buffDuration: 2,
    contact: false,

    priority: 4,
    description() {
      return {
        en: `Reyskarone pours his own blood into the chosen ally, granting them <b>+${this.atkBuff}</b> Attack and <b>+${this.lifeStealBuff}%</b> LifeSteal for <b>${this.buffDuration}</b> turn(s).`,
        pt: `Reyskarone verte seu próprio sangue no aliado escolhido, concedendo <b>+${this.atkBuff}</b> de Ataque e <b>+${this.lifeStealBuff}%</b> de Roubo de Vida por <b>${this.buffDuration}</b> turno(s).`,
      };
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return {
        log:
          user === ally
            ? {
                en: `${formatChampionName(user)} strengthens himself with Martial Transfusion.`,
                pt: `${formatChampionName(user)} se fortalece com a Transfusão Marcial.`,
              }
            : {
                en: `${formatChampionName(user)} strengthens ${formatChampionName(ally)} with Martial Transfusion.`,
                pt: `${formatChampionName(user)} fortalece ${formatChampionName(ally)} com a Transfusão Marcial.`,
              },
      };
    },
  },

  // =========================
  // ULT — Crimson Pact
  // =========================
  {
    key: "crimson_pact",
    name: "Crimson Pact",
    atkBuffPercent: 18,
    lifeStealBuff: 30,
    buffDuration: 2,
    contact: false,
    isUltimate: true,
    momentumCost: 55,

    priority: 5,
    description() {
      return {
        en: `Reyskarone seals a pact in blood with the chosen ally: for <b>${this.buffDuration}</b> turn(s), they gain <b>+${this.atkBuffPercent}%</b> Attack and <b>+${this.lifeStealBuff}%</b> LifeSteal.`,
        pt: `Reyskarone sela um pacto de sangue com o aliado escolhido: por <b>${this.buffDuration}</b> turno(s), ele ganha <b>+${this.atkBuffPercent}%</b> de Ataque e <b>+${this.lifeStealBuff}%</b> de Roubo de Vida.`,
      };
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      ally.modifyStat({
        statName: "Attack",
        amount: this.atkBuffPercent,
        duration: this.buffDuration,
        context,
        isPercent: true,
        statModifierSrc: user,
      });

      ally.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      return {
        log:
          user === ally
            ? {
                en: `${formatChampionName(user)} seals a Crimson Pact in his own blood.`,
                pt: `${formatChampionName(user)} sela um Pacto Carmesim com seu próprio sangue.`,
              }
            : {
                en: `${formatChampionName(user)} seals a Crimson Pact with ${formatChampionName(ally)}.`,
                pt: `${formatChampionName(user)} sela um Pacto Carmesim com ${formatChampionName(ally)}.`,
              },
      };
    },
  },
];

export default reyskaroneSkills;
