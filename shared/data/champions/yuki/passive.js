export default {
  key: "still_water",
  name: "Still Water",

  bonusDamagePercent: 30,
  evasionBonus: 10,
  evasionDuration: 1,

  description() {
    return {
      en: `Yuki was trained to end a fight in the time it takes an enemy to notice their footing is already gone. Every hit he lands against a <b>Snared</b> or <b>Rooted</b> enemy deals <b>${this.bonusDamagePercent}% bonus damage</b> and grants him <b>${this.evasionBonus} Evasion</b> for <b>${this.evasionDuration}</b> turn(s).`,
      pt: `Yuki foi treinado para pôr fim a uma luta no tempo que um inimigo leva para perceber que já não tem chão sob os pés. Cada golpe que desfere contra um inimigo <b>Enredado</b> ou <b>Enraizado</b> causa <b>${this.bonusDamagePercent}% de dano adicional</b> e lhe concede <b>${this.evasionBonus} de Evasão</b> por <b>${this.evasionDuration}</b> turno(s).`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage }) {
    if (attacker !== owner || !damage) return;
    if (!defender?.hasStatusEffect?.("snared") && !defender?.hasStatusEffect?.("rooted")) return;

    return { damage: Number(damage) * (1 + this.bonusDamagePercent / 100) };
  },

  onAfterDmgDealing({ attacker, owner, defender, actualDmg, context }) {
    if (attacker !== owner || !(actualDmg > 0)) return;
    if (!defender?.hasStatusEffect?.("snared") && !defender?.hasStatusEffect?.("rooted")) return;

    owner.modifyStat({
      statName: "Evasion",
      amount: this.evasionBonus,
      duration: this.evasionDuration,
      context,
    });
  },
};
