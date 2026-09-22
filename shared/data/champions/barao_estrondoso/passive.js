// shared/champions/barao_estrondoso/passive.js

import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "cataclysmic_reactor",
  name: "Cataclysmic Reactor",
  storageBasePercent: 75,
  storageShieldPercent: 110,
  damageTakenBonusPercent: 10,
  damageTakenBonusFlatMin: 10,
  storageCap: 250,
  description(champion) {
    const stored = champion.runtime?.storedDamage || 0;

    return {
      en: `
    The Barão converts damage taken into destructive energy.

    He takes <b>+${this.damageTakenBonusPercent}%</b> bonus damage (does not apply to <b>Absolute Damage</b> and <b>DoT</b>).

    <b>${this.storageBasePercent}%</b> of the damage taken is stored (Max.: <b>${this.storageCap}</b>). While <b>Reinforced Plating</b> holds, that rate rises to <b>${this.storageShieldPercent}%</b>.

    Stored Damage: <b>${stored > 0 ? stored : 0}</b>

    Reactor Overload:
    The core never vents what it has just unleashed. Whenever the Barão uses a skill, he is left <b>Inert</b> on the following turn.
    His <b>Basic Attack</b> and his <b>CLAIM</b> demand nothing from the reactor, and never leave him <b>Inert</b>.

    Final Blast:
    When the Barão uses his <b>Ultimate</b>, he deals bonus damage equal to his total <b>Stored Damage</b> and resets it to <b>0</b>.`,
      pt: `
    O Barão converte o dano sofrido em energia destrutiva.

    Ele sofre <b>+${this.damageTakenBonusPercent}%</b> de dano bônus (não se aplica a <b>Dano Absoluto</b> e <b>DoT</b>).

    <b>${this.storageBasePercent}%</b> do dano sofrido é armazenado (Máx.: <b>${this.storageCap}</b>). Enquanto <b>Blindagem Reforçada</b> estiver ativa, essa taxa sobe para <b>${this.storageShieldPercent}%</b>.

    Dano Armazenado: <b>${stored > 0 ? stored : 0}</b>

    Sobrecarga do Reator:
    O núcleo nunca libera o que acabou de desencadear. Sempre que o Barão usa uma habilidade, ele fica <b>Inerte</b> no turno seguinte.
    Seu <b>Ataque Básico</b> e seu <b>CLAIM</b> não exigem nada do reator, e nunca o deixam <b>Inerte</b>.

    Explosão Final:
    Quando o Barão usa seu <b>Ultimate</b>, ele causa dano bônus igual ao total de <b>Dano Armazenado</b> e o zera.`,
    };
  },

  // 🔴 Takes 10% additional damage (minimum +10)
  onBeforeDmgTaking({ attacker, defender, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    const bonus = Math.max(
      this.damageTakenBonusFlatMin,
      damage * (this.damageTakenBonusPercent / 100),
    );
    const modifiedDamage = damage + bonus;

    return {
      damage: modifiedDamage,
    };
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    const platingHolds =
      (owner.runtime.reinforcedPlatingUntilTurn ?? 0) > context.currentTurn;

    const storageRate = platingHolds
      ? this.storageShieldPercent / 100
      : this.storageBasePercent / 100;

    const stored = damage * storageRate;

    owner.runtime = owner.runtime || {};
    owner.runtime.storedDamage = Math.min(
      this.storageCap,
      (owner.runtime.storedDamage || 0) + stored,
    );
  },

  hookScope: {
    // Only fires when the Barão is the one acting, never when he is a target.
    onActionResolved: "actionSource",
  },

  // Actions that never overload the reactor: the Basic Attack and the CLAIM.
  overloadExemptSkillKeys: ["basic_strike", CLAIM_ACTION_KEY],

  // 🔴 After using any ability (except Basic Attack and CLAIM), is left Inert on the
  // NEXT turn. It must not be applied here: actions resolve at the end of
  // the turn, so applying it on the spot would either waste it (this turn's
  // action is already resolved) or let it linger into the turn after. Instead it is
  // scheduled for the next turn, where handleStartTurn applies it with a
  // duration of 1 — long enough to deny that turn's action, gone by the
  // following start-of-turn purge.
  onActionResolved({ actionSource, owner, context, skill }) {
    if (!skill?.key) return;

    if (this.overloadExemptSkillKeys.includes(skill.key)) return;

    if (typeof context?.schedule !== "function") {
      console.warn(
        "[Passive - Barão] Reactor Overload could not be scheduled: no schedulable context.",
      );
      return;
    }

    const turnToHappen = (context.currentTurn ?? 0) + 1;

    owner.runtime ??= {};
    // Guards against scheduling the same Stun twice (e.g. a champion that acts
    // more than once in a turn).
    if (owner.runtime.overloadStunScheduledForTurn === turnToHappen) return;
    owner.runtime.overloadStunScheduledForTurn = turnToHappen;

    context.schedule({
      type: "applyStatusEffect",
      turnToHappen,
      payload: {
        targetId: owner.id,
        statusEffectKey: "inert",
        duration: 1,
        dialog: `${formatChampionName(owner)} is left <b>Inert</b> by the <b>Reactor Overload</b>!`,
      },
    });

    return {
      log: `${formatChampionName(owner)} suffered <b>Reactor Overload</b> and will be left <b>Inert</b> next turn!`,
    };
  },
};
