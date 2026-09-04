import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "absolute_weight",
  name: "Absolute Weight",

  contactShredAmount: 45,
  claimShredAmount: 40,

  description() {
    return `Atlas carries himself like a falling sky, and nothing raised against his mace stays whole for long. Every contact hit he lands breaks ${this.contactShredAmount} Shield off the target, Piercing damage against him is always turned back into standard damage, and every time he uses CLAIM the ground itself answers — every enemy loses ${this.claimShredAmount} Shield at once.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  onAfterDmgDealing({ owner, defender, damage, contact }) {
    if (!(damage > 0) || !contact || !defender) return;

    const broken = defender.breakShields(this.contactShredAmount);
    if (!(broken > 0)) return;

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(defender)} loses ${broken} Shield to Atlas's crushing weight.`,
    };
  },

  onBeforeDmgTaking({ owner, mode }) {
    if (mode !== "piercing") return;

    return {
      mode: "standard",
      piercingPercentage: 0,
      log: `<b>[Passive — ${this.name}]</b> There is no gap in ${formatChampionName(owner)} to slip through — the hit lands as standard damage.`,
    };
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    const enemies = (context.aliveChampions ?? []).filter(
      (c) => c.team !== owner.team,
    );

    const shattered = [];
    for (const enemy of enemies) {
      const broken = enemy.breakShields(this.claimShredAmount);
      if (broken > 0) shattered.push(formatChampionName(enemy));
    }

    if (!shattered.length) return;

    return {
      log: `<b>[Passive — ${this.name}]</b> The ground answers Atlas's Claim — ${shattered.join(", ")} loses Shield to the tremor.`,
    };
  },
};
