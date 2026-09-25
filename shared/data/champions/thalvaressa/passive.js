import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "regrowth",
  name: "Regrowth",

  growthRate: 90,
  maxHPCap: 215,

  description() {
    return {
      en: `Bark does not mend — it grows over. Nothing can restore Thálvaressa's <b>HP</b>: every source of healing is worth <b>0</b> on her.

      Instead the wound itself feeds her. At the start of each turn, if she is wounded, her <b>Max HP</b> and current <b>HP</b> both rise by <b>${this.growthRate}%</b> of the missing HP, scaled down by how small that wound already is against her <b>Max HP</b> — so the bigger she grows, the less each turn gives her. Her <b>Max HP</b> never passes <b>${this.maxHPCap}%</b> of what she was planted with.`,
      pt: `Casca não cicatriza — ela cresce por cima. Nada restaura o <b>HP</b> de Thálvaressa: toda fonte de cura vale <b>0</b> nela.

      Em troca, é o próprio ferimento que a alimenta. No início de cada turno, se estiver ferida, seu <b>HP Máximo</b> e seu <b>HP</b> atual sobem juntos em <b>${this.growthRate}%</b> do HP que falta, reduzidos conforme esse ferimento já seja pequeno diante de seu <b>HP Máximo</b> — quanto maior ela fica, menos cada turno lhe rende. Seu <b>HP Máximo</b> nunca passa de <b>${this.maxHPCap}%</b> daquele com que foi plantada.`,
    };
  },

  hookScope: {
    onBeforeHealing: "healTarget",
  },

  onBeforeHealing() {
    return { amount: 0 };
  },

  onTurnStart({ owner, context }) {
    const wound = owner.maxHP - owner.HP;
    if (wound <= 0) return;

    const ceiling = Math.floor(owner.baseHP * (this.maxHPCap / 100));
    const headroom = ceiling - owner.maxHP;
    if (headroom <= 0) return;

    // Weighting the wound by its share of Max HP makes the same absolute
    // wound pay less and less as the trunk thickens.
    const growth = Math.min(
      headroom,
      Math.floor(wound * (wound / owner.maxHP) * (this.growthRate / 100)),
    );

    if (growth <= 0) return;

    owner.modifyHP(growth, {
      context: {
        ...context,
        source: "passive-regrowth",
      },
      affectMax: true,
      isPermanent: true,
    });

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} grows <b>+${growth}</b> Max HP over the wound.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} cresce <b>+${growth}</b> de HP Máximo por cima do ferimento.`,
      },
    };
  },
};
