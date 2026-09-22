import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";

const maliMagarcSkills = [
  { ...basicShot, type: "magical", bonusDamage: 25 },

  {
    key: "unshaped_arc",
    name: "Unshaped Arc",

    bf: 75,
    damageMode: "piercing",
    piercingPercentage: 40,
    momentumSpend: 10,
    essenceBonus: 25,

    contact: false,
    hitVfx: "arcane_bolt",
    priority: 0,

    description() {
      return {
        en: `Mali Magarc opens the star-charted hand and lets the hoarded essence go the way raw magic wants to, straight through the chosen target's guard — it ignores <b>${this.piercingPercentage}%</b> of their <b>Defense</b>. When he can spend <b>${this.momentumSpend}</b> Momentum the arc carries <b>${this.essenceBonus}</b> bonus damage; when he cannot, it still lands without it. Deals <b>magical damage</b>.`,
        pt: `Mali Magarc abre a mão marcada pelas estrelas e deixa a essência acumulada seguir o caminho que a magia bruta sempre quis, direto através da guarda do alvo escolhido — ignorando <b>${this.piercingPercentage}%</b> da <b>Defesa</b> dele. Quando pode gastar <b>${this.momentumSpend}</b> de Momentum, o arco carrega <b>${this.essenceBonus}</b> de dano bônus; quando não pode, o golpe ainda assim acerta sem ele. Causa <b>dano mágico</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {}, resolver }) {
      const [enemy] = targets;

      let paid = false;
      if (user.momentum >= this.momentumSpend) {
        const { applied } = resolver.applyResourceChange({
          target: user,
          amount: -this.momentumSpend,
          context,
          sourceId: user.id,
          debugLabel: "mali_unshaped_arc",
        });
        paid = Math.abs(applied) > 0;
      }

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: paid ? this.essenceBonus : 0,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "unwrite_the_spell",
    name: "Unwrite the Spell",

    bf: 70,
    momentumRefund: 8,

    contact: false,
    damageMode: "standard",
    hitVfx: "arcane_bolt",
    priority: 0,

    description() {
      return {
        en: `Mali Magarc reads the borrowed magic wrapped around the chosen target, names it aloud, and lets it come apart. Unmakes one positive status effect on them, and if one falls its essence returns to him as <b>${this.momentumRefund}</b> Momentum. Deals <b>magical damage</b>.`,
        pt: `Mali Magarc lê a magia emprestada que envolve o alvo escolhido, a nomeia em voz alta, e a deixa se desfazer. Desfaz um efeito positivo do alvo, e se algum cair, sua essência retorna a ele como <b>${this.momentumRefund}</b> de Momentum. Causa <b>dano mágico</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {}, resolver }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];
      if (!results.some((r) => r?.landed)) return results;

      const [stripped] = enemy.getStatusEffects({ type: "buff" });
      if (!stripped) return results;

      enemy.removeStatusEffect(stripped.key);

      resolver.applyResourceChange({
        target: user,
        amount: this.momentumRefund,
        context,
        sourceId: user.id,
        debugLabel: "mali_unwrite_the_spell",
      });

      context.registerDialog?.({
        message: {
          en: `${formatChampionName(user)} unwrites ${stripped.name ?? stripped.key} from ${formatChampionName(enemy)}.`,
          pt: `${formatChampionName(user)} desfaz ${stripped.name ?? stripped.key} de ${formatChampionName(enemy)}.`,
        },
        sourceId: user.id,
        targetId: enemy.id,
      });

      results.push({
        log: {
          en: `${formatChampionName(user)} unmakes a positive effect on ${formatChampionName(enemy)} and takes back <b>${this.momentumRefund}</b> Momentum.`,
          pt: `${formatChampionName(user)} desfaz um efeito positivo de ${formatChampionName(enemy)} e recupera <b>${this.momentumRefund}</b> de Momentum.`,
        },
      });

      return results;
    },
  },

  {
    key: "unfold_the_first_magic",
    name: "Unfold the First Magic",

    bf: 110,

    contact: false,
    damageMode: "standard",
    hitVfx: "arcane_bolt_big",
    isUltimate: true,
    momentumCost: 50,
    priority: 0,

    transformInto: "mali_magarc_primordial",
    transformDuration: 2,

    description() {
      return {
        en: `The shape Mali Magarc wears was always a courtesy to the arena, and he withdraws it. He strikes the chosen target once, then unfolds into the raw arcane he ruled before it had a name — his <b>Primordial Form</b> — for <b>${this.transformDuration}</b> turn(s), replacing his skills, his passive and his stats. As he unfolds, one positive status effect is unmade on every enemy. Deals <b>magical damage</b>.`,
        pt: `A forma que Mali Magarc veste sempre foi uma cortesia à arena, e agora ele a retira. Golpeia o alvo escolhido uma vez, depois se desdobra no arcano bruto que governava antes de ter nome — sua <b>Forma Primordial</b> — por <b>${this.transformDuration}</b> turno(s), substituindo suas habilidades, sua passiva e seus atributos. Ao se desdobrar, um efeito positivo é desfeito em cada inimigo. Causa <b>dano mágico</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];

      context.requestChampionMutation({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.transformDuration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      results.push({
        log: {
          en: `${formatChampionName(user)} withdraws his worn shape and unfolds into his <b>Primordial Form</b> for <b>${this.transformDuration}</b> turn(s)!`,
          pt: `${formatChampionName(user)} retira a forma que vestia e se desdobra em sua <b>Forma Primordial</b> por <b>${this.transformDuration}</b> turno(s)!`,
        },
      });

      let stripped = 0;
      for (const champ of context.aliveChampions) {
        if (champ.team === user.team || !champ.alive) continue;

        const [buff] = champ.getStatusEffects({ type: "buff" });
        if (!buff) continue;

        champ.removeStatusEffect(buff.key);
        stripped++;

        context.registerDialog?.({
          message: {
            en: `The refinement peels off ${formatChampionName(champ)} before the dragon.`,
            pt: `O refinamento se desprende de ${formatChampionName(champ)} diante do dragão.`,
          },
          sourceId: user.id,
          targetId: champ.id,
        });
      }

      if (stripped) {
        results.push({
          log: {
            en: `<b>${stripped}</b> positive effect(s) are unmade as ${formatChampionName(user)} unfolds.`,
            pt: `<b>${stripped}</b> efeito(s) positivo(s) são desfeitos enquanto ${formatChampionName(user)} se desdobra.`,
          },
        });
      }

      return results;
    },
  },
];

export default maliMagarcSkills;
