import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "flashpoint",
  name: "Flashpoint",

  emberHeatPercent: 30,
  emberHeatCap: 160,
  comboChance: 25,
  burningComboBonus: 25,
  brandPiercing: 50,
  rebirthThreshold: 0.35,
  rebirthAttackPercent: 20,
  rebirthShieldRatio: 1.2,
  rebirthComboBonus: 25,

  description(champion) {
    const reborn = champion?.runtime?.victoriaReborn;
    const heatPercent = reborn
      ? this.emberHeatPercent * 2
      : this.emberHeatPercent;
    const base = reborn
      ? this.comboChance + this.rebirthComboBonus
      : this.comboChance;

    return {
      en: `Fire answers Victoria before she asks. Whenever she damages a Burning enemy she banks <b>${heatPercent}%</b> of the damage dealt as heat, up to <b>${this.emberHeatCap}</b>, and the Phoenix Aegis is what turns that heat into a <b>Shield</b>. After any action of hers that deals damage, she has a <b>${base}%</b> chance to come back at the same enemy with her Basic Strike, rising to <b>${base + this.burningComboBonus}%</b> if that enemy is Burning. The first time she is driven to <b>${this.rebirthThreshold * 100}%</b> <b>HP</b> or below, the phoenix in her wakes: she permanently gains <b>+${this.rebirthAttackPercent}%</b> <b>Attack</b>, is wrapped in a <b>Shield</b> worth <b>${this.rebirthShieldRatio * 100}%</b> of her <b>Defense</b>, and from then on banks twice the heat and adds <b>+${this.rebirthComboBonus}</b> percentage points to both of those chances.`,
      pt: `O fogo responde a Victoria antes mesmo de ela pedir. Sempre que causa dano a um inimigo <b>Queimando</b>, ela acumula <b>${heatPercent}%</b> do dano causado como calor, até um máximo de <b>${this.emberHeatCap}</b>, e é o Égide da Fênix que transforma esse calor em <b>Escudo</b>. Após qualquer ação sua que cause dano, ela tem <b>${base}%</b> de chance de voltar contra o mesmo inimigo com seu Golpe Básico, chance que sobe para <b>${base + this.burningComboBonus}%</b> se aquele inimigo estiver <b>Queimando</b>. Na primeira vez em que for reduzida a <b>${this.rebirthThreshold * 100}%</b> de <b>HP</b> ou menos, a fênix nela desperta: ganha permanentemente <b>+${this.rebirthAttackPercent}%</b> de <b>Ataque</b>, é envolta por um <b>Escudo</b> equivalente a <b>${this.rebirthShieldRatio * 100}%</b> de sua <b>Defesa</b>, e passa a acumular o dobro de calor e a somar <b>+${this.rebirthComboBonus}</b> pontos percentuais a ambas as chances.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onAfterDmgDealing: "attacker",
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
      allowOnAbsolute: true,
    },
  },

  onBeforeDmgDealing({ attacker, owner, defender, context }) {
    if (attacker !== owner) return;

    const until = defender?.runtime?.victoriaEmberBrandUntilTurn;
    if (!(until > (context?.currentTurn ?? 0))) return;

    delete defender.runtime.victoriaEmberBrandUntilTurn;

    return {
      mode: "piercing",
      piercingPercentage: this.brandPiercing,
      log: {
        en: `<b>[Passive — ${this.name}]</b> The brand on ${formatChampionName(defender)} opens up for Victoria's fist.`,
        pt: `<b>[Passiva — ${this.name}]</b> A marca em ${formatChampionName(defender)} se abre para o punho de Victoria.`,
      },
    };
  },

  onAfterDmgDealing({ attacker, owner, defender, damage, context }) {
    if (attacker !== owner || !(damage > 0)) return;
    if (!defender?.hasStatusEffect?.("burning")) return;

    const percent = owner.runtime.victoriaReborn
      ? this.emberHeatPercent * 2
      : this.emberHeatPercent;
    const gained = Math.round((Number(damage) * percent) / 100);
    if (gained <= 0) return;

    const stored = Number(owner.runtime.victoriaStoredHeat) || 0;
    if (stored >= this.emberHeatCap) return;

    owner.runtime.victoriaStoredHeat = Math.min(
      this.emberHeatCap,
      stored + gained,
    );

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> Victoria banks ${owner.runtime.victoriaStoredHeat - stored} heat from the fire on ${formatChampionName(defender)}.`,
        pt: `<b>[Passiva — ${this.name}]</b> Victoria acumula ${owner.runtime.victoriaStoredHeat - stored} de calor do fogo em ${formatChampionName(defender)}.`,
      },
    };
  },

  onAfterDmgTaking({ owner, actualDmg, context }) {
    if (!(actualDmg > 0) || !owner.alive) return;
    if (owner.runtime.victoriaReborn) return;
    if (owner.HP > owner.maxHP * this.rebirthThreshold) return;

    owner.runtime.victoriaReborn = true;

    owner.buffStat({
      statName: "Attack",
      amount: this.rebirthAttackPercent,
      isPercent: true,
      isPermanent: true,
      context,
      statModifierSrc: this.key,
    });

    owner.addShield(
      Math.round(owner.Defense * this.rebirthShieldRatio),
      0,
      context,
      "regular",
      { visualVariant: "fire" },
    );

    context.registerDialog({
      message: {
        en: `${formatChampionName(owner)} burns brighter the closer she gets to going out.`,
        pt: `${formatChampionName(owner)} queima mais forte quanto mais perto está de se apagar.`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} is reborn in flame.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} renasce em chamas.`,
      },
    };
  },

  onActionResolved({ owner, context }) {
    if (context?.isPassiveRepeat) return;
    if (!owner.alive) return;

    const events = context?.visual?.damageEvents ?? [];
    const mainHit = events
      .filter(
        (e) =>
          (e.damageDepth ?? 0) === 0 && e.sourceId === owner.id && e.amount > 0,
      )
      .sort((a, b) => b.amount - a.amount)[0];

    if (!mainHit) return;

    const target = context.allChampions?.get?.(mainHit.targetId);
    if (!target?.alive || target.team === owner.team) return;

    let chance = this.comboChance;
    if (owner.runtime.victoriaReborn) chance += this.rebirthComboBonus;
    if (target.hasStatusEffect?.("burning")) chance += this.burningComboBonus;

    if (Math.random() * 100 >= chance) return;

    context.registerDialog({
      message: {
        en: `<b>[Passive – "${this.name}"]</b> Victoria is already stepping back in.`,
        pt: `<b>[Passiva – "${this.name}"]</b> Victoria já está avançando de novo.`,
      },
      sourceId: owner.id,
      targetId: target.id,
    });

    context.repeatActionRequest = {
      userId: owner.id,
      skillKey: "basic_strike",
      targetIds: { enemy: target.id },
      priority: 0,
      speed: owner.Speed ?? 0,
    };
  },

  onTurnStart({ owner, context }) {
    const turn = context?.currentTurn ?? 0;

    for (const champion of context?.allChampions?.values?.() ?? []) {
      const until = champion?.runtime?.victoriaEmberBrandUntilTurn;
      if (until !== undefined && !(until > turn)) {
        delete champion.runtime.victoriaEmberBrandUntilTurn;
      }
    }
  },
};
