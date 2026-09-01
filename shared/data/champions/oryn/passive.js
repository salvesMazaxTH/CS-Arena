export default {
  key: "lightning_rod",
  name: "Lightning Rod",

  damageReductionPercent: 20,

  description() {
    return `Oryn was pinned with iron along his bones so the sky's lightning would always choose him first. A blow from an enemy he has Taunted earths through those pins instead of landing clean: he takes ${this.damageReductionPercent}% less damage from any enemy he is currently Taunting.`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking({ attacker, owner, damage }) {
    if (!attacker || !(damage > 0)) return;
    if (!attacker.isTauntedBy(owner.id)) return;

    return { damage: damage * (1 - this.damageReductionPercent / 100) };
  },
};
