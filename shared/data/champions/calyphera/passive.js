import { formatChampionName } from "../../../ui/formatters.js";

export const DAMAGE_PER_FACET = 200;
const MAX_FACETS = 8;
const BONUS_PER_FACET = 5;
const TRANSFIGURED_BONUS_PER_FACET = 10;
const PASSIVE_NAME = "Every Crack a Window";

export function accrueLight(owner, amount, context) {
  if (!(amount > 0)) return [];

  owner.runtime ??= {};

  const before = owner.runtime.calypheraFacets || 0;

  if (before >= MAX_FACETS) return [];

  owner.runtime.calypheraLight = (owner.runtime.calypheraLight || 0) + amount;

  const after = Math.min(
    Math.floor(owner.runtime.calypheraLight / DAMAGE_PER_FACET),
    MAX_FACETS,
  );

  if (after === before) return [];

  owner.runtime.calypheraFacets = after;

  const name = formatChampionName(owner);
  const logs = [
    {
      log: {
        en: `<b>[Passive — ${PASSIVE_NAME}]</b> ${name} takes ${after - before} new Facet(s) (${after}/${MAX_FACETS}).`,
        pt: `<b>[Passiva — ${PASSIVE_NAME}]</b> ${name} ganha ${after - before} nova(s) Faceta(s) (${after}/${MAX_FACETS}).`,
      },
    },
  ];

  if (after < MAX_FACETS) return logs;

  owner.runtime.calypheraTransfigured = true;

  context?.registerDialog?.({
    message: {
      en: `${name} finishes breaking, and the light goes all the way through.`,
      pt: `${name} termina de se partir, e a luz a atravessa por inteiro.`,
    },
    sourceId: owner.id,
  });

  logs.push({
    log: {
      en: `<b>[Passive — ${PASSIVE_NAME}]</b> The last Facet opens. ${name} is a window now — every Facet is worth ${TRANSFIGURED_BONUS_PER_FACET}% and the fist has nothing left to break.`,
      pt: `<b>[Passiva — ${PASSIVE_NAME}]</b> A última Faceta se abre. ${name} agora é uma janela — cada Faceta vale ${TRANSFIGURED_BONUS_PER_FACET}% e o punho não tem mais nada para quebrar.`,
    },
  });

  return logs;
}

export default {
  key: "every_crack_a_window",
  name: PASSIVE_NAME,

  damagePerFacet: DAMAGE_PER_FACET,
  maxFacets: MAX_FACETS,
  bonusPerFacet: BONUS_PER_FACET,
  transfiguredBonusPerFacet: TRANSFIGURED_BONUS_PER_FACET,
  physicalVulnerabilityPercent: 15,

  description(champion) {
    const facets = champion.runtime?.calypheraFacets || 0;
    const transfigured = champion.runtime?.calypheraTransfigured;

    return {
      en: `Calyphera was given a body of glass and told to carry it kneeling, and every blow of the long fight writes another line of light through her. Every <b>${this.damagePerFacet}</b> damage she accumulates, dealt or suffered, cuts one more <b>Facet</b> into her (Max: <b>${this.maxFacets}</b>). Each <b>Facet</b> she carries raises the damage she deals by <b>${this.bonusPerFacet}%</b>.

    Glass answers the fist more readily than the word: she takes <b>${this.physicalVulnerabilityPercent}%</b> more physical damage, except <b>Absolute Damage</b>.

    The <b>${this.maxFacets}th Facet</b> finishes her, once per match and for good: every <b>Facet</b> is worth <b>${this.transfiguredBonusPerFacet}%</b> instead, and there is no longer anything solid in her for a physical blow to find.

    <b>Current Facets: ${facets}/${this.maxFacets}${transfigured ? " — Transfigured" : ""}</b>`,
      pt: `Calyphera recebeu um corpo de vidro e a ordem de carregá-lo ajoelhada, e cada golpe da longa luta grava outra linha de luz através dela. A cada <b>${this.damagePerFacet}</b> de dano acumulado, causado ou sofrido, mais uma <b>Faceta</b> se abre nela (Máx.: <b>${this.maxFacets}</b>). Cada <b>Faceta</b> que carrega eleva em <b>${this.bonusPerFacet}%</b> o dano que causa.

    O vidro responde ao punho com mais facilidade do que à palavra: ela sofre <b>${this.physicalVulnerabilityPercent}%</b> a mais de dano físico, exceto <b>Dano Absoluto</b>.

    A <b>${this.maxFacets}ª Faceta</b> a completa, uma vez por partida e para sempre: cada <b>Faceta</b> passa a valer <b>${this.transfiguredBonusPerFacet}%</b>, e não resta mais nada sólido nela para um golpe físico encontrar.

    <b>Facetas Atuais: ${facets}/${this.maxFacets}${transfigured ? " — Transfigurada" : ""}</b>`,
    };
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnNestedDamage: true },
    onAfterDmgDealing: { allowOnNestedDamage: true },
    onBeforeDmgTaking: { allowOnAbsolute: true },
  },

  onBeforeDmgTaking({ owner, type, damage, mode }) {
    if (type !== "physical") return;
    if (owner.runtime?.calypheraTransfigured) return { damage: 0 };
    // Absolute hits skip the glass-body vulnerability.
    if (mode === "absolute") return;
    return { damage: damage * (1 + this.physicalVulnerabilityPercent / 100) };
  },

  onAfterDmgTaking({ owner, attacker, damage, context }) {
    if (attacker === owner || !(damage > 0)) return;
    return accrueLight(owner, damage, context);
  },

  onAfterDmgDealing({ owner, defender, damage, context }) {
    if (defender.team === owner.team || !(damage > 0)) return;
    return accrueLight(owner, damage, context);
  },

  onBeforeDmgDealing({ owner, defender, damage }) {
    const facets = owner.runtime?.calypheraFacets || 0;

    if (!facets || defender.team === owner.team) return;

    const perFacet = owner.runtime.calypheraTransfigured
      ? this.transfiguredBonusPerFacet
      : this.bonusPerFacet;

    return { damage: damage * (1 + (facets * perFacet) / 100) };
  },
};
