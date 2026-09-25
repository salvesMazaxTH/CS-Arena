import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "hammer_of_justice",
  name: "The Hammer of Justice",

  judgmentPiercingPercent: 50,
  judgmentBonusDmgPercent: 20,
  dragonBonusDmgPercent: 20,

  description() {
    return {
      en: `Valeria answers every unearned gain. The first hit she lands after an enemy scores with <b>CLAIM</b> comes down as Judgment: guaranteed <b>${this.judgmentPiercingPercent}%</b> <b>Piercing</b> damage, plus <b>${this.judgmentBonusDmgPercent}%</b> bonus damage. Dragonkind she has already taken the measure of once, and against it she deals a further <b>${this.dragonBonusDmgPercent}%</b> bonus damage. Her wings never let the ground decide where she stands, so <b>Rooted</b> and <b>Snared</b> effects never take hold on her.`,
      pt: `Valeria cobra por todo ganho não merecido. O primeiro golpe que ela desfere depois de um inimigo pontuar com <b>CLAIM</b> cai como um Julgamento: <b>${this.judgmentPiercingPercent}%</b> de dano <b>Perfurante</b> garantido, mais <b>${this.judgmentBonusDmgPercent}%</b> de dano bônus. Contra dragões, que ela já mediu de perto uma vez, ela causa ainda mais <b>${this.dragonBonusDmgPercent}%</b> de dano bônus. Suas asas nunca deixam o chão decidir onde ela pisa, então os efeitos <b>Enraizado</b> e <b>Enredado</b> nunca a prendem.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onStatusEffectIncoming: "target",
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner?.alive || !actionSource) return;
    if (actionSource.team === owner.team) return;

    owner.runtime ??= {};
    owner.runtime.judgmentReady = true;

    context?.registerDialog?.({
      message: `${formatChampionName(owner)} weighs the scales — someone is about to pay for that.`,
      sourceId: owner.id,
      targetId: owner.id,
    });
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, baseDamage }) {
    if (attacker !== owner) return;

    let multiplier = 1;
    let piercing = false;

    if (owner.runtime?.judgmentReady) {
      owner.runtime.judgmentReady = false;
      multiplier += this.judgmentBonusDmgPercent / 100;
      piercing = true;
    }

    if (defender?.species?.some((s) => s === "dragon" || s === "primordial dragon")) {
      multiplier += this.dragonBonusDmgPercent / 100;
    }

    if (multiplier === 1) return;

    // Dragon bonus alone leaves the mitigation untouched, so scaling the already
    // mitigated hit is correct. Judgment changes the hit to Piercing, so it has
    // to work from the raw damage and let the pipeline re-mitigate once.
    if (!piercing) {
      return { damage: Number(damage) * multiplier };
    }

    const boosted = Number(baseDamage ?? damage ?? 0) * multiplier;

    return {
      baseDamage: boosted,
      preMitigationDamage: boosted,
      mode: "piercing",
      piercingPercentage: this.judgmentPiercingPercent,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.key !== "rooted" && statusEffect.key !== "snared") return;

    return {
      cancel: true,
      message: `${formatChampionName(target)} simply takes to the air — the ground has nothing left to hold.`,
    };
  },
};
