// shared/champions/barao_estrondoso/passive.js

import { formatChampionName } from "../../../ui/formatters.js";

//Com Blindagem Reforçada, stores ${this.storageShieldPercent}% em vez disso.

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

    return `
    The Barão converts damage taken into destructive energy.

    He takes +${this.damageTakenBonusPercent}% additional damage (does not apply to absolute damage and DoT).

    ${this.storageBasePercent}% of the damage taken is stored (Max.: ${this.storageCap}).

    Stored Damage: <b>${stored > 0 ? stored : 0}</b>

    Reactor Overload:
    After using a skill (except Basic Attack), becomes Stunned on the following turn.

    Final Blast:
    When the Barão uses his Ultimate, he deals bonus damage equal to his total Stored Damage and resets it to 0.`;
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

  // 🔴 Stores damage taken (30% or 40% while shielded)
  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (!damage || damage <= 0) return;

    /* console.log(
      `[${owner.name} - Cataclysmic Reactor] Damage taken: ${damage}`,
    );
    */

    const storageRate =
      /* owner.hasStatusEffect?.("reinforced_plating")
      ? this.storageShieldPercent / 100
      : */ this.storageBasePercent / 100;

    const stored = damage * storageRate;

    /* console.log(
      `[${owner.name} - Cataclysmic Reactor] Stored Damage: ${stored} (Rate: ${storageRate * 100}%)`,
    );
    */

    owner.runtime = owner.runtime || {};
    owner.runtime.storedDamage = Math.min(
      this.storageCap,
      (owner.runtime.storedDamage || 0) + stored,
    );

    /* console.log(
      `[${owner.name} - Cataclysmic Reactor] Total Stored Damage: ${owner.runtime.storedDamage}`,
    );
    */
  },

  // 🔴 After using any ability (except Basic Attack), becomes Stunned
  onAfterDmgDealing({ attacker, defender, owner, damage, context, skill }) {
    if (!skill?.key) return;

    // Basic Attack does not cause Stun
    if (skill.key === "basic_attack") return;

    // Prevents a loop if a future skill applies Stun internally
    if (owner.hasStatusEffect?.("stunned")) return;

    owner.applyStatusEffect?.("stunned", 2, context);

    return {
      log: `${formatChampionName(owner)} suffered <b>Reactor Overload</b> and will become <b>Stunned</b>!`,
    };
  },
};
