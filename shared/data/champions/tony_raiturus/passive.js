import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";

export const THUNDER_RUNTIME_FLAG = "raiturusThunder";

export const THUNDER_FLAT_BONUS = 20;

// Carries splitsIntoThunder: false so the passive never splits its own thunder.
const thunderSkill = {
  key: "thunder_arrives",
  name: "The Thunder Arrives",
  element: "lightning",
  contact: false,
  splitsIntoThunder: false,
};

export function detonateThunder(owner, context) {
  const results = [];

  for (const champion of context.aliveChampions) {
    const stored = champion.runtime?.[THUNDER_RUNTIME_FLAG];
    if (!stored) continue;

    delete champion.runtime[THUNDER_RUNTIME_FLAG];

    const result = new DamageEvent({
      baseDamage: stored,
      bonusDamage: THUNDER_FLAT_BONUS,
      attacker: owner,
      defender: champion,
      skill: thunderSkill,
      type: "magical",
      cannotBeEvaded: true,
      context,
      allChampions: context.allChampions,
    }).execute();

    context.registerDialog({
      message: `The sound finally reaches ${formatChampionName(champion)}.`,
      sourceId: owner.id,
      targetId: champion.id,
    });

    results.push(...(Array.isArray(result) ? result : [result]));
  }

  return results;
}

export default {
  key: "the_flash_arrives_first",
  name: "The Flash Arrives First",

  flashPercent: 45,
  thunderPercent: 55,

  description() {
    return {
      en: `Tony Raiturus is a storm wearing a boy, and the boy is always a little ahead of the storm. Every blow he lands splits: only <b>${this.flashPercent}%</b> of it arrives as the flash, right away, while <b>${this.thunderPercent}%</b> of it hangs over the target as thunder still on its way. At the start of his next turn all of it lands at once, plus <b>${THUNDER_FLAT_BONUS}</b> bonus damage, and it <b>cannot be evaded</b> — the strike already happened, the sound is only catching up. If he falls first, the thunder arrives anyway.`,
      pt: `Tony Raiturus é uma tempestade vestindo a forma de um garoto, e o garoto está sempre um passo à frente da tempestade. Todo golpe que ele desfere se divide: apenas <b>${this.flashPercent}%</b> chega como o clarão, na hora, enquanto <b>${this.thunderPercent}%</b> fica pairando sobre o alvo como um trovão ainda a caminho. No início do turno seguinte dele, tudo isso desaba de uma vez, somado a <b>${THUNDER_FLAT_BONUS}</b> de dano bônus, e <b>não pode ser esquivado</b> — o golpe já aconteceu, o som é que está só chegando atrasado. Se ele cair antes, o trovão chega do mesmo jeito.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({
    attacker,
    owner,
    defender,
    damage,
    preMitigationDamage,
    skill,
  }) {
    if (attacker !== owner || defender === owner) return;
    if (skill?.splitsIntoThunder === false) return;

    const share = skill?.doublesThunder
      ? this.thunderPercent * 2
      : this.thunderPercent;

    // The stored share is pre-mitigation so the delayed hit is only mitigated
    // once, when it lands.
    const struck = Number(preMitigationDamage ?? damage);

    defender.runtime ??= {};
    defender.runtime[THUNDER_RUNTIME_FLAG] =
      (defender.runtime[THUNDER_RUNTIME_FLAG] ?? 0) + (struck * share) / 100;

    return { damage: (Number(damage) * this.flashPercent) / 100 };
  },

  onTurnStart({ owner, context }) {
    return detonateThunder(owner, context);
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion !== owner) return;

    return detonateThunder(owner, context);
  },
};
