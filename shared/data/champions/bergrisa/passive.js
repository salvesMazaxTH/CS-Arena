import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "strata",
  name: "Strata",
  maxSediment: 20,
  sedimentPerTurn: 4,
  healPerSediment: 8,
  sedimentPerHeal: 2,
  defensePerSediment: 1.5,
  maxDefenseGain: 30,
  baseSubtraction: 10,
  subtractionPerSediment: 0.75,
  subtractionCapRatio: 0.5,
  gapRatio: 0.5,
  maxGapBonus: 60,

  description() {
    return {
      en: `Bergrisa does not move so much as accumulate. Every turn another layer of the world settles into her, <b>${this.sedimentPerTurn}</b> <b>Sediment</b> at a time up to <b>${this.maxSediment}</b>, each one granting <b>${this.defensePerSediment}</b> <b>Defense</b> up to <b>${this.maxDefenseGain}</b>. At the start of her turns, if she is wounded, she burns up to <b>${this.sedimentPerHeal}</b> <b>Sediment</b> to restore <b>${this.healPerSediment}</b> HP each. Every blow that reaches her is blunted by <b>${this.baseSubtraction}</b> plus <b>${this.subtractionPerSediment}</b> per <b>Sediment</b>, never past half the blow, and never <b>Absolute Damage</b>, damage over time or piercing hits. Everything she deals carries bonus damage equal to <b>${this.gapRatio * 100}%</b> of however much her <b>Defense</b> exceeds the chosen target's, up to <b>${this.maxGapBonus}</b>.`,
      pt: `Bergrisa não se move tanto quanto acumula. A cada turno outra camada do mundo se assenta sobre ela, <b>${this.sedimentPerTurn}</b> de <b>Sedimento</b> por vez até <b>${this.maxSediment}</b>, cada um concedendo <b>${this.defensePerSediment}</b> de <b>Defesa</b> até <b>${this.maxDefenseGain}</b>. No início de seus turnos, se estiver ferida, ela queima até <b>${this.sedimentPerHeal}</b> de <b>Sedimento</b> para restaurar <b>${this.healPerSediment}</b> de HP cada. Todo golpe que a atinge é amortecido em <b>${this.baseSubtraction}</b> mais <b>${this.subtractionPerSediment}</b> por <b>Sedimento</b>, nunca além de metade do golpe, e nunca <b>Dano Absoluto</b>, dano ao longo do tempo ou acertos perfurantes. Tudo o que ela causa carrega dano bônus igual a <b>${this.gapRatio * 100}%</b> de quanto sua <b>Defesa</b> excede a do alvo escolhido, até <b>${this.maxGapBonus}</b>.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBeforeDmgTaking: "defender",
  },

  subtractionFor(owner) {
    const sediment = owner.runtime?.bergrisaSediment || 0;
    return Math.round(
      this.baseSubtraction + this.subtractionPerSediment * sediment,
    );
  },

  blunt(damage, subtraction) {
    return Math.max(
      damage - subtraction,
      Math.round(damage * (1 - this.subtractionCapRatio)),
    );
  },

  setSediment(owner, value) {
    owner.runtime ??= {};
    owner.runtime.bergrisaSediment = Math.max(
      0,
      Math.min(this.maxSediment, value),
    );

    const granted = owner.runtime.bergrisaDefenseGranted || 0;
    const target = Math.min(
      this.maxDefenseGain,
      Math.round(this.defensePerSediment * owner.runtime.bergrisaSediment),
    );
    if (target === granted) return;

    owner.Defense = Math.max(0, (owner.Defense || 0) + (target - granted));
    owner.runtime.bergrisaDefenseGranted = target;
  },

  onBeforeDmgDealing({ attacker, defender, skill }) {
    if (!defender) return;

    const ratio = skill?.defenseGapRatio ?? this.gapRatio;
    const gap = (attacker.Defense || 0) - (defender.Defense || 0);
    if (gap <= 0 || ratio <= 0) return;

    const cap = skill?.maxGapBonus ?? this.maxGapBonus;

    return { bonusDamage: Math.min(cap, Math.round(gap * ratio)) };
  },

  onBeforeDmgTaking({ owner, damage, mode, piercingPercentage }) {
    if (!(damage > 0)) return;
    if (mode === "piercing" || (piercingPercentage || 0) > 0) return;

    return { damage: this.blunt(damage, this.subtractionFor(owner)) };
  },

  onTurnStart({ owner, context }) {
    if (!owner.alive) return;

    const missing = (owner.maxHP || 0) - (owner.HP || 0);
    if (missing <= 0) return;

    const spent = Math.min(
      this.sedimentPerHeal,
      owner.runtime?.bergrisaSediment || 0,
      Math.ceil(missing / this.healPerSediment),
    );
    if (spent <= 0) return;

    const healed = new HealEvent({
      target: owner,
      amount: spent * this.healPerSediment,
      context,
    }).execute();

    this.setSediment(owner, (owner.runtime.bergrisaSediment || 0) - spent);

    return {
      log: `<b>[Passive - Strata]</b> ${formatChampionName(owner)} burned ${spent} Sediment and restored ${healed} HP.`,
    };
  },

  onTurnEnd({ owner }) {
    if (!owner.alive) return;

    this.setSediment(
      owner,
      (owner.runtime?.bergrisaSediment || 0) + this.sedimentPerTurn,
    );
  },
};
