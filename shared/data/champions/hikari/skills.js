import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

// Enemies whose still-queued action is aimed at Hikari and would actually
// land on her: taunt-immune skills and enemies already taunted are left out.
function findAimers(hikari, context) {
  const aimers = [];

  for (const action of context.pendingActions ?? []) {
    const enemy = context.allChampions?.get(action.userId);
    if (!enemy?.alive || enemy.team === hikari.team) continue;

    const skill = enemy.skills.find((s) => s.key === action.skillKey);
    if (!skill || skill.ignoresTaunt) continue;

    if (!Object.values(action.targetIds ?? {}).includes(hikari.id)) continue;

    const alreadyTaunted = enemy.tauntEffects?.some(
      (taunt) => taunt.expiresAtTurn > context.currentTurn,
    );
    if (alreadyTaunted) continue;

    aimers.push(enemy.id);
  }

  return aimers;
}

const hikariSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // H1 — Nightshade Edge
  // ========================
  {
    key: "nightshade_edge",
    name: "Nightshade Edge",

    bf: 80,
    poisonedStacks: 2,
    poisonedStacksIfPoisoned: 1,

    contact: true,
    damageMode: "standard",
    element: "poison",
    hitVfx: "slash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Hikari opens a shallow cut on the chosen target with a blade kept wet with her own venom. Deals physical damage and applies <b>${this.poisonedStacks}</b> stacks of <b>Poisoned</b>, or <b>${this.poisonedStacksIfPoisoned}</b> if the target is already <b>Poisoned</b>.`,
        pt: `Hikari abre um corte raso no alvo escolhido com uma lâmina sempre úmida do próprio veneno. Causa dano físico e aplica <b>${this.poisonedStacks}</b> acúmulos de <b>Envenenado</b>, ou <b>${this.poisonedStacksIfPoisoned}</b> se o alvo já estiver <b>Envenenado</b>.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const stacks = enemy.hasStatusEffect("poisoned")
        ? this.poisonedStacksIfPoisoned
        : this.poisonedStacks;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "poisoned")) {
        enemy.applyStatusEffect(
          "poisoned",
          undefined,
          context,
          {},
          stacks,
        );
      }

      return results;
    },
  },

  // ========================
  // H2 — Substitution
  // ========================
  {
    key: "substitution",
    name: "Substitution",

    contact: false,
    priority: 4,

    hits: [
      {
        id: "counter",
        label: "Substitution Counter",
        type: "physical",
        contact: true,
        damageMode: "standard",
        bf: 25,
        bonusDamage: 15,
      },
    ],

    targetSpec: ["self"],

    description() {
      const counter = SkillHits.spec(this, "counter");

      return {
        en: `Faster than almost any blow, Hikari is already gone, and a wooden decoy in her clothes stands where she was. Every enemy whose attack this turn was aimed at her is <b>Taunted</b> into the decoy instead, and whoever strikes it gets Hikari's blade back from where they least expect it: <b>${counter.bf}%</b> of her <b>Attack</b> plus <b>${counter.bonusDamage}</b> bonus damage. The decoy is fragile and never acts; whatever is left of it is taken off the field at the start of the next turn.`,
        pt: `Mais rápida que quase qualquer golpe, Hikari já sumiu, e um boneco de madeira com as roupas dela está parado onde ela estava. Todo inimigo cujo ataque neste turno mirava nela é <b>Provocado</b> a golpear o boneco no lugar, e quem o acerta recebe a lâmina de Hikari de volta de onde menos espera: <b>${counter.bf}%</b> do <b>Ataque</b> dela mais <b>${counter.bonusDamage}</b> de dano bônus. O boneco é frágil e nunca age; o que restar dele sai de campo no início do turno seguinte.`,
      };
    },

    resolve({ user, context = {} }) {
      context.requestChampionMutation({
        mode: "summon",
        championKey: "hikari_dummy",
        team: user.team,
        asEntityType: "minion",
        runtime: {
          summonerId: user.id,
          leavesNoDeath: true,
          unmakingVfx: "hollow",
          arrivalVfx: "mirage_split",
          substitutionAimerIds: findAimers(user, context),
        },
        onSettled: (decoy) => {
          if (decoy) this._armCounter(user, decoy, context);

          context.registerDialog({
            message: decoy
              ? `${formatChampionName(user)} slips away, leaving a decoy in her place!`
              : "But it failed.",
            sourceId: user.id,
          });
        },
      });
    },

    // The decoy is dead by the time after-hooks run, so Hikari listens instead.
    _armCounter(user, decoy, context) {
      const skill = this;

      user.addHookEffect(
        {
          type: "buff",
          key: "substitution_counter",
          expiresAtTurn: context.currentTurn + 1,

          onAfterDmgTaking({ attacker, defender, damage, owner, context }) {
            if (defender?.id !== decoy.id || damage <= 0) return;
            if (!attacker?.alive || attacker.team === owner.team) return;

            context.extraDamageQueue ??= [];
            context.extraDamageQueue.push({
              ...SkillHits.params(skill, "counter", {
                user: owner,
                target: attacker,
                context,
              }),

              dialog: {
                message: {
                  en: `${formatChampionName(owner)} strikes back from behind the decoy!`,
                  pt: `${formatChampionName(owner)} revida de trás do boneco!`,
                },
                duration: 1000,
              },
            });
          },
        },
        context,
      );
    },
  },

  // ========================
  // Ultimate — Nightshade Bloom
  // ========================
  {
    key: "nightshade_bloom",
    name: "Nightshade Bloom",

    isUltimate: true,
    momentumCost: 55,

    bf: 120,
    maxHpRatioPerStack: 0.05,

    contact: true,
    damageMode: "standard",
    element: "poison",
    hitVfx: "multislash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Hikari cuts exactly where her venom has pooled, and all of it opens at once. Deals physical damage, plus bonus damage equal to <b>${this.maxHpRatioPerStack * 100}%</b> of the chosen target's <b>Max HP</b> per <b>Poisoned</b> stack on them. If the strike lands, every <b>Poisoned</b> stack is consumed.`,
        pt: `Hikari corta exatamente onde o veneno se acumulou, e tudo se abre de uma vez. Causa dano físico, mais dano bônus igual a <b>${this.maxHpRatioPerStack * 100}%</b> do <b>HP Máximo</b> do alvo escolhido por acúmulo de <b>Envenenado</b> nele. Se o golpe acertar, todos os acúmulos de <b>Envenenado</b> são consumidos.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const stacks = Number(enemy.getStatusEffect("poisoned")?.stacks) || 0;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: Math.round(
          stacks * this.maxHpRatioPerStack * enemy.maxHP,
        ),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (stacks > 0 && results[0]?.landed) {
        enemy.removeStatusEffect("poisoned");
      }

      return results;
    },
  },
];

export default hikariSkills;
