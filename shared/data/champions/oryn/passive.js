export default {
  key: "lightning_rod",
  name: "Lightning Rod",

  damageReductionPercent: 20,

  description() {
    return {
      en: `Oryn was pinned with iron along his bones so the sky's lightning would always choose him first. A blow from an enemy he has <b>Taunted</b> earths through those pins instead of landing clean: he takes <b>${this.damageReductionPercent}%</b> less damage from any enemy he is currently Taunting.`,
      pt: `Oryn teve ferro cravado ao longo dos ossos para que o raio do céu sempre o escolhesse primeiro. Um golpe de um inimigo que ele está <b>Provocando</b> se aterra por esses pinos em vez de acertar em cheio: ele sofre <b>${this.damageReductionPercent}%</b> menos dano de qualquer inimigo que estiver Provocando no momento.`,
    };
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
