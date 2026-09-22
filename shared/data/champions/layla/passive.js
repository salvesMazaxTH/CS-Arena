import { formatChampionName } from "../../../ui/formatters.js";

export const STATIC_STACKS_KEY = "laylaStatic";

const EXPOSED_EFFECTS = ["stunned", "paralyzed", "snared", "rooted"];

export default {
  key: "buried_static",
  name: "Buried Static",

  maxStacks: 3,
  bonusPerStack: 12,
  readCritBonus: 60,

  description() {
    return {
      en: `Layla learned to survive by watching every door. Layla's fear never stops watching: every time an enemy damages her she banks 1 <b>Static</b>, up to <b>${this.maxStacks}</b>, and her next damaging ability spends all of it for +<b>${this.bonusPerStack}%</b> damage per <b>Static</b>.

      She never strikes lucky, only certain. Her observations are precise: any damaging hit she lands on an enemy who is <b>Stunned</b>, <b>Paralyzed</b>, <b>Snared</b>, or <b>Rooted</b> is a guaranteed critical hit, landing at <b>${(1 + this.readCritBonus / 100).toFixed(2)}x</b>.`,
      pt: `Layla aprendeu a sobreviver vigiando cada porta. O medo de Layla nunca para de vigiar: toda vez que um inimigo a machuca, ela acumula 1 <b>Static</b>, até <b>${this.maxStacks}</b>, e sua próxima habilidade de dano gasta tudo isso para causar +<b>${this.bonusPerStack}%</b> de dano por <b>Static</b>.

      Ela nunca acerta por sorte, só por certeza. Suas observações são precisas: qualquer golpe de dano que ela desfira contra um inimigo <b>Atordoado</b>, <b>Paralisado</b>, <b>Enredado</b> ou <b>Enraizado</b> é um acerto crítico garantido, com multiplicador de <b>${(1 + this.readCritBonus / 100).toFixed(2)}x</b>.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgTaking({ owner, actualDmg }) {
    if (!(actualDmg > 0) || !owner.alive) return;

    const current = owner.runtime[STATIC_STACKS_KEY] ?? 0;
    if (current >= this.maxStacks) return;

    owner.runtime[STATIC_STACKS_KEY] = current + 1;
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, crit, skill, context }) {
    if (attacker !== owner || !damage || skill?.damageMode === undefined) return;

    const stacks = owner.runtime[STATIC_STACKS_KEY] ?? 0;
    if (stacks > 0) owner.runtime[STATIC_STACKS_KEY] = 0;

    const exposed = EXPOSED_EFFECTS.some((key) =>
      defender?.hasStatusEffect?.(key),
    );

    const result = {};
    if (stacks > 0) {
      result.damage = Number(damage) * (1 + (stacks * this.bonusPerStack) / 100);
    }
    if (exposed && !crit?.didCrit) {
      result.crit = {
        ...(crit ?? {}),
        didCrit: true,
        forced: true,
        disabled: false,
        bonus: this.readCritBonus,
      };
      context?.registerDialog?.({
        message: {
          en: `${formatChampionName(owner)} already has the opening in ${formatChampionName(defender)} measured.`,
          pt: `${formatChampionName(owner)} já tem a brecha em ${formatChampionName(defender)} medida.`,
        },
        sourceId: owner.id,
        targetId: defender.id,
      });
    }

    return Object.keys(result).length ? result : undefined;
  },
};
