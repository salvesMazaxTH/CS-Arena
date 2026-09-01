import { formatChampionName } from "../../../ui/formatters.js";
import { StatusEffectsRegistry } from "../../statusEffects/effectsRegistry.js";

const ELEMENTS = ["fire", "water", "ice", "lightning", "earth", "steel"];

export default {
  key: "the_calm_she_returns_to",
  name: "The Calm She Returns To",

  description() {
    return `Neraqa is the stillness the sea is always falling back toward. At the end of any turn in which she acted, every negative status effect on her is washed off — but a wound that hooked deeper than the surface (a curse, a mark, a lingering punishment) is not. What the tide takes it carries out: at the start of the next turn each washed-off effect is laid on an enemy instead, at half its remaining duration, and never on a foe its element could never have touched.`;
  },

  hookScope: {
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, actionSource, context }) {
    if (actionSource?.id !== owner.id) return;
    owner.runtime.neraqaActedTurn = context.currentTurn;
  },

  onTurnEnd({ owner, context }) {
    if (!owner.alive) return;
    if (owner.runtime?.neraqaActedTurn !== context.currentTurn) return;

    const washed = owner.getStatusEffects({ type: "debuff" });
    if (!washed.length) return;

    const remainingOf = (se) => {
      const stacks = Number(se.stacks ?? se.stackCount);
      if (Number.isFinite(stacks) && stacks > 0) return stacks;
      const byTurn = Number(se.expiresAtTurn) - Number(context.currentTurn);
      return Number.isFinite(byTurn) && byTurn > 0 ? byTurn : 1;
    };

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

    const enemies = (context.aliveChampions ?? []).filter(
      (c) => c.team !== owner.team,
    );
    if (!enemies.length) return;

    const ebbContext = { ...context, statModifierSrcId: owner.id };
    const laid = [];
    let cursor = 0;

    for (const effect of pending.effects) {
      const subtypes = StatusEffectsRegistry[effect.key]?.subtypes ?? [];

      for (let tries = 0; tries < enemies.length; tries++) {
        const enemy = enemies[(cursor + tries) % enemies.length];

        const untouchableByElement = subtypes.some(
          (s) =>
            ELEMENTS.includes(s) &&
            (enemy.elementalAffinities ?? []).includes(s),
        );
        if (untouchableByElement) continue;

        const applied = enemy.applyStatusEffect(
          effect.key,
          effect.duration,
          ebbContext,
          { sourceId: owner.id },
          effect.duration,
        );

        if (applied) {
          laid.push(
            `${StatusEffectsRegistry[effect.key]?.name ?? effect.key} → ${formatChampionName(enemy)}`,
          );
          cursor++;
          break;
        }
      }
    }

    if (!laid.length) return;

    return {
      log: `<b>[Passive — ${this.name}]</b> the ebb carries it out — ${laid.join(", ")}.`,
    };
  },
};
