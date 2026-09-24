import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import basicStrike from "../generic/basicStrike.js";

const sebastianIgnisSkills = [
  // ========================
  // Basic Strike (global)
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "least_resistance",
    name: "Least Resistance",

    bf: 60,
    apathyBonusFlat: 15,
    burnDuration: 2,

    contact: false,
    damageMode: "standard",
    element: "fire",
    hitVfx: "ember_flick",
    priority: 1,

    description() {
      return {
        en: `Sebastian barely raises the blade, a flick of flame that costs him nothing he wasn't already carrying. Deals <b>physical damage</b>, plus <b>${this.apathyBonusFlat}</b> bonus damage per <b>Apathy</b> stack spent, and always sets the chosen enemy <b>Burning</b> for <b>${this.burnDuration}</b> turn(s).`,
        pt: `Sebastian mal ergue a lâmina, um lampejo de chama que não lhe custa nada que ele já não estivesse carregando. Causa <b>dano físico</b>, mais <b>${this.apathyBonusFlat}</b> de dano bônus por carga de <b>Apatia</b> gasta, e sempre deixa o inimigo escolhido <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      user.runtime ??= {};
      const stacks = user.runtime.apathyStacks || 0;
      user.runtime.apathyStacks = 0;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: this.apathyBonusFlat * stacks,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context, {
          sourceId: user.id,
        });
      }

      if (stacks > 0) {
        context.registerDialog({
          message: {
            en: `${formatChampionName(user)} finally moves, and everything he saved goes into the swing.`,
            pt: `${formatChampionName(user)} finalmente se move, e tudo o que economizou vai para o golpe.`,
          },
          sourceId: user.id,
          targetId: user.id,
        });

        arr.push({
          log: {
            en: `${formatChampionName(user)} finally moves — ${stacks} Apathy stack(s) spent.`,
            pt: `${formatChampionName(user)} finalmente se move — ${stacks} carga(s) de Apatia gasta(s).`,
          },
        });
      }

      return arr;
    },
  },

  {
    key: "a_song_he_already_knows",
    name: "A Song He Already Knows",

    damageReductionPercent: 12,
    perStackPercent: 1,
    duration: 3,

    contact: false,
    priority: 3,

    description() {
      return {
        en: `Sebastian plays a few bars on the harp, the same ones he always plays, and doesn't bother learning a new one for the occasion — it works anyway. Every ally takes <b>${this.damageReductionPercent}%</b> less damage for <b>${this.duration}</b> turn(s), plus <b>${this.perStackPercent}%</b> for every <b>Apathy</b> stack spent.`,
        pt: `Sebastian toca alguns compassos na harpa, os mesmos de sempre, e nem se dá ao trabalho de aprender um novo para a ocasião — funciona do mesmo jeito. Todo aliado recebe <b>${this.damageReductionPercent}%</b> menos dano por <b>${this.duration}</b> turno(s), mais <b>${this.perStackPercent}%</b> para cada carga de <b>Apatia</b> gasta.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.runtime ??= {};
      const stacks = user.runtime.apathyStacks || 0;
      user.runtime.apathyStacks = 0;

      const reduction =
        this.damageReductionPercent + this.perStackPercent * stacks;

      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);

      for (const ally of allies) {
        ally.applyDamageReduction({
          amount: reduction,
          duration: this.duration,
          type: "percent",
          source: this.key,
          context,
        });
      }

      if (stacks > 0) {
        context.registerDialog({
          message: {
            en: `${formatChampionName(user)} lets the whole bank go into the harp.`,
            pt: `${formatChampionName(user)} deixa todo o banco ir para a harpa.`,
          },
          sourceId: user.id,
          targetId: user.id,
        });
      }

      return {
        log: {
          en: `${formatChampionName(user)} plays <b>A Song He Already Knows</b> — the whole team takes ${reduction}% less damage for a while.`,
          pt: `${formatChampionName(user)} toca <b>Uma Canção Que Ele Já Conhece</b> — o time inteiro recebe ${reduction}% menos dano por um tempo.`,
        },
      };
    },
  },

  {
    key: "the_one_thing_he_does_well",
    name: "The One Thing He Does Well",

    bf: 80,
    apathyBonusPercent: 12,
    burnDuration: 2,

    contact: true,
    damageMode: "standard",
    element: "fire",
    hitVfx: "slash",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `Every stack of neglect Sebastian's been banking comes due at once, and for a moment he commits completely — the ground around the chosen enemy goes up with them. Deals <b>physical damage</b>, plus <b>${this.apathyBonusPercent}%</b> more per <b>Apathy</b> stack spent, to them and whoever stands beside them, always setting each one <b>Burning</b> for <b>${this.burnDuration}</b> turn(s).`,
        pt: `Toda carga de descaso que Sebastian vinha acumulando cobra sua conta de uma vez, e por um instante ele se entrega por completo — o chão ao redor do inimigo escolhido explode junto com ele. Causa <b>dano físico</b>, mais <b>${this.apathyBonusPercent}%</b> a mais por carga de <b>Apatia</b> gasta, nele e em quem estiver ao seu lado, sempre deixando cada um <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [primary] = targets;

      user.runtime ??= {};
      const stacks = user.runtime.apathyStacks || 0;
      user.runtime.apathyStacks = 0;

      const multiplier = 1 + (this.apathyBonusPercent * stacks) / 100;
      const results = [];
      const hitTargets = [primary, ...context.getAdjacentChampions(primary)];

      for (const target of hitTargets) {
        const baseDamage = (user.Attack * this.bf * multiplier) / 100;

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: target,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const arr = Array.isArray(result) ? result : [result];
        results.push(...arr);

        if (effectConnected(arr[0], "burning")) {
          target.applyStatusEffect("burning", this.burnDuration, context, {
            sourceId: user.id,
          });
        }
      }

      if (stacks > 0) {
        context.registerDialog({
          message: {
            en: `${formatChampionName(user)} finally commits — everything he banked comes due at once.`,
            pt: `${formatChampionName(user)} finalmente se entrega — tudo o que acumulou cobra sua conta de uma vez.`,
          },
          sourceId: user.id,
          targetId: user.id,
        });

        results.push({
          log: {
            en: `${formatChampionName(user)} finally commits — ${stacks} Apathy stack(s) spent.`,
            pt: `${formatChampionName(user)} finalmente se entrega — ${stacks} carga(s) de Apatia gasta(s).`,
          },
        });
      }

      return results;
    },
  },
];

export default sebastianIgnisSkills;
