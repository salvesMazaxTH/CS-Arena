import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

const heldBreath = {
  key: "held_breath",
  name: "Held Breath",

  baseHitChance: 70,
  hitChancePerSteady: 15,
  maxSteady: 2,
  stillnessBonusDamage: 25,
  maxStillness: 3,
  stillnessActionKeys: [CLAIM_ACTION_KEY, "cold_zero"],

  description(champion) {
    const steady = champion.runtime?.weyneSteady || 0;
    const stillness = champion.runtime?.weyneStillness || 0;
    const maxHitChance = Math.min(
      this.baseHitChance + this.maxSteady * this.hitChancePerSteady,
      100,
    );

    return {
      en: `Weyne breathes out, and the breath hangs frozen in front of the scope until the city below her stops moving. Her <b>Basic Shot</b> is the only thing in her kit she can miss on her own account: her aim holds <b>${this.baseHitChance}%</b> of the time, and every turn she ends without losing <b>HP</b> adds <b>${this.hitChancePerSteady}%</b> to that (Max: <b>${this.maxSteady}</b> turn(s), <b>${maxHitChance}%</b>).

      Every turn she holds fire by choice, with a <b>CLAIM</b> or <b>Cold Zero</b>, she gathers one <b>stack</b> of <b>Stillness</b> (Max: <b>${this.maxStillness}</b>), and every shot she fires carries <b>${this.stillnessBonusDamage}</b> bonus damage for each stack she holds. Shooting does not spend them: losing <b>HP</b> does, and it drops her aim back to <b>${this.baseHitChance}%</b> in the same moment.

      Hit chance: <b>${hitChance(champion)}%</b> — Stillness: <b>${stillness}/${this.maxStillness}</b> (Steady: <b>${steady}/${this.maxSteady}</b>)`,
      pt: `Weyne solta o ar, e a respiração fica congelada na frente da mira até a cidade abaixo dela parar de se mexer. Seu <b>Tiro Básico</b> é a única coisa do kit que ela pode errar por conta própria: a mira dela se sustenta em <b>${this.baseHitChance}%</b> das vezes, e cada turno que ela termina sem perder <b>HP</b> soma <b>${this.hitChancePerSteady}%</b> a isso (Máx: <b>${this.maxSteady}</b> turno(s), <b>${maxHitChance}%</b>).

      A cada turno em que ela segura o tiro por escolha, com um <b>CLAIM</b> ou com <b>Cold Zero</b>, ela ganha um <b>acúmulo</b> de <b>Quietude</b> (Máx: <b>${this.maxStillness}</b>), e cada tiro que ela dispara carrega <b>${this.stillnessBonusDamage}</b> de dano bônus para cada acúmulo que ela mantém. Atirar não os consome: perder <b>HP</b> consome, e no mesmo instante a mira dela volta a <b>${this.baseHitChance}%</b>.

      Chance de acerto: <b>${hitChance(champion)}%</b> — Quietude: <b>${stillness}/${this.maxStillness}</b> (Estabilidade: <b>${steady}/${this.maxSteady}</b>)`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onAfterDmgTaking({ owner, actualDmg }) {
    if (!owner.alive || !(actualDmg > 0)) return;

    owner.runtime.weyneDisturbed = true;

    const lost = (owner.runtime.weyneSteady || 0) + (owner.runtime.weyneStillness || 0);

    owner.runtime.weyneSteady = 0;
    owner.runtime.weyneStillness = 0;

    if (!lost) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} is knocked off the scope and loses her hold on the shot.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} é arrancada da mira e perde o controle do tiro.`,
      },
    };
  },

  onActionResolved({ owner, skill, context }) {
    if (!this.stillnessActionKeys.includes(skill?.key)) return;

    const stacks = owner.runtime.weyneStillness || 0;
    if (stacks >= this.maxStillness) return;

    owner.runtime.weyneStillness = stacks + 1;

    if (owner.runtime.weyneStillness < this.maxStillness) {
      return {
        log: {
          en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} holds the shot and gathers Stillness (${owner.runtime.weyneStillness}/${this.maxStillness}).`,
          pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} segura o tiro e ganha Quietude (${owner.runtime.weyneStillness}/${this.maxStillness}).`,
        },
      };
    }

    context?.registerDialog?.({
      message: {
        en: `${formatChampionName(owner)} has stopped moving entirely. The next round is already written.`,
        pt: `${formatChampionName(owner)} parou de se mexer por completo. O próximo tiro já está escrito.`,
      },
      sourceId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} reaches full Stillness — every shot she fires now carries ${this.maxStillness * this.stillnessBonusDamage} bonus damage.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} atinge a Quietude máxima — cada tiro que ela dispara agora carrega ${this.maxStillness * this.stillnessBonusDamage} de dano bônus.`,
      },
    };
  },

  onTurnEnd({ owner, context }) {
    if (!owner.alive) return;

    // An unfired Cold Zero lapses once its window closes.
    if (owner.runtime.weyneZeroedUntilTurn <= (context?.currentTurn ?? 0)) {
      delete owner.runtime.weyneZeroedUntilTurn;
    }

    if (owner.runtime.weyneDisturbed) {
      owner.runtime.weyneDisturbed = false;
      return;
    }

    const steady = owner.runtime.weyneSteady || 0;
    if (steady >= this.maxSteady) return;

    owner.runtime.weyneSteady = steady + 1;

    if (owner.runtime.weyneSteady < this.maxSteady) return;

    context?.registerDialog?.({
      message: {
        en: `${formatChampionName(owner)} settles behind the frozen barrel. Nothing is going to move her now.`,
        pt: `${formatChampionName(owner)} se firma atrás do cano congelado. Nada vai tirá-la do lugar agora.`,
      },
      sourceId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} is fully steady — her aim holds at ${hitChance(owner)}% while she keeps her HP.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} está totalmente estável — a mira dela se sustenta em ${hitChance(owner)}% enquanto ela não perder HP.`,
      },
    };
  },
};

export function hitChance(owner) {
  const steady = owner.runtime?.weyneSteady || 0;
  return Math.min(
    heldBreath.baseHitChance + steady * heldBreath.hitChancePerSteady,
    100,
  );
}

export function stillnessBonus(owner) {
  return (owner.runtime?.weyneStillness || 0) * heldBreath.stillnessBonusDamage;
}

export default heldBreath;
