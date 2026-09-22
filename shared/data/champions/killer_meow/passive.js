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
  champion.runtime.meowBuffActive = true;
}

function abandonCommitment(champion) {
  champion.removeStatModifiers(champion.runtime.meowCommitModifiers ?? []);
  delete champion.runtime.meowCommitModifiers;
  delete champion.runtime.meowCommittedSkill;
  delete champion.runtime.meowBuffActive;
}

function holdCommitment(champion, skillKey) {
  champion.runtime.meowCommittedSkill = skillKey;
  champion.runtime.meowBuffActive = false;
}

function hasActiveBuff(champion) {
  return (
    champion.runtime.meowBuffActive === true ||
    (Array.isArray(champion.runtime.meowCommitModifiers) &&
      champion.runtime.meowCommitModifiers.length > 0)
  );
}

export default {
  key: "nine_lives",
  name: "Nine Lives",

  description() {
    return {
      en: `Killer Meow kills the way a cat does, which is to say once, the same way, over and over until the city learns the shape of it. The first ability he uses settles into him as a habit worth <b>+${ATTACK_BONUS} Attack</b> and <b>+${SPEED_BONUS} Speed</b> for as long as he keeps to it. Reaching for anything else breaks the habit and spends his lives — <b>${FIRST_SWITCH_COST}</b> for the first change, one more for each after it — leaving him without the bonuses for that turn. With <b>${STARTING_LIVES}</b> lives to his name he has exactly three changes of mind in him, and he cannot reach for what he can no longer pay for.`,
      pt: `Killer Meow mata do jeito que um gato mata, ou seja, uma vez, do mesmo jeito, repetidamente até a cidade aprender a forma disso. A primeira habilidade que ele usa se torna um hábito nele, valendo <b>+${ATTACK_BONUS} de Ataque</b> e <b>+${SPEED_BONUS} de Velocidade</b> enquanto ele mantiver esse hábito. Recorrer a qualquer outra coisa quebra o hábito e gasta suas vidas — <b>${FIRST_SWITCH_COST}</b> pela primeira mudança, mais uma a cada mudança seguinte — deixando-o sem os bônus naquele turno. Com <b>${STARTING_LIVES}</b> vidas em seu nome, ele tem exatamente três mudanças de ideia possíveis, e não pode recorrer ao que já não consegue mais pagar.`,
    };
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
      message: {
        en: `${formatChampionName(actionSource)} has no lives left to spend — he is bound to what he already does.`,
        pt: `${formatChampionName(actionSource)} não tem mais vidas para gastar — ele está preso ao que já faz.`,
      },
    };
  },

  onActionsLocked({ owner, pendingActions, context }) {
    const action = pendingActions.find((entry) => entry.userId === owner.id);
    if (!action) return;

    owner.runtime.meowLivesAtLock = owner.runtime.meowLives;

    const committed = owner.runtime.meowCommittedSkill;
    const skill = owner.skills.find((s) => s.key === action.skillKey);
    const skillName = skill?.name ?? action.skillKey;

    if (committed === action.skillKey) {
      if (hasActiveBuff(owner) || !skill?.bf) return;

      commitTo(owner, action.skillKey, context);

      return {
        log: {
          en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} keeps to ${skill.name}, and the habit returns with +${ATTACK_BONUS} Attack and +${SPEED_BONUS} Speed.`,
          pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} se mantém em ${skill.name}, e o hábito retorna com +${ATTACK_BONUS} de Ataque e +${SPEED_BONUS} de Velocidade.`,
        },
      };
    }

    if (committed === undefined) {
      if (!skill?.bf) return;

      commitTo(owner, action.skillKey, context);

      return {
        log: {
          en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} settles into ${skill.name}, and the habit is worth +${ATTACK_BONUS} Attack and +${SPEED_BONUS} Speed.`,
          pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} se estabelece em ${skill.name}, e o hábito vale +${ATTACK_BONUS} de Ataque e +${SPEED_BONUS} de Velocidade.`,
        },
      };
    }

    const cost = switchCost(owner);
    owner.runtime.meowSwitches = (owner.runtime.meowSwitches ?? 0) + 1;
    owner.runtime.meowLives = Math.max(0, owner.runtime.meowLives - cost);

    abandonCommitment(owner);
    if (skill?.bf) holdCommitment(owner, action.skillKey);

    context.registerDialog({
      message: {
        en: `${formatChampionName(owner)} changes his mind, and it costs him ${cost} of his lives.`,
        pt: `${formatChampionName(owner)} muda de ideia, e isso lhe custa ${cost} de suas vidas.`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} breaks the habit — ${cost} lives spent, ${owner.runtime.meowLives} left.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} quebra o hábito — ${cost} vida(s) gasta(s), ${owner.runtime.meowLives} restante(s).`,
      },
    };
  },
};
