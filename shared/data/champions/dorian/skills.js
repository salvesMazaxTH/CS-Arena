import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const dorianSkills = [
  totalBlock,

  {
    key: "sawtooth_embrace",
    name: "Sawtooth Embrace",
    bf: 15,
    maxHPPercent: 12,
    concealedBf: 25,
    concealedMaxHPPercent: 20,
    contact: true,
    damageMode: "absolute",
    hitVfx: "slash",
    priority: 0,

    description() {
      return {
        en: `Dorian folds both hollow wheels around the chosen target and draws them shut — a cut only his own hands make without losing themselves to the edge. Deals <b>Absolute Damage</b> equal to <b>${this.bf}%</b> of his <b>Attack</b> plus <b>${this.maxHPPercent}%</b> of the target's <b>Max HP</b>. Struck from <b>concealment</b> the wheels close harder — <b>${this.concealedBf}%</b> of Attack plus <b>${this.concealedMaxHPPercent}%</b> of Max HP — and stepping out of cover ends it.`,
        pt: `Dorian fecha os dois discos ocos ao redor do alvo escolhido e as trava — um corte que só suas próprias mãos fazem sem se perder no fio. Causa <b>Dano Absoluto</b> igual a <b>${this.bf}%</b> de seu <b>Ataque</b> mais <b>${this.maxHPPercent}%</b> do <b>HP Máximo</b> do alvo. Golpear se estivesse <b>oculto</b> faz os discos fecharem mais forte — <b>${this.concealedBf}%</b> de Ataque mais <b>${this.concealedMaxHPPercent}%</b> de HP Máximo — e sair da cobertura encerra o efeito.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const fromConcealment = user.hasStatusEffect("concealed");
      const bf = fromConcealment ? this.concealedBf : this.bf;
      const maxHPPercent = fromConcealment
        ? this.concealedMaxHPPercent
        : this.maxHPPercent;
      const baseDamage =
        (user.Attack * bf) / 100 + (enemy.maxHP * maxHPPercent) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        mode: DamageEvent.Modes.ABSOLUTE,
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (fromConcealment) {
        user.removeStatusEffect("concealed");
        context.registerDialog?.({
          message: {
            en: `${formatChampionName(user)} strikes from concealment!`,
            pt: `${formatChampionName(user)} ataca a partir da ocultação!`,
          },
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "fourfold_severance",
    name: "Fourfold Severance",
    bf: 65,
    healBlockDuration: 2,
    concealDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `Dorian sends both wheels wide on their wires, four hissing passes that open the chosen target before the wires reel him back out of sight. Deals ranged <b>physical damage</b>, afflicts the target with <b>Heal Block</b> for <b>${this.healBlockDuration}</b> turns, and leaves Dorian <b>Concealed</b> until he next acts.`,
        pt: `Dorian solta os dois discos em fios longos, quatro passagens sibilantes que abrem o alvo escolhido antes dos fios o puxarem de volta para fora de vista. Causa <b>dano físico</b> à distância, aflige o alvo com <b>Bloqueio de Cura</b> por <b>${this.healBlockDuration}</b> turnos, e deixa Dorian <b>Oculto</b> até sua próxima ação.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainHit = results.find((r) => r?.targetId === enemy.id);

      if (effectConnected(mainHit, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      user.removeStatusEffect("concealed");
      user.applyStatusEffect("concealed", this.concealDuration, context, {
        source: this.key,
      });

      return results;
    },
  },

  {
    key: "wheel_of_reckoning",
    name: "Wheel of Reckoning",
    bf: 120,
    enchanterMaxHPPercent: 10,
    healBlockDuration: 2,
    killBankCap: 3,
    contact: false,
    damageMode: "standard",
    hitVfx: "multislash",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `The wires snap taut and every wheel comes round at once, the whole account brought down on the chosen target. Deals heavy ranged <b>physical damage</b> and leaves the target with <b>Heal Block</b> for <b>${this.healBlockDuration}</b> turns. Against an <b>enchanter</b> it also bites for bonus damage equal to <b>${this.enchanterMaxHPPercent}%</b> of their <b>Max HP</b>. If the strike kills, Dorian's team scores points equal to his current <b>Grudge</b>, up to <b>${this.killBankCap}</b>, and the ledger empties.`,
        pt: `Os fios se retesam e todos os discos giram de uma vez, a conta inteira caindo sobre o alvo escolhido. Causa <b>dano físico</b> pesado à distância e deixa o alvo com <b>Bloqueio de Cura</b> por <b>${this.healBlockDuration}</b> turnos. Contra um <b>encantador</b> também morde por dano bônus igual a <b>${this.enchanterMaxHPPercent}%</b> de seu <b>HP Máximo</b>. Se o golpe matar, o time de Dorian marca pontos iguais à sua <b>Mágoa</b> atual, até <b>${this.killBankCap}</b>, e o livro se esvazia.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const enchanterBonus =
        enemy.classKey === "enchanter"
          ? Math.floor((enemy.maxHP * this.enchanterMaxHPPercent) / 100)
          : 0;

      const result = new DamageEvent({
        baseDamage,
        bonusDamage: enchanterBonus,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainHit = results.find((r) => r?.targetId === enemy.id);
      const landed = !!mainHit?.landed;

      if (effectConnected(mainHit, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      if (landed && enchanterBonus > 0) {
        context.registerDialog?.({
          message: {
            en: `${formatChampionName(enemy)} is an enchanter — the wheels bite deeper.`,
            pt: `${formatChampionName(enemy)} é um encantador — os discos mordem mais fundo.`,
          },
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      const killed = results.some((r) => r?.targetId === enemy.id && r?.killed);

      if (killed) {
        const banked = Math.min(user.runtime.dorianGrudge ?? 0, this.killBankCap);

        if (banked > 0) {
          context.registerScore?.({
            amount: banked,
            scoringSlot: user.team - 1,
            reason: this.key,
            sourceId: user.id,
          });
          user.runtime.dorianGrudge = 0;

          context.registerDialog?.({
            message: {
              en: `${formatChampionName(user)} closes the account in blood — ${banked} point(s) to his team.`,
              pt: `${formatChampionName(user)} fecha a conta em sangue — ${banked} ponto(s) para seu time.`,
            },
            sourceId: user.id,
          });
        }
      }

      return results;
    },
  },
];

export default dorianSkills;
