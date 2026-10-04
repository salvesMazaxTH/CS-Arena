import thorns from "../../statusEffects/thorns.js";

const thornsTier = (champion) => champion.statusEffects?.get("thorns")?.tier ?? 0;

export default {
  key: "growing_spines",
  name: "Growing Spines",
  startingTier: 1,
  tierGain: 1,

  hookScope: { onAfterDmgDealing: "attacker" },

  description() {
    return {
      en: `Every blow Zaguroth lands drives his spines deeper into his own hide, and they grow back longer. He enters the field with permanent <b>Thorns</b>. At the end of each turn in which he hit an enemy with contact, his <b>Thorns</b> rise by <b>${this.tierGain}</b> tier.`,
      pt: `Cada golpe que Zaguroth acerta crava seus espinhos mais fundo no próprio couro, e eles voltam a crescer mais longos. Ele entra em campo com <b>Espinhos</b> permanentes. Ao fim de cada turno em que acertou um inimigo com contato, seus <b>Espinhos</b> sobem <b>${this.tierGain}</b> nível.`,
    };
  },

  onChampionAdded({ owner, champion, context }) {
    if (champion !== owner) return;

    owner.runtime.landedContactHit = false;
    owner.applyStatusEffect(
      "thorns",
      Infinity,
      context,
      { persistent: true, sourceId: owner.id },
      this.startingTier,
    );
  },

  onAfterDmgDealing({ owner, defender, contact }) {
    if (!contact || !defender || defender.team === owner.team) return;
    owner.runtime.landedContactHit = true;
  },

  onTurnEnd({ owner, context }) {
    if (!owner.runtime.landedContactHit) return;
    owner.runtime.landedContactHit = false;

    if (!owner.alive || thornsTier(owner) >= thorns.maxTier) return;

    owner.applyStatusEffect(
      "thorns",
      Infinity,
      context,
      { persistent: true, sourceId: owner.id },
      this.tierGain,
    );
  },
};
