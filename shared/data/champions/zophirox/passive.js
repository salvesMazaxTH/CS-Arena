import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "molting_cycle",
  name: "Molting Cycle",

  moltThreshold: 7,
  defenseLossPerStack: 3,
  evasionGained: 25,
  damageBonusPercent: 20,
  damageModifierId: "zophirox-molted-fangs",
  moltedPortrait: "/assets/portraits/zophirox_transcended.webp",

  description(champion) {
    const molted = champion?.runtime?.zophiroxMolted === true;
    const stacks = Number(champion?.runtime?.zophiroxWornSkin) || 0;

    const status = molted
      ? {
          en: `He has already molted.`,
          pt: `Ele já trocou de pele.`,
        }
      : {
          en: `Worn Skin: <b>${stacks}</b>/<b>${this.moltThreshold}</b> (<b>-${stacks * this.defenseLossPerStack}%</b> <b>Defense</b>).`,
          pt: `Pele Gasta: <b>${stacks}</b>/<b>${this.moltThreshold}</b> (<b>-${stacks * this.defenseLossPerStack}%</b> de <b>Defesa</b>).`,
        };

    return {
      en: `Zophiróx's old skin was never made for this much fighting, and every blow traded rubs it thinner. Whenever he lands a contact hit on an enemy, or an enemy lands one on him, he gains <b>1</b> stack of <b>Worn Skin</b>, and each stack costs him <b>${this.defenseLossPerStack}%</b> of his <b>Defense</b>. At <b>${this.moltThreshold}</b> stacks he sheds it for good: every stack and the <b>Defense</b> it cost are gone, every negative status effect on him comes off with the old skin, and the new scales underneath grant him <b>+${this.evasionGained}</b> permanent <b>Evasion</b>, while his fresh fangs make all his damage <b>${this.damageBonusPercent}%</b> greater for the rest of the match. He molts only once.

      ${status.en}`,
      pt: `A pele velha de Zophiróx nunca foi feita para tanta briga, e cada golpe trocado a deixa mais fina. Sempre que ele acerta um golpe de contato em um inimigo, ou um inimigo acerta um nele, ele ganha <b>1</b> acúmulo de <b>Pele Gasta</b>, e cada acúmulo lhe custa <b>${this.defenseLossPerStack}%</b> da <b>Defesa</b>. Com <b>${this.moltThreshold}</b> acúmulos ele a troca de vez: os acúmulos e a <b>Defesa</b> que custaram somem, todo efeito de status negativo sobre ele sai junto com a pele velha, e as escamas novas por baixo lhe dão <b>+${this.evasionGained}</b> de <b>Esquiva</b> permanente, enquanto as presas recém-nascidas tornam todo o dano dele <b>${this.damageBonusPercent}%</b> maior até o fim da partida. Ele só troca de pele uma vez.

      ${status.pt}`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onAfterDmgTaking: "defender",
  },

  onAfterDmgDealing({ owner, defender, damage, contact, context }) {
    if (!contact || !(damage > 0)) return;
    if (!defender || defender.team === owner.team) return;
    return this._wear({ owner, context });
  },

  onAfterDmgTaking({ owner, attacker, damage, contact, context }) {
    if (!contact || !(damage > 0)) return;
    if (!attacker || attacker.team === owner.team) return;
    return this._wear({ owner, context });
  },

  _wear({ owner, context }) {
    if (!owner.alive || owner.runtime.zophiroxMolted) return;

    const stacks = (Number(owner.runtime.zophiroxWornSkin) || 0) + 1;
    owner.runtime.zophiroxWornSkin = stacks;

    this._clearDefenseLoss(owner);

    if (stacks >= this.moltThreshold) return this._molt({ owner, context });

    // A new stack replaces the held modifier with a deeper one instead of piling up.
    const from = owner.statModifiers.length;

    owner.modifyStat({
      statName: "Defense",
      amount: -stacks * this.defenseLossPerStack,
      isPercent: true,
      isPermanent: true,
      context,
      statModifierSrc: owner,
    });

    owner.runtime.zophiroxWornSkinModifiers = owner.statModifiers.slice(from);
  },

  _clearDefenseLoss(owner) {
    const held = owner.runtime.zophiroxWornSkinModifiers;
    if (!held?.length) return;
    owner.removeStatModifiers(held);
    delete owner.runtime.zophiroxWornSkinModifiers;
  },

  _molt({ owner, context }) {
    owner.runtime.zophiroxMolted = true;
    owner.runtime.zophiroxWornSkin = 0;
    owner.portrait = this.moltedPortrait;

    for (const effect of owner.getStatusEffects({ type: "debuff" })) {
      owner.removeStatusEffect(effect.key);
    }

    owner.modifyStat({
      statName: "Evasion",
      amount: this.evasionGained,
      context,
      isPermanent: true,
    });

    owner.addDamageModifier({
      id: this.damageModifierId,
      name: "Molting Cycle (Fresh Fangs)",
      permanent: true,
      apply: ({ baseDamage }) =>
        baseDamage * (1 + this.damageBonusPercent / 100),
    });

    context?.registerDialog?.({
      message: {
        en: `${formatChampionName(owner)} sheds his old skin!`,
        pt: `${formatChampionName(owner)} troca a pele velha!`,
      },
      sourceId: owner.id,
      targetId: owner.id,
      duration: 1600,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} molts, shedding his negative effects and gaining +${this.evasionGained} permanent Evasion and +${this.damageBonusPercent}% damage!`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} troca de pele, deixando para trás os efeitos negativos e ganhando +${this.evasionGained} de Esquiva permanente e +${this.damageBonusPercent}% de dano!`,
      },
    };
  },
};
