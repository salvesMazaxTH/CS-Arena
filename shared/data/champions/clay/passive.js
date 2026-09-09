import { regularShieldTotal } from "../../../core/championCombat.js";
import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "old_grudge",
  name: "Old Grudge",

  bonusDmgPercent: 25,
  ascensionThreshold: 0.30,
  grudgeChance: 51,
  divineBloodBonus: 15,
  absolutePenalty: 15,
  ascendsInto: "clay_godslayer",
  corruptsInto: "lord_of_the_shadowflame",

  description() {
    return `Clay doesn't care how the bloodline is dressed up — the whip felt the same either way. Every hit he lands deals ${this.bonusDmgPercent}% bonus damage against enemies of divine or demigod blood. The first time he is driven to ${this.ascensionThreshold * 100}% HP or below, what he becomes depends on how he got there: his own hand finally opening the wound makes him rise as <b>Clay, Godslayer</b>; an enemy forcing it out of him instead answers with something older and hungrier. A blow that would put him down before any of that happens finds the grudge in the way: his own hand always drags him back to the brink, an enemy's only ${this.grudgeChance}% of the time — ${this.divineBloodBonus}% likelier if divine or demigod blood swung it, ${this.absolutePenalty}% less if the damage was Absolute, and only once.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  // Any real HP loss counts toward the brink, reflected and burning included,
  // and nothing may finish him before the grudge has had its say.
  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
    onBeforeDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
      allowOnAbsolute: true,
    },
  },

  onBeforeDmgTaking({ owner, defender, attacker, damage, mode, context }) {
    if (defender !== owner || !(damage > 0)) return;
    if (owner.runtime.clayAscended || owner.runtime.clayGrudgeSpent) return;
    if (!owner.wouldBeLethal(damage)) return;

    owner.runtime.clayGrudgeSpent = true;

    const bySelf = attacker === owner;

    if (!bySelf) {
      let odds = this.grudgeChance;
      if (attacker?.species?.some((s) => s === "divinity" || s === "demigod")) {
        odds += this.divineBloodBonus;
      }
      if (mode === "absolute") odds -= this.absolutePenalty;

      if (Math.random() * 100 >= odds) return;
    }

    // Landing exactly on the threshold both opens the ascension below and
    // carries a 30% ratio into whichever form he rises as.
    const survivalHP = Math.floor(owner.maxHP * this.ascensionThreshold);

    context.registerDialog({
      message: `${formatChampionName(owner)} should be on the floor. The grudge is not finished with him.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damage: Math.max(
        owner.HP + regularShieldTotal(owner) - survivalHP,
        0,
      ),
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} refuses to go down with the debt unpaid.`,
    };
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, context }) {
    if (attacker !== owner) return;
    if (!Array.isArray(defender?.species)) return;
    if (!defender.species.some((s) => s === "divinity" || s === "demigod"))
      return;

    context.registerDialog({
      message: `${formatChampionName(owner)} bears down harder — divine blood bleeds the same as any master's did.`,
      sourceId: owner.id,
      targetId: defender.id,
    });

    return {
      damage: Number(damage) * (1 + this.bonusDmgPercent / 100),
    };
  },

  onAfterDmgTaking({ owner, attacker, actualDmg, context }) {
    if (!(actualDmg > 0) || !owner.alive) return;
    if (owner.runtime.clayAscended) return;
    if (owner.HP > owner.maxHP * this.ascensionThreshold) return;

    owner.runtime.clayAscended = true;
    owner.runtime.shadowflameArrivedTurn = context.currentTurn;

    const shadowflameClaimed =
      context.matchChampions.some((c) => c.championKey === this.corruptsInto) ||
      (context.flags.championMutationRequests ?? []).some(
        (r) => r.newChampionKey === this.corruptsInto,
      );
    const bySelf = attacker === owner;
    const newChampionKey =
      bySelf || shadowflameClaimed ? this.ascendsInto : this.corruptsInto;

    // No duration: the ascension never reverts.
    context.requestChampionMutation({
      mode: "transform",
      targetId: owner.id,
      newChampionKey,
      hpMode: "preserveRatio",
      statMode: "deltaFromBase",
    });

    const risesAs =
      newChampionKey === this.ascendsInto
        ? "Clay, Godslayer"
        : "the Lord of the Shadowflame";

    context.registerDialog({
      message: `${formatChampionName(owner)} stops being something anyone can put back in chains.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} rises as <b>${risesAs}</b>.`,
    };
  },
};
