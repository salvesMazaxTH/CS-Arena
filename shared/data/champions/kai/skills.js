import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import kindledFists from "./passive.js";

const kaiSkills = [
  basicStrike,
  {
    key: "quick_hook",
    name: "Quick Hook",
    bf: 60,
    contact: true,
    damageMode: "standard",
    priority: 1,
    description() {
      return {
        en: `Kai snaps a short hook into the chosen target before they can set their guard, dealing <b>Physical Damage</b>.`,
        pt: `Kai desfere um gancho curto no alvo escolhido antes que consiga se defender, causando <b>Dano Físico</b>.`,
      };
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
      // Ensure targetId is set for animation targeting.
      return { ...result, targetId: enemy.id };
    },
  },

  {
    key: "living_ember_stance",
    name: "Living Ember Stance",
    contact: false,
    damageReduction: 25,
    counterAtkDmg: 35,
    stanceDuration: 2,
    burnDuration: 2,
    priority: 2,
    element: "fire",

    hits: [
      {
        id: "counter",
        label: "Living Ember Counter",
        type: "physical",
        element: null,
        contact: true,
        damageMode: "absolute",
      },
    ],

    description() {
      return {
        en: `Kai settles into a stance that glows from the inside out, taking <b>${this.damageReduction}%</b> less damage during this turn and the next.

        Anyone who strikes him in contact is answered on the spot with <b>${this.counterAtkDmg}</b> <b>Absolute Damage</b> and left <b>Burning</b>.

        The moment Kai deals damage, the stance catches: <b>Living Ember</b> burns for <b>${this.stanceDuration}</b> turn(s), his attacks deal <b>+${kindledFists.livingEmberBonusDamage}</b> bonus damage and always apply <b>Burning</b>.`,
        pt: `Kai assume uma postura que brilha por dentro, sofrendo <b>${this.damageReduction}%</b> menos dano neste turno e no próximo.

        Quem o atinge em contato é respondido na hora com <b>${this.counterAtkDmg}</b> de <b>Dano Absoluto</b> e fica <b>Queimando</b>.

        No momento em que Kai causa dano, a postura pega fogo: a <b>Brasa Viva</b> arde por <b>${this.stanceDuration}</b> turno(s), seus ataques causam <b>+${kindledFists.livingEmberBonusDamage}</b> de dano bônus e sempre aplicam <b>Queimando</b>.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      user.runtime.hookEffects ??= [];

      // Retaking the stance renews it rather than adding a second one.
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (effect) => effect.key !== this.key,
      );
      user.damageReductionModifiers = user.damageReductionModifiers.filter(
        (mod) => mod.source !== this.key,
      );

      const skill = this;
      const counterAtkDmg = this.counterAtkDmg;
      const stanceDuration = this.stanceDuration;
      const burnDuration = this.burnDuration;

      // Signals to the VFX system that the stance is active.
      user.runtime.fireStance = "emberStance";

      const effect = {
        type: "buff",
        key: "living_ember_stance",
        state: "emberStance", // "emberStance" → "livingEmber"
        expiresAtTurn: context.currentTurn + stanceDuration,

        // His own counter answers from inside a hook, so the stance only
        // catches on it if it can see nested damage.
        hookPolicies: {
          onAfterDmgDealing: { allowOnNestedDamage: true },
        },

        // 🔥 COUNTERATTACK
        onAfterDmgTaking({
          attacker,
          defender,
          skill: incoming,
          hitId,
          contact,
          damage,
          owner,
          context,
        }) {
          if (defender !== owner) return;
          if (!contact) return;
          if (damage <= 0) return;
          // Hit ids are only unique within their own skill.
          if (incoming?.key === skill.key && hitId === "counter") return;
          if (!attacker?.alive) return;

          context.extraDamageQueue ??= [];

          context.extraDamageQueue.push({
            ...SkillHits.params(skill, "counter", {
              user: owner,
              target: attacker,
              baseDamage: counterAtkDmg,
              context,
            }),

            dialog: {
              message: {
                en: `${formatChampionName(owner)} answers with the Living Ember Stance!`,
                pt: `${formatChampionName(owner)} responde com a Postura da Brasa Viva!`,
              },
              duration: 1000,
            },
          });

          attacker.applyStatusEffect("burning", burnDuration, context, {
            sourceId: owner.id,
          });

          return {
            log: {
              en: `${formatChampionName(attacker)} is burned for striking ${formatChampionName(owner)} in contact!`,
              pt: `${formatChampionName(attacker)} é queimado por atacar ${formatChampionName(owner)} em contato!`,
            },
          };
        },

        onAfterDmgDealing({ attacker, owner, damage, context }) {
          if (attacker !== owner) return;
          if (damage <= 0) return;

          // 🔥 TRANSITION
          if (
            this.state === "emberStance" &&
            owner.runtime.fireStance !== "livingEmber"
          ) {
            this.state = "livingEmber";
            owner.runtime.fireStance = "livingEmber";
            this.expiresAtTurn = context.currentTurn + stanceDuration;

            return {
              log: {
                en: "🔥 Living Ember flares to life!",
                pt: "🔥 A Brasa Viva desperta!",
              },
            };
          }
        },

        // 🔥 AUTOMATIC REMOVAL
        onTurnStart({ owner, context }) {
          if (context.currentTurn >= this.expiresAtTurn) {
            // Signals to the VFX system that the stance is gone.
            owner.runtime.fireStance = null;
          }
        },
      };

      user.addHookEffect(effect, context);

      user.applyDamageReduction({
        amount: this.damageReduction,
        duration: this.stanceDuration,
        type: "percent",
        source: this.key,
        context,
      });

      return {
        log: {
          en: `${formatChampionName(user)} takes the Living Ember Stance!`,
          pt: `${formatChampionName(user)} assume a Postura da Brasa Viva!`,
        },
      };
    },
  },
  {
    key: "blazing_fist_barrage",
    name: "Blazing Fist Barrage",
    bf: 0,
    damagePerHit: 40,
    damageMode: "standard",
    punches: 6,
    burningBonus: 10,
    contact: true,

    priority: 0,
    element: "fire",
    isUltimate: true,
    momentumCost: 50,
    description() {
      return {
        en: `Kai throws himself forward and lets go of everything at once: <b>${this.punches}</b> blazing punches scatter at random across all enemies, each one dealing <b>${this.damagePerHit}</b> physical damage.

        Targets already <b>Burning</b> take <b>${this.burningBonus}</b> bonus damage per punch as the fire finds its way in.`,
        pt: `Kai se lança para frente e solta tudo de uma vez: <b>${this.punches}</b> socos flamejantes se espalham aleatoriamente entre todos os inimigos, cada um causando <b>${this.damagePerHit}</b> de dano físico.

        Alvos já <b>Queimando</b> sofrem <b>${this.burningBonus}</b> de dano bônus por soco conforme o fogo encontra caminho.`,
      };
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const results = [];
      if (!enemies.length) return results;

      for (let i = 0; i < this.punches; i++) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];

        const result = new DamageEvent({
          baseDamage: this.damagePerHit,
          bonusDamage: target.hasStatusEffect("burning") ? this.burningBonus : 0,
          mode: "standard",
          attacker: user,
          defender: target,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push({ ...result, targetId: target.id });
      }

      return results;
    },
  },
];

export default kaiSkills;
