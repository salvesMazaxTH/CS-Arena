import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";

export default {
  key: "absolute_weight",
  name: "Absolute Weight",

  contactShredAmount: 45,
  claimShredAmount: 40,

  description() {
    return {
      en: `Atlas carries himself like a falling sky, and nothing raised against his mace stays whole for long. Every contact hit he lands breaks <b>${this.contactShredAmount}</b> <b>Shield</b> off the target, <b>Piercing</b> damage against him is always turned back into standard damage, and every time he uses <b>CLAIM</b> the ground itself answers — every enemy loses <b>${this.claimShredAmount}</b> <b>Shield</b> at once.`,
      pt: `Atlas se carrega como um céu em queda, e nada erguido contra sua maça permanece inteiro por muito tempo. Todo golpe de contato que ele acerta quebra <b>${this.contactShredAmount}</b> de <b>Escudo</b> do alvo, dano <b>Perfurante</b> contra ele é sempre convertido em dano padrão, e toda vez que ele usa <b>CLAIM</b> o próprio chão responde — todo inimigo perde <b>${this.claimShredAmount}</b> de <b>Escudo</b> de uma vez.`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  onAfterDmgDealing({ defender, damage, contact }) {
    if (!(damage > 0) || !contact || !defender) return;

    const broken = defender.breakShields(this.contactShredAmount);
    if (!(broken > 0)) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(defender)} loses ${broken} Shield to Atlas's crushing weight.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(defender)} perde ${broken} de Escudo sob o peso esmagador de Atlas.`,
      },
    };
  },

  onBeforeDmgTaking({ owner, mode }) {
    if (mode !== "piercing") return;

    return {
      mode: "standard",
      piercingPercentage: 0,
      log: {
        en: `<b>[Passive — ${this.name}]</b> There is no gap in ${formatChampionName(owner)} to slip through — the hit lands as standard damage.`,
        pt: `<b>[Passiva — ${this.name}]</b> Não há brecha em ${formatChampionName(owner)} por onde passar — o golpe acerta como dano padrão.`,
      },
    };
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    const enemies = TargetFilter.candidates(
      "enemy",
      owner,
      context.aliveChampions ?? [],
    );

    const shattered = [];
    for (const enemy of enemies) {
      const broken = enemy.breakShields(this.claimShredAmount);
      if (broken > 0) shattered.push(formatChampionName(enemy));
    }

    if (!shattered.length) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> The ground answers Atlas's CLAIM — ${shattered.join(", ")} loses Shield to the tremor.`,
        pt: `<b>[Passiva — ${this.name}]</b> O chão responde ao CLAIM de Atlas — ${shattered.join(", ")} perde Escudo com o tremor.`,
      },
    };
  },
};
