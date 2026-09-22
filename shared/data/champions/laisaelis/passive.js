import { formatChampionName } from "../../../ui/formatters.js";
import {
  dieWithTwin,
  findTwin,
  survivalDamage,
  TWIN_BOND_TEXT,
} from "../pairs/twinBond.js";

export default {
  key: "the_one_that_remains",
  name: "The One That Remains",

  survivalHP: 1,

  description(champion) {
    const stillUnspent = champion.runtime?.remainSpent ? "no" : "yes";

    return {
      en: `Laisaelis is the sister who looks at something about to stop being and simply answers that it is here. The first lethal effect that would end her does not: she stays on the field with <b>${this.survivalHP}</b> HP, and every negative effect afflicting her slips away with the death she refused. <b>Once per match</b>. ${TWIN_BOND_TEXT.en}

      <b>Still unspent:</b> ${stillUnspent}`,
      pt: `Laisaelis é a irmã que olha para algo prestes a deixar de ser e simplesmente responde que aquilo está aqui. O primeiro efeito letal que a atingiria não a atinge: ela permanece em campo com <b>${this.survivalHP}</b> HP, e todo efeito negativo que a aflige se desfaz junto com a morte que ela recusou. <b>Uma vez por partida</b>. ${TWIN_BOND_TEXT.pt}

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
    if (skill?.key !== "i_will_keep_you_here") return;
    if (findTwin(actionSource, context)) return;

    return {
      deny: true,
      message: {
        en: `${formatChampionName(actionSource)} reaches for her sister and finds nothing to hold.`,
        pt: `${formatChampionName(actionSource)} estende a mão para sua irmã e não encontra nada para segurar.`,
      },
    };
  },

  onBeforeDmgTaking({ defender, owner, damage, context }) {
    if (defender !== owner) return;
    if (owner.runtime.remainSpent) return;
    if (!owner.wouldBeLethal(damage)) return;

    // Her sister's binding answers the same lethal hit, and takes precedence.
    if (owner.runtime.hookEffects?.some((e) => e.key === "twin_departure"))
      return;

    owner.runtime.remainSpent = true;
    // Must outlive this hook: the finishing step reads it after the damage lands.
    owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

    const shedStatuses = owner.getStatusEffects({ type: "debuff" });
    shedStatuses.forEach((effect) => owner.removeStatusEffect(effect.key));

    const shedHooks =
      owner.runtime.hookEffects?.filter((e) => e.type === "debuff") ?? [];
    if (shedHooks.length) {
      owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
        (e) => e.type !== "debuff",
      );
    }

    const cleansed = shedStatuses.length + shedHooks.length > 0;

    context.registerDialog({
      message: {
        en: `[Passive - <b>${this.name}</b>] ${formatChampionName(owner)} should be gone, and remains anyway${cleansed ? ", every affliction sliding off her as she does" : ""}.`,
        pt: `[Passiva - <b>${this.name}</b>] ${formatChampionName(owner)} deveria ter partido, e permanece mesmo assim${cleansed ? ", toda aflição se desfazendo enquanto isso acontece" : ""}.`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damageCap: survivalDamage(owner, this.survivalHP),
      log: {
        en: `${formatChampionName(owner)} holds on with ${this.survivalHP} HP${cleansed ? ", cleansed of all that afflicted her" : ""}.`,
        pt: `${formatChampionName(owner)} resiste com ${this.survivalHP} HP${cleansed ? ", purificada de tudo que a afligia" : ""}.`,
      },
    };
  },

  onChampionDeath(payload) {
    dieWithTwin(payload, this.name);
  },
};
