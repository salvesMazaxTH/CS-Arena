import { formatChampionName } from "../../../ui/formatters.js";
import { StatusEffectsRegistry } from "../../statusEffects/effectsRegistry.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { resolveElementalStatusImmunity } from "../../../engine/combat/statusEffectImmunity.js";

export default {
  key: "the_calm_she_returns_to",
  name: "The Calm She Returns To",

  description() {
    return {
      en: `Neraqa is the stillness the sea is always falling back toward. At the end of any turn in which she acted, every <b>negative status effect</b> on her is washed off; a lowered stat or a mark a skill left on her is not a status effect, and stays. What the tide takes it carries out: at the start of the next turn each washed-off effect is laid on an enemy instead, at <b>half</b> its remaining duration, and never on a foe whose element makes them immune to it.`,
      pt: `Neraqa é a calmaria para a qual o mar sempre retorna. Ao fim de qualquer turno em que agiu, todo <b>efeito de status negativo</b> nela é lavado; um atributo reduzido ou uma marca deixada por uma habilidade não é efeito de status, e permanece. O que a maré leva, ela devolve: no início do próximo turno, cada efeito lavado é aplicado em um inimigo no lugar, com <b>metade</b> de sua duração restante, e nunca em um alvo cujo elemento o torne imune a ele.`,
    };
  },

  hookScope: {
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, actionSource, context }) {
    if (actionSource !== owner) return;
    owner.runtime ??= {};
    owner.runtime.neraqaActedTurn = context.currentTurn;
  },

  onTurnEnd({ owner, context }) {
    if (!owner.alive) return;
    if (owner.runtime?.neraqaActedTurn !== context.currentTurn) return;

    const washed = owner.getStatusEffects({ type: "debuff" });
    if (!washed.length) return;

    // Stack-bound effects count their remaining turns in stacks.
    const remainingOf = (se) =>
      StatusEffectsRegistry[se.key].durationFromStacks
        ? se.stacks
        : se.expiresAtTurn - context.currentTurn;

    const carried = washed.map((se) => ({
      key: se.key,
      duration: Math.max(1, Math.floor(remainingOf(se) / 2)),
    }));

    for (const se of washed) owner.removeStatusEffect(se.key);

    owner.runtime.neraqaEbbPending = {
      fromTurn: context.currentTurn,
      effects: carried,
    };
  },

  onTurnStart({ owner, context }) {
    const pending = owner.runtime?.neraqaEbbPending;
    if (!pending || pending.fromTurn !== context.currentTurn - 1) return;

    owner.runtime.neraqaEbbPending = null;
    if (!owner.alive) return;

    const enemies = TargetFilter.candidates(
      "enemy",
      owner,
      context.aliveChampions ?? [],
    );
    if (!enemies.length) return;

    const ebbContext = { ...context, statModifierSrcId: owner.id };
    const laid = [];

    for (const effect of pending.effects) {
      const statusEffect = StatusEffectsRegistry[effect.key];
      const stackCount = statusEffect.durationFromStacks
        ? effect.duration
        : undefined;

      // Each effect tries the enemies in a fresh random order.
      const order = [...enemies];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      for (const enemy of order) {
        if (resolveElementalStatusImmunity({ target: enemy, statusEffect })) {
          continue;
        }

        const applied = enemy.applyStatusEffect(
          effect.key,
          effect.duration,
          ebbContext,
          { sourceId: owner.id },
          stackCount,
        );

        if (applied) {
          laid.push(`${statusEffect.name} → ${formatChampionName(enemy)}`);
          break;
        }
      }
    }

    if (!laid.length) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> the ebb carries it out — ${laid.join(", ")}.`,
        pt: `<b>[Passiva — ${this.name}]</b> a vazante leva embora — ${laid.join(", ")}.`,
      },
    };
  },
};
