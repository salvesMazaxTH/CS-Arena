export default {
  key: "volcanic_heart",
  name: "Volcanic Heart",

  burnDuration: 2,

  description() {
    return {
      en: `Kael'Drath carries a volcano where his heart should be. Whenever he is struck, the aggressor is swallowed by the flames that answer for him and is left <b>Burning</b> for <b>${this.burnDuration}</b> turn(s).`,
      pt: `Kael'Drath carrega um vulcão onde deveria estar o coração. Sempre que é atingido, o agressor é engolido pelas chamas que respondem por ele e fica <b>Queimando</b> por <b>${this.burnDuration}</b> turno(s).`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, owner, actualDmg, context }) {
    if (!(actualDmg > 0) || !owner.alive) return;
    if (!attacker?.alive || attacker === owner) return;

    attacker.applyStatusEffect("burning", this.burnDuration, context);
  },
};
