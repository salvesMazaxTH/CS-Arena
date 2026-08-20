import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "verdict_of_the_pyre",
  name: "Verdict of the Pyre",

  // --- Judgment (anti-armor) ---
  // 1% of the target's Defense is ignored for each point of Defense the
  // target has above D'Lorafya's own.
  piercingPerExcessPoint: 1,
  piercingCap: 75,
  piercingCapVsBurning: 100,

  // --- Kindling (setup) ---
  emberAttackGain: 10,
  emberDuration: 3,

  description(champion) {
    return (
      `<b>Judgment:</b> those who hide behind armor are judged by it. When D'Lorafya damages a target whose Defense is higher than his own, ` +
      `the hit becomes Piercing, ignoring <b>${this.piercingPerExcessPoint}%</b> of the target's Defense for each point of Defense it has above his ` +
      `(max <b>${this.piercingCap}%</b>). If the target is <b>Burning</b>, the cap is lifted to <b>${this.piercingCapVsBurning}%</b>, and at full judgment the hit becomes <b>Absolute</b> — ignoring Defense <i>and</i> all damage reduction.<br>` +
      `<b>Kindling:</b> the first time each turn D'Lorafya damages a Burning enemy with Fire, he gains <b>+${this.emberAttackGain} Attack</b> for ${this.emberDuration} turn(s) (stacking).`
    );
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, mode, piercingPercentage }) {
    if (attacker !== owner) return;
    if (!defender) return;
    if (mode === "absolute") return;

    const excess = Number(defender.Defense || 0) - Number(owner.Defense || 0);
    if (excess <= 0) return;

    const cap = defender.hasStatusEffect?.("burning")
      ? this.piercingCapVsBurning
      : this.piercingCap;

    const judged = Math.min(cap, excess * this.piercingPerExcessPoint);

    // At full judgment the verdict is Absolute, not merely Piercing. 100%
    // Piercing already zeroes the target's Defense, but Absolute additionally
    // bypasses their flat/percentage damage reduction — which is exactly the
    // armor-stacking defender this clause exists to punish.
    if (judged >= 100) {
      return {
        mode: "absolute",
        log:
          `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} passes final judgment on ` +
          `${formatChampionName(defender)}: the flame ignores their Defense and all damage reduction entirely.`,
      };
    }

    // Never downgrade a hit that already pierces harder.
    if (mode === "piercing" && Number(piercingPercentage || 0) >= judged) {
      return;
    }

    return {
      mode: "piercing",
      piercingPercentage: judged,
      log:
        `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)}'s flame judges ` +
        `${formatChampionName(defender)}'s armor, ignoring ${Math.round(judged)}% of their Defense.`,
    };
  },

  onAfterDmgDealing({ attacker, owner, defender, damage, element, context }) {
    if (attacker !== owner) return;
    if (!damage || damage <= 0) return;
    if (element !== "fire") return;
    if (!defender?.hasStatusEffect?.("burning")) return;

    const turn = context?.currentTurn ?? 0;
    if (owner.runtime.dlorafyaKindlingTurn === turn) return;
    owner.runtime.dlorafyaKindlingTurn = turn;

    owner.modifyStat({
      statName: "Attack",
      amount: this.emberAttackGain,
      duration: this.emberDuration,
      context,
      statModifierSrc: owner,
    });

    return {
      log:
        `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} feeds on the pyre ` +
        `and gains +${this.emberAttackGain} Attack.`,
    };
  },
};
