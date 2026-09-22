import { regularShieldTotal } from "../../../core/championCombat.js";
import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "hunger_of_the_flame",
  name: "Hunger of the Flame",

  maxStacks: 5,
  dmgPerStackPercent: 4,
  minEmbersToSurvive: 2,
  survivalPercentPerEmber: 8,

  description(champion) {
    const stacks = champion.runtime?.emberStacks || 0;

    return {
      en: `Every wound just feeds it. Whenever it takes damage, it gains <b>1 Ember</b> stack (Max: <b>${this.maxStacks}</b>), and each stack adds <b>${this.dmgPerStackPercent}%</b> bonus damage to its own attacks. A blow that would put it out instead burns every Ember it holds and leaves it standing on up to <b>${this.survivalPercentPerEmber}%</b> of its Max HP per Ember spent — but only from <b>${this.minEmbersToSurvive}</b> Embers up, and never on the turn it took this shape.

    <b>Current Embers: ${stacks}/${this.maxStacks}</b>`,
      pt: `Cada ferimento só o alimenta. Sempre que sofre dano, ganha <b>1 Brasa</b> em estoque (máx.: <b>${this.maxStacks}</b>), e cada Brasa acrescenta <b>${this.dmgPerStackPercent}%</b> de dano adicional aos próprios ataques. Um golpe que o apagaria, em vez disso, consome todas as Brasas acumuladas e o mantém de pé com até <b>${this.survivalPercentPerEmber}%</b> do seu HP Máximo por Brasa gasta — mas só a partir de <b>${this.minEmbersToSurvive}</b> Brasas, e nunca no turno em que assumiu essa forma.

    <b>Brasas atuais: ${stacks}/${this.maxStacks}</b>`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
    onBeforeDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
      allowOnAbsolute: true,
    },
  },

  onBeforeDmgTaking({ owner, defender, damage, context }) {
    if (defender !== owner || !(damage > 0)) return;
    if (owner.runtime.shadowflameArrivedTurn === context.currentTurn) return;
    if (!owner.wouldBeLethal(damage)) return;

    const stacks = owner.runtime.emberStacks || 0;
    if (stacks < this.minEmbersToSurvive) return;

    owner.runtime.emberStacks = 0;

    const survivalHP = Math.round(
      (owner.maxHP * this.survivalPercentPerEmber * stacks) / 100,
    );

    context.registerDialog({
      message: {
        en: `The Flame spends every Ember at once — ${formatChampionName(owner)} will not be put out.`,
        pt: `A Chama gasta todas as Brasas de uma vez — ${formatChampionName(owner)} não vai se apagar.`,
      },
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      damageCap: Math.max(
        owner.HP + regularShieldTotal(owner) - survivalHP,
        0,
      ),
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} burns <b>${stacks}</b> Ember(s) to stay standing at <b>${survivalHP}</b> HP.`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} consome <b>${stacks}</b> Brasa(s) para continuar de pé com <b>${survivalHP}</b> HP.`,
      },
    };
  },

  onAfterDmgTaking({ owner, actualDmg }) {
    if (!(actualDmg > 0) || !owner.alive) return;

    owner.runtime ??= {};
    const stacks = owner.runtime.emberStacks || 0;
    if (stacks >= this.maxStacks) return;

    owner.runtime.emberStacks = stacks + 1;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} gains <b>1 Ember</b> (${owner.runtime.emberStacks}/${this.maxStacks}).`,
        pt: `<b>[Passivo — ${this.name}]</b> ${formatChampionName(owner)} ganha <b>1 Brasa</b> (${owner.runtime.emberStacks}/${this.maxStacks}).`,
      },
    };
  },

  onBeforeDmgDealing({ attacker, owner, damage }) {
    if (attacker !== owner) return;
    const stacks = owner.runtime?.emberStacks || 0;
    if (stacks <= 0) return;

    return {
      damage: Number(damage) * (1 + (this.dmgPerStackPercent * stacks) / 100),
    };
  },
};
