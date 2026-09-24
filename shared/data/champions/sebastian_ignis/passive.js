import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "idle_flame",
  name: "Idle Flame",

  apathyCap: 6,
  idleExemptSkillKeys: ["basic_strike", CLAIM_ACTION_KEY],

  description(champion) {
    const stacks = champion.runtime?.apathyStacks || 0;

    return {
      en: `Sebastian only bothers to move when the alternative costs him more. Any turn he spends without using one of his own abilities — a Basic Strike or a <b>CLAIM</b> don't count — he banks <b>1</b> stack of <b>Apathy</b> (Max: <b>${this.apathyCap}</b>). Whatever ability he finally commits to spends the whole bank at once.

      <b>Current Stacks: ${stacks}</b>`,
      pt: `Sebastian só se dá ao trabalho de agir quando a alternativa custa mais caro. Em qualquer turno que passe sem usar uma de suas próprias habilidades — Ataque Básico ou <b>CLAIM</b> não contam — ele ganha <b>1</b> acúmulo de <b>Apatia</b> (Máx: <b>${this.apathyCap}</b>). A habilidade que ele finalmente decidir usar gasta o banco inteiro de uma vez.

      <b>Acúmulos Atuais: ${stacks}</b>`,
    };
  },

  hookScope: {
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, skill, context }) {
    if (!skill?.key || this.idleExemptSkillKeys.includes(skill.key)) return;

    owner.runtime ??= {};
    owner.runtime.lastAbilityUseTurn = context.currentTurn;
  },

  onTurnEnd({ owner, context }) {
    if (owner.runtime?.lastAbilityUseTurn === context.currentTurn) return;

    owner.runtime ??= {};
    const stacks = owner.runtime.apathyStacks || 0;
    if (stacks >= this.apathyCap) return;

    owner.runtime.apathyStacks = stacks + 1;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} does nothing worth mentioning (${owner.runtime.apathyStacks}/${this.apathyCap} Apathy).`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} não faz nada digno de nota (${owner.runtime.apathyStacks}/${this.apathyCap} de Apatia).`,
      },
    };
  },
};
