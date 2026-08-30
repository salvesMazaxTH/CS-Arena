// shared/data/emblems/permafrost.js

export const permafrost = {
  key: "permafrost",
  name: "Emblem of the Permafrost",

  baseDamageReductionPercent: 7,
  iceDamageReductionPercent: 12,
  iceHitShieldPercent: 25,

  requirements: {
    elementalAffinity: {
      element: "ice",
      count: 3,
    },
  },

  description() {
    return `The cold your team carries is the settled kind — old ice that has forgotten how to melt and does not feel a fresh chill land on it. Every allied champion is immune to Chilled and takes ${this.baseDamageReductionPercent}% less damage, rising to ${this.iceDamageReductionPercent}% against Ice damage; when Ice damage does land, ${this.iceHitShieldPercent}% of it freezes onto the champion as a Shield.`;
  },

  hookScope: {
    onStatusEffectIncoming: "target",
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  // Ice champions already shrug off Chilled and Frozen natively; this extends
  // only the Chilled half to the rest of the team, never Frozen.
  onStatusEffectIncoming({ target, statusEffect, owner }) {
    if (!target || !owner || target.team !== owner.team) return;
    if (statusEffect?.key !== "chilled") return;

    return {
      cancel: true,
      message: `<b>[Emblem — Permafrost]</b> ${target.name}'s cold is too old to feel the chill.`,
    };
  },

  onBeforeDmgTaking({ defender, owner, element, damage }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (!(damage > 0)) return;

    const percent =
      element === "ice"
        ? this.iceDamageReductionPercent
        : this.baseDamageReductionPercent;

    return { damage: damage * (1 - percent / 100) };
  },

  onAfterDmgTaking({ defender, owner, element, actualDmg, context }) {
    if (!defender || !owner || defender.team !== owner.team) return;
    if (element !== "ice" || !(actualDmg > 0)) return;

    const shield = Math.floor(actualDmg * (this.iceHitShieldPercent / 100));
    if (shield <= 0) return;

    defender.addShield(shield, 0, context, "regular");

    return {
      log: `<b>[Emblem — Permafrost]</b> the Ice that struck ${defender.name} freezes into a ${shield} HP Shield.`,
    };
  },
};
