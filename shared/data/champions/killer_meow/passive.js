import { formatChampionName } from "../../../ui/formatters.js";

export const STARTING_LIVES = 9;
export const FIRST_SWITCH_COST = 2;

const ATTACK_BONUS = 40;
const SPEED_BONUS = 25;

export function switchCost(champion) {
  return FIRST_SWITCH_COST + (champion.runtime.meowSwitches ?? 0);
}

function commitTo(champion, skillKey, context) {
  const from = champion.statModifiers.length;

  champion.buffStat({
    statName: "Attack",
    amount: ATTACK_BONUS,
    isPermanent: true,
    context,
  });
  champion.buffStat({
    statName: "Speed",
    amount: SPEED_BONUS,
    isPermanent: true,
    context,
  });

  champion.runtime.meowCommittedSkill = skillKey;
  champion.runtime.meowCommitModifiers = champion.statModifiers.slice(from);
}

function abandonCommitment(champion) {
  champion.removeStatModifiers(champion.runtime.meowCommitModifiers ?? []);
  delete champion.runtime.meowCommitModifiers;
  delete champion.runtime.meowCommittedSkill;
}

export default {
  key: "nine_lives",
  name: "Nine Lives",

  description() {
    return `Killer Meow kills the way a cat does, which is to say once, the same way, over and over until the city learns the shape of it. The first ability he uses settles into him as a habit worth +${ATTACK_BONUS} Attack and +${SPEED_BONUS} Speed for as long as he keeps to it. Reaching for anything else breaks the habit and spends his lives — ${FIRST_SWITCH_COST} for the first change, one more for each after it — and with ${STARTING_LIVES} lives to his name he has exactly three changes of mind in him. He cannot reach for what he can no longer pay for.`;
  },

  hookScope: {
    onValidateActionIntent: "actionSource",
  },

  onValidateActionIntent({ actionSource, skill }) {
    const committed = actionSource.runtime.meowCommittedSkill;
    if (committed === undefined || committed === skill?.key) return;

    const cost = switchCost(actionSource);
    if ((actionSource.runtime.meowLives ?? 0) >= cost) return;

    return {
      deny: true,
      message: `${formatChampionName(actionSource)} has no lives left to spend — he is bound to what he already does.`,
    };
  },

  onActionsLocked({ owner, pendingActions, context }) {
    const action = pendingActions.find((entry) => entry.userId === owner.id);
    if (!action) return;

    owner.runtime.meowLivesAtLock = owner.runtime.meowLives;

    const committed = owner.runtime.meowCommittedSkill;
    if (committed === action.skillKey) return;

    const skill = owner.skills.find((s) => s.key === action.skillKey);

    if (committed === undefined) {
      if (!skill?.bf) return;

      commitTo(owner, action.skillKey, context);

      return {
        log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} settles into ${skill.name}, and the habit is worth +${ATTACK_BONUS} Attack and +${SPEED_BONUS} Speed.`,
      };
    }

    const cost = switchCost(owner);
    owner.runtime.meowSwitches = (owner.runtime.meowSwitches ?? 0) + 1;
    owner.runtime.meowLives = Math.max(0, owner.runtime.meowLives - cost);

    abandonCommitment(owner);
    if (skill?.bf) commitTo(owner, action.skillKey, context);

    context.registerDialog({
      message: `${formatChampionName(owner)} changes his mind, and it costs him ${cost} of his lives.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} breaks the habit — ${cost} lives spent, ${owner.runtime.meowLives} left.`,
    };
  },
};
