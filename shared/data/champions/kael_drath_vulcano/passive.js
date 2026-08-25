export default {
  key: "volcanic_heart",
  name: "Volcanic Heart",

  burnDuration: 2,

  description() {
    return `Kael'Drath carries a volcano where his heart should be. Whenever he is struck, the aggressor is swallowed by the flames that answer for him and is left Burning for ${this.burnDuration} turn(s).`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;
    // Never applies to himself.
    if (defender.id === owner?.id) return;

    attacker.applyStatusEffect("burning", this.burnDuration, context);
  },
};
