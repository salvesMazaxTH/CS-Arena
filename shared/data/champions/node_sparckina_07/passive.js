import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "live_current",
  name: "Live Current",
  speedBuff: 10,
  paralyzeChance: 20,
  paralyzeDuration: 2,
  groundingWindow: 2,
  description() {
    return {
      en: `A current never stops running through Node-SPARCKINA-07's frame. Every turn, the surge builds and raises its <b>Speed</b> by <b>${this.speedBuff}%</b>.

      Whenever it deals damage, there is a <b>${this.paralyzeChance}%</b> chance the discharge locks the target's body down, applying <b>Paralyzed</b> for <b>${this.paralyzeDuration}</b> turn(s).

      A <b>CLAIM</b> winds the discharge instead of loosing it: the next hit it lands, this turn or the next, is a certain Paralyze.`,
      pt: `O chassi de Node-SPARCKINA-07 vive percorrido por corrente elétrica. A cada turno, a sobrecarga aumenta e eleva sua <b>Velocidade</b> em <b>${this.speedBuff}%</b>.

      Sempre que causa dano, há <b>${this.paralyzeChance}%</b> de chance de a descarga travar o corpo do alvo, aplicando <b>Paralisado</b> por <b>${this.paralyzeDuration}</b> turno(s).

      Um <b>CLAIM</b> acumula a descarga em vez de liberá-la: o próximo acerto que causar, neste turno ou no seguinte, é uma Paralisia garantida.`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    owner.runtime ??= {};
    owner.runtime.groundingCycleUntilTurn =
      context.currentTurn + this.groundingWindow;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} winds the discharge through the <b>CLAIM</b> — its next hit is a certain Paralyze.`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} acumula a descarga através do <b>CLAIM</b> — seu próximo acerto é uma Paralisia garantida.`,
      },
    };
  },

  onTurnStart({ owner, context }) {
    const result = owner.modifyStat({
      statName: "Speed",
      amount: this.speedBuff,
      context,
      isPermanent: true,
      isPercent: true,
    });

    if (result?.appliedAmount === 0) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} gains <b>+${result?.appliedAmount ?? this.speedBuff}</b> Speed.`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} ganha <b>+${result?.appliedAmount ?? this.speedBuff}</b> de Velocidade.`,
      },
    };
  },

  onAfterDmgDealing({ attacker, defender, owner, damage, context }) {
    if (damage <= 0) return;

    const grounded =
      owner.runtime?.groundingCycleUntilTurn != null &&
      context.currentTurn < owner.runtime.groundingCycleUntilTurn;

    // Spent on the next damaging hit, land or not.
    if (grounded) owner.runtime.groundingCycleUntilTurn = null;

    const success = grounded || Math.random() < this.paralyzeChance / 100;

    if (!success) return;

    const paralyzed = defender.applyStatusEffect(
      "paralyzed",
      this.paralyzeDuration,
      context,
      {
        sourceId: owner.id,
        sourceName: owner.name,
      },
    );

    if (!paralyzed) return;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(attacker)} leaves ${formatChampionName(defender)} <b>Paralyzed</b> for <b>${this.paralyzeDuration}</b> turn(s)!`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(attacker)} deixa ${formatChampionName(defender)} <b>Paralisado</b> por <b>${this.paralyzeDuration}</b> turno(s)!`,
      },
    };
  },
};
