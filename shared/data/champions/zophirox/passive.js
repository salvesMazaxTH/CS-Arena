import { formatChampionName } from "../../../ui/formatters.js";

// The one Defense modifier Worn Skin currently holds on each Zophiróx, so a new
// stack replaces it with a deeper one instead of piling modifiers up.
const wornSkinModifiers = new WeakMap();

export default {
  key: "molting_cycle",
  name: "Molting Cycle",

  moltThreshold: 7,
  defenseLossPerStack: 3,
  evasionGained: 25,
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
      en: `Zophiróx's old skin was never made for this much fighting, and every blow traded rubs it thinner. Whenever he lands a contact hit on an enemy, or an enemy lands one on him, he gains <b>1</b> stack of <b>Worn Skin</b>, and each stack costs him <b>${this.defenseLossPerStack}%</b> of his <b>Defense</b>. At <b>${this.moltThreshold}</b> stacks he sheds it for good: every stack and the <b>Defense</b> it cost are gone, every negative status effect on him comes off with the old skin, and the new scales underneath grant him <b>+${this.evasionGained}</b> permanent <b>Evasion</b>. He molts only once.

      ${status.en}`,
      pt: `A pele velha de Zophiróx nunca foi feita para tanta briga, e cada golpe trocado a deixa mais fina. Sempre que ele acerta um golpe de contato em um inimigo, ou um inimigo acerta um nele, ele ganha <b>1</b> acúmulo de <b>Pele Gasta</b>, e cada acúmulo lhe custa <b>${this.defenseLossPerStack}%</b> da <b>Defesa</b>. Com <b>${this.moltThreshold}</b> acúmulos ele a troca de vez: os acúmulos e a <b>Defesa</b> que custaram somem, todo efeito de status negativo sobre ele sai junto com a pele velha, e as escamas novas por baixo lhe dão <b>+${this.evasionGained}</b> de <b>Esquiva</b> permanente. Ele só troca de pele uma vez.

      ${status.pt}`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onAfterDmgTaking: "defender",
  },

  // A blow is a blow: an Absolute contact hit wears the skin like any other.
  hookPolicies: {
    onAfterDmgDealing: { allowOnAbsolute: true },
    onAfterDmgTaking: { allowOnAbsolute: true },
  },

  onAfterDmgDealing({ owner, defender, damage, contact, context }) {
    if (!contact || !(damage > 0)) return;
    if (!defender || defender.team === owner.team) return;
    return this._wear({ owner, context });
  },

  onAfterDmgTaking({ owner, attacker, damage, contact, context }) {
    if (context?.isDot || !contact || !(damage > 0)) return;
    if (!attacker || attacker.team === owner.team) return;
    return this._wear({ owner, context });
  },

  _wear({ owner, context }) {
    if (!owner.alive || owner.runtime.zophiroxMolted) return;

    const stacks = (Number(owner.runtime.zophiroxWornSkin) || 0) + 1;
    owner.runtime.zophiroxWornSkin = stacks;

    this._clearDefenseLoss(owner);

    if (stacks >= this.moltThreshold) return this._molt({ owner, context });

    const modifierCount = owner.statModifiers.length;

    owner.modifyStat({
      statName: "Defense",
      amount: -stacks * this.defenseLossPerStack,
      isPercent: true,
      isPermanent: true,
      context,
      statModifierSrc: owner,
    });

    if (owner.statModifiers.length > modifierCount) {
      wornSkinModifiers.set(owner, owner.statModifiers.at(-1));
    }
  },

  _clearDefenseLoss(owner) {
    const modifier = wornSkinModifiers.get(owner);
    if (!modifier) return;
    owner.removeStatModifiers([modifier]);
    wornSkinModifiers.delete(owner);
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
        en: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} molts, shedding his negative effects and gaining +${this.evasionGained} permanent Evasion!`,
        pt: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} troca de pele, deixando para trás os efeitos negativos e ganhando +${this.evasionGained} de Esquiva permanente!`,
      },
    };
  },
};
