import { formatChampionName } from "../../../ui/formatters.js";
import {
  dieWithTwin,
  findTwin,
  survivalDamage,
  TWIN_BOND_TEXT,
} from "../pairs/twinBond.js";

export default {
  key: "the_one_that_leaves",
  name: "The One That Leaves",

  vanishTurns: 2,
  returnHPPercent: 25,

  description(champion) {
    const stillUnspent = champion.runtime?.leaveSpent ? "no" : "yes";

    return {
      en: `Laiserisa is the sister who answers presence by letting it go: nothing she touches is destroyed, only allowed to stop being. The first lethal effect that would end her instead empties her to a sliver and she slips into the <b>Nothingness</b> at once, returning <b>${this.vanishTurns}</b> turns later with <b>${this.returnHPPercent}%</b> of her base Max HP — and should her sister have fallen meanwhile, she returns only to cease. <b>Once per match</b>. ${TWIN_BOND_TEXT.en}

      <b>Still unspent:</b> ${stillUnspent}`,
      pt: `Laiserisa é a irmã que responde à presença deixando-a ir: nada que ela toca é destruído, apenas permitido deixar de ser. O primeiro efeito letal que a atingiria a esvazia até um fio de vida e ela escorrega para o <b>Nada</b> de imediato, retornando <b>${this.vanishTurns}</b> turnos depois com <b>${this.returnHPPercent}%</b> do seu HP Máximo base — e, caso sua irmã tenha caído nesse meio-tempo, ela retorna apenas para cessar. <b>Uma vez por partida</b>. ${TWIN_BOND_TEXT.pt}

      <b>Ainda não usado:</b> ${stillUnspent === "yes" ? "sim" : "não"}`,
    };
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onValidateAction: "actionSource",
  },

  // Death is death whatever the source, so poison, recoil and absolute hits must reach it too.
  hookPolicies: {
    onBeforeDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
      allowOnAbsolute: true,
    },
  },

  onValidateAction({ actionSource, skill, context }) {
    if (skill?.key !== "then_let_me_take_you_with_me") return;
    if (findTwin(actionSource, context)) return;

    return {
      deny: true,
      message: {
        en: `${formatChampionName(actionSource)} reaches for her sister and finds no one to take with her.`,
        pt: `${formatChampionName(actionSource)} estende a mão para sua irmã e não encontra ninguém para levar consigo.`,
      },
    };
  },

  onBeforeDmgTaking({ defender, owner, damage, context }) {
    if (defender !== owner) return;
    if (owner.runtime.leaveSpent && !owner.runtime.leavePending) return;
    if (!owner.wouldBeLethal(damage)) return;

    // Either binding answers the same lethal hit, and outranks the passive:
    // twin_departure takes both sisters, keep_you_here shields this one for free.
    if (
      owner.runtime.hookEffects?.some(
        (e) => e.key === "twin_departure" || e.key === "keep_you_here",
      )
    )
      return;

    const alreadyLettingGo = owner.runtime.leavePending;

    owner.runtime.leaveSpent = true;
    owner.runtime.leavePending = true;
    owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

    if (!alreadyLettingGo) {
      // Held across the stay: the Nothingness hides who is merely away from who is gone.
      owner.runtime.twinAtDeparture = findTwin(owner, context);

      context.requestChampionMutation({
        targetId: owner.id,
        mode: "vanish",
        turns: this.vanishTurns,
        returnState: { hpRatio: this.returnHPPercent / 100 },
      });

      context.registerDialog({
        message: {
          en: `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} is emptied to a sliver, and lets go.`,
          pt: `[Passiva - <b>${this.name}</b>] ${formatChampionName(owner)} é esvaziada até um fio de vida, e se deixa ir.`,
        },
        sourceId: owner.id,
        targetId: owner.id,
      });
    }

    return {
      damageCap: survivalDamage(owner, 1),
      log: {
        en: `${formatChampionName(owner)} holds on by a thread.`,
        pt: `${formatChampionName(owner)} se segura por um fio.`,
      },
    };
  },

  onTurnStart({ owner, context }) {
    delete owner.runtime.leavePending;

    const twin = owner.runtime.twinAtDeparture;
    if (!twin) return;

    delete owner.runtime.twinAtDeparture;
    if (twin.alive) return;

    owner.HP = 0;
    owner.alive = false;

    const orphaned = {
      en: `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} steps back out of the Nothingness, finds ${formatChampionName(twin)} gone, and has nothing left to remain for.`,
      pt: `[Passiva - <b>${this.name}</b>] ${formatChampionName(owner)} retorna do Nada, encontra ${formatChampionName(twin)} ausente, e não tem mais nada pelo qual permanecer.`,
    };

    context.registerDialog({
      message: orphaned,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return { log: orphaned };
  },

  onChampionDeath(payload) {
    dieWithTwin(payload, this.name);
  },
};
