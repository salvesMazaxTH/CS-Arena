import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const INDICT_MARK_KEY = "sky_courts_indicted";

const orynSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "draw_the_sky_down",
    name: "Draw the Sky Down",

    tauntDuration: 2,
    damageReductionPercent: 12,
    damageReductionDuration: 2,

    contact: false,
    priority: 3,
    element: "lightning",

    description() {
      return {
        en: `Oryn lifts the pins in his forearms and the air leans toward him. He <b>Taunts</b> the chosen enemy for <b>${this.tauntDuration}</b> turn(s), releasing any enemy he was already Taunting, and braces for the answer, gaining <b>${this.damageReductionPercent}%</b> Damage Reduction for <b>${this.damageReductionDuration}</b> turn(s).`,
        pt: `Oryn levanta os pinos em seus antebraços e o ar se inclina em sua direção. Ele <b>Provoca</b> o inimigo escolhido por <b>${this.tauntDuration}</b> turno(s), liberando qualquer inimigo que já estivesse Provocando, e se prepara para a resposta, ganhando <b>${this.damageReductionPercent}%</b> de Redução de Dano por <b>${this.damageReductionDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      user.damageReductionModifiers = user.damageReductionModifiers.filter(
        (mod) => mod.source !== this.key,
      );

      user.applyDamageReduction({
        amount: this.damageReductionPercent,
        duration: this.damageReductionDuration,
        type: "percent",
        source: this.key,
        context,
      });

      // The sky only leans toward one at a time.
      for (const champ of context.aliveChampions) {
        champ.tauntEffects = champ.tauntEffects.filter(
          (taunt) => taunt.taunterId !== user.id,
        );
      }

      const logs = [];
      for (const enemy of targets) {
        if (!enemy?.alive) continue;
        const tauntLog = enemy.applyTaunt(user.id, this.tauntDuration, context);
        if (tauntLog) logs.push(tauntLog);
      }

      logs.unshift({
        log: {
          en: `${formatChampionName(user)} uses <b>Draw the Sky Down</b> and braces, gaining <b>${this.damageReductionPercent}%</b> Damage Reduction.`,
          pt: `${formatChampionName(user)} usa <b>Draw the Sky Down</b> e se prepara, ganhando <b>${this.damageReductionPercent}%</b> de Redução de Dano.`,
        },
      });
      return logs;
    },
  },

  {
    key: "earthing_lance",
    name: "Earthing Lance",

    defenseScaling: 55,
    paralyzeDuration: 2,

    contact: true,
    damageMode: "standard",
    priority: 1,
    element: "lightning",
    hitVfx: "grounded_charge",

    description() {
      return {
        en: `Oryn drives a pin into the chosen enemy and lets the charge he has been carrying run down it, dealing <b>Lightning magical damage</b> equal to <b>${this.defenseScaling}%</b> of his Defense and leaving them <b>Paralyzed</b> for <b>${this.paralyzeDuration}</b> turn(s).`,
        pt: `Oryn crava um pino no inimigo escolhido e deixa a carga que vinha carregando correr por ele, causando <b>dano mágico de Raio</b> igual a <b>${this.defenseScaling}%</b> da sua Defesa e deixando-o <b>Paralisado</b> por <b>${this.paralyzeDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Defense * this.defenseScaling) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzeDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  {
    key: "sentence_of_the_sky_courts",
    name: "Sentence of the Sky-Courts",

    indictDuration: 2,
    dischargePercent: 65,
    dischargePiercing: 40,
    paralyzeDuration: 2,
    maxDischarges: 2,
    shieldAmount: 80,
    shieldDecayPerTurn: 40,

    contact: false,
    isUltimate: true,
    momentumCost: 58,
    priority: 2,
    element: "lightning",

    hits: [
      {
        id: "discharge",
        type: "magical",
        damageMode: "piercing",
        piercingPercentage: 40,
      },
    ],

    description() {
      return {
        en: `The pins in Oryn's body finish their work and the sky-courts hand down their sentence on the whole enemy line — a sentence, not a blow. For <b>${this.indictDuration}</b> turns, the first time each <b>Indicted</b> enemy deals damage the charge grounds through them for <b>Lightning magical damage</b> equal to <b>${this.dischargePercent}%</b> of that blow, piercing <b>${this.dischargePiercing}%</b> of their Defense, leaving them <b>Paralyzed</b> for <b>${this.paralyzeDuration}</b> turn(s) and banking Oryn's team <b>1</b> point; at most once per turn and <b>${this.maxDischarges}</b> times each, and nothing if Oryn has fallen. He stands under a <b>${this.shieldAmount}</b> Shield that thins as the courts sit.`,
        pt: `Os pinos no corpo de Oryn terminam seu trabalho e os tribunais do céu proferem sua sentença sobre toda a linha inimiga — uma sentença, não um golpe. Por <b>${this.indictDuration}</b> turnos, na primeira vez que cada inimigo <b>Indiciado</b> causar dano, a carga se descarrega através dele em <b>dano mágico de Raio</b> igual a <b>${this.dischargePercent}%</b> daquele golpe, perfurando <b>${this.dischargePiercing}%</b> de sua Defesa, deixando-o <b>Paralisado</b> por <b>${this.paralyzeDuration}</b> turno(s) e rendendo <b>1</b> ponto ao time de Oryn; no máximo uma vez por turno e <b>${this.maxDischarges}</b> vezes por alvo, e nada se Oryn tiver caído. Ele fica sob um Escudo de <b>${this.shieldAmount}</b> que se afina enquanto os tribunais permanecem reunidos.`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const skill = this;
      const list = Array.isArray(targets) ? targets : targets ? [targets] : [];
      const castTurn = context.currentTurn;
      const marked = [];

      for (const enemy of list) {
        if (!enemy?.alive) continue;

        enemy.runtime.hookEffects ??= [];
        enemy.runtime.hookEffects = enemy.runtime.hookEffects.filter(
          (e) => e.key !== INDICT_MARK_KEY,
        );

        enemy.addHookEffect(
          {
            type: "debuff",
            key: INDICT_MARK_KEY,
            name: "Indicted",
            group: "skill",
            ownerId: user.id,
            expiresAtTurn: castTurn + this.indictDuration + 1,
            castTurn,
            paralyzeDuration: this.paralyzeDuration,
            maxDischarges: this.maxDischarges,
            dischargesUsed: 0,
            lastDischargeTurn: 0,

            hookScope: { onAfterDmgDealing: "attacker" },

            onAfterDmgDealing({ owner, damage, context }) {
              if (context.currentTurn <= this.castTurn) return;
              if (!(damage > 0)) return;
              if (this.lastDischargeTurn === context.currentTurn) return;
              if (this.dischargesUsed >= this.maxDischarges) return;

              const oryn = context.allChampions?.get?.(this.ownerId);
              if (!oryn?.alive || !owner.alive) return;

              this.lastDischargeTurn = context.currentTurn;
              this.dischargesUsed += 1;
              if (this.dischargesUsed >= this.maxDischarges) {
                owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
                  (e) => e !== this,
                );
              }

              const result = SkillHits.run(skill, "discharge", {
                user: oryn,
                target: owner,
                baseDamage: (damage * skill.dischargePercent) / 100,
                context,
              });

              const arr = Array.isArray(result) ? result : [result];

              if (effectConnected(arr[0], "paralyzed")) {
                owner.applyStatusEffect(
                  "paralyzed",
                  this.paralyzeDuration,
                  context,
                  { sourceId: oryn.id },
                );
              }

              context.registerScore?.({
                amount: 1,
                scoringSlot: oryn.team - 1,
                reason: this.key,
                sourceId: oryn.id,
              });

              const targetName = formatChampionName(owner);
              context.registerDialog?.({
                message: {
                  en: `⚡ The sky-courts ground their sentence through ${targetName}!`,
                  pt: `⚡ Os tribunais do céu descarregam sua sentença através de ${targetName}!`,
                },
                sourceId: oryn.id,
                targetId: owner.id,
              });

              const sentenceLog = {
                en: `<b>Sentence of the Sky-Courts</b> grounds through ${targetName} — Oryn's team banks 1 point.`,
                pt: `<b>Sentence of the Sky-Courts</b> se descarrega através de ${targetName} — o time de Oryn marca 1 ponto.`,
              };

              return {
                log: [sentenceLog, arr[0]?.log].flat(Infinity).filter(Boolean),
              };
            },
          },
          context,
        );

        marked.push(formatChampionName(enemy));
      }

      user.addShield(this.shieldAmount, this.shieldDecayPerTurn, context);

      context.registerDialog?.({
        message: {
          en: `⚖️ The sky-courts sit — ${marked.length} enem${marked.length === 1 ? "y is" : "ies are"} Indicted.`,
          pt: `⚖️ Os tribunais do céu se reúnem — ${marked.length} inimigo${marked.length === 1 ? " é Indiciado" : "s são Indiciados"}.`,
        },
        sourceId: user.id,
        targetId: user.id,
      });

      return {
        log: {
          en: `${formatChampionName(user)} hands down <b>Sentence of the Sky-Courts</b> on ${marked.join(", ")} and stands under a <b>${this.shieldAmount}</b> Shield.`,
          pt: `${formatChampionName(user)} profere <b>Sentence of the Sky-Courts</b> sobre ${marked.join(", ")} e fica sob um Escudo de <b>${this.shieldAmount}</b>.`,
        },
      };
    },
  },
];

export default orynSkills;
