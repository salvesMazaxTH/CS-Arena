import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

const BASE_HIT_CHANCE = 70;
const HIT_CHANCE_PER_STEADY = 15;
const MAX_STEADY = 2;

const STILLNESS_BONUS_DAMAGE = 25;
const MAX_STILLNESS = 3;

const COLD_ZERO_KEY = "cold_zero";

const PASSIVE_TAG = "<b>[Passive — Held Breath]</b>";

export function hitChance(owner) {
  const steady = owner.runtime?.weyneSteady || 0;
  return Math.min(BASE_HIT_CHANCE + steady * HIT_CHANCE_PER_STEADY, 100);
}

export function stillnessBonus(owner) {
  return (owner.runtime?.weyneStillness || 0) * STILLNESS_BONUS_DAMAGE;
}

export default {
  key: "held_breath",
  name: "Held Breath",

  baseHitChance: BASE_HIT_CHANCE,
  hitChancePerSteady: HIT_CHANCE_PER_STEADY,
  maxSteady: MAX_STEADY,
  stillnessBonusDamage: STILLNESS_BONUS_DAMAGE,
  maxStillness: MAX_STILLNESS,

  description(champion) {
    const steady = champion.runtime?.weyneSteady || 0;
    const stillness = champion.runtime?.weyneStillness || 0;

    return {
      en: `Weyne breathes out, and the breath hangs frozen in front of the scope until the city below her stops moving. Her <b>Basic Shot</b> is the only thing in her kit that can miss: it lands <b>${this.baseHitChance}%</b> of the time, and every turn she ends without losing <b>HP</b> adds <b>${this.hitChancePerSteady}%</b> to that (Max: <b>${this.maxSteady}</b> turn(s), a certainty).

      Every turn she spends not shooting, she gathers one <b>stack</b> of <b>Stillness</b> (Max: <b>${this.maxStillness}</b>), and every shot she fires carries <b>${this.stillnessBonusDamage}</b> bonus damage for each stack she holds. Shooting does not spend them: losing <b>HP</b> does, and it empties her hit chance in the same moment.

      <b>Hit chance: ${hitChance(champion)}% — Stillness: ${stillness}/${this.maxStillness} (Steady: ${steady}/${this.maxSteady})</b>`,
      pt: `Weyne solta o ar, e a respiração fica congelada na frente da mira até a cidade abaixo dela parar de se mexer. Seu <b>Tiro Básico</b> é a única coisa no kit dela que pode errar: ele acerta <b>${this.baseHitChance}%</b> das vezes, e cada turno que ela termina sem perder <b>HP</b> soma <b>${this.hitChancePerSteady}%</b> a isso (Máx: <b>${this.maxSteady}</b> turno(s), uma certeza).

      A cada turno que ela passa sem atirar, ela ganha um <b>acúmulo</b> de <b>Quietude</b> (Máx: <b>${this.maxStillness}</b>), e cada tiro que ela dispara carrega <b>${this.stillnessBonusDamage}</b> de dano bônus para cada acúmulo que ela mantém. Atirar não os consome: perder <b>HP</b> consome, e isso zera sua chance de acerto no mesmo instante.

      <b>Chance de acerto: ${hitChance(champion)}% — Quietude: ${stillness}/${this.maxStillness} (Estabilidade: ${steady}/${this.maxSteady})</b>`,
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

    owner.runtime ??= {};
    owner.runtime.weyneDisturbed = true;

    const lost = (owner.runtime.weyneSteady || 0) + (owner.runtime.weyneStillness || 0);

    owner.runtime.weyneSteady = 0;
    owner.runtime.weyneStillness = 0;

    if (!lost) return;

    return {
      log: `${PASSIVE_TAG} ${formatChampionName(owner)} is knocked off the scope and loses her hold on the shot.`,
    };
  },

  onActionResolved({ owner, skill, context }) {
    const key = skill?.key;

    if (key !== CLAIM_ACTION_KEY && key !== COLD_ZERO_KEY) {
      return;
    }

    owner.runtime ??= {};

    const stacks = owner.runtime.weyneStillness || 0;
    if (stacks >= MAX_STILLNESS) return;

    owner.runtime.weyneStillness = stacks + 1;

    if (owner.runtime.weyneStillness < MAX_STILLNESS) {
      return {
        log: `${PASSIVE_TAG} ${formatChampionName(owner)} holds the shot and gathers Stillness (${owner.runtime.weyneStillness}/${MAX_STILLNESS}).`,
      };
    }

    context?.registerDialog?.({
      message: `${formatChampionName(owner)} has stopped moving entirely. The next round is already written.`,
      sourceId: owner.id,
    });

    return {
      log: `${PASSIVE_TAG} ${formatChampionName(owner)} reaches full Stillness — every shot she fires now carries ${MAX_STILLNESS * STILLNESS_BONUS_DAMAGE} bonus damage.`,
    };
  },

  onTurnEnd({ owner, context }) {
    if (!owner.alive) return;

    owner.runtime ??= {};

    if (owner.runtime.weyneDisturbed) {
      owner.runtime.weyneDisturbed = false;
      return;
    }

    const steady = owner.runtime.weyneSteady || 0;
    if (steady >= MAX_STEADY) return;

    owner.runtime.weyneSteady = steady + 1;

    if (owner.runtime.weyneSteady < MAX_STEADY) return;

    context?.registerDialog?.({
      message: `${formatChampionName(owner)} settles behind the frozen barrel. Nothing is going to move her now.`,
      sourceId: owner.id,
    });

    return {
      log: `${PASSIVE_TAG} ${formatChampionName(owner)} is fully zeroed — her Basic Shot cannot miss while she keeps her HP.`,
    };
  },
};
