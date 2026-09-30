import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";

const alexaNeruvyaSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },
  // ========================
  // Special Abilities
  // ========================

  {
    key: "the_tide_bows",
    name: "The Tide Bows",

    healAmount: 60,
    contact: false,
    priority: 2,
    element: "water",

    description() {
      return {
        en: `The Exiled One lifts two fingers and the sea lifts with them, because it has never once been asked twice. The water comes up around the chosen ally in slow coils and closes over everything it finds open, restoring <b>${this.healAmount}</b> <b>HP</b>.`,
        pt: `A Exilada ergue dois dedos e o mar se ergue com eles, pois nunca precisou ser pedido duas vezes. A água sobe em espirais lentas ao redor do aliado escolhido e se fecha sobre tudo o que encontra aberto, restaurando <b>${this.healAmount}</b> de <b>HP</b>.`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      const restored = new HealEvent({
        target: ally,
        amount: this.healAmount,
        context,
        source: user,
      }).execute();

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);
      const isSelf = ally.id === user.id;

      return {
        log: {
          en: `${userName} restores ${restored} HP to ${isSelf ? "herself" : allyName}. ${allyName} is now at ${ally.HP}/${ally.maxHP} HP.`,
          pt: `${userName} restaura ${restored} de HP a ${isSelf ? "si mesma" : allyName}. ${allyName} agora está com ${ally.HP}/${ally.maxHP} de HP.`,
        },
      };
    },
  },

  {
    key: "sovereign_absolution",
    name: "Sovereign Absolution",

    healAmount: 38,
    contact: false,
    priority: 2,
    element: "water",

    description() {
      return {
        en: `The Sovereign of every water outside the body speaks over the chosen ally, and what does not belong to them is named aloud and dismissed. The tide runs through and comes out carrying it, restoring <b>${this.healAmount}</b> <b>HP</b> and lifting away every negative status effect they are under.`,
        pt: `A Soberana de toda água fora do corpo fala sobre o aliado escolhido, e o que não lhe pertence é nomeado em voz alta e dispensado. A maré atravessa e retorna carregando aquilo, restaurando <b>${this.healAmount}</b> de <b>HP</b> e removendo todo efeito de status negativo sob o qual ele estiver.`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;

      // Cleansed first, so nothing left on them can suppress the mending.
      const debuffs = ally.getStatusEffects({ type: "debuff" });
      debuffs.forEach((statusEffect) =>
        ally.removeStatusEffect(statusEffect.key),
      );

      const restored = new HealEvent({
        target: ally,
        amount: this.healAmount,
        context,
        source: user,
      }).execute();

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);
      const isSelf = ally.id === user.id;
      const absolutionLog = debuffs.length
        ? {
            en: ` and lifts away ${debuffs.length} negative status effect(s)`,
            pt: ` e dispensa ${debuffs.length} efeito(s) de status negativo(s)`,
          }
        : {
            en: ", finding nothing on them to dismiss",
            pt: ", sem encontrar nada a dispensar",
          };

      return {
        log: {
          en: `${userName} restores ${restored} HP to ${isSelf ? "herself" : allyName}${absolutionLog.en}.`,
          pt: `${userName} restaura ${restored} de HP a ${isSelf ? "si mesma" : allyName}${absolutionLog.pt}.`,
        },
      };
    },
  },

  {
    key: "advent_of_the_colossal_tide",
    name: "Advent of the Colossal Tide",

    bf: 65,
    damageMode: "piercing",
    piercingPercentage: 80,
    contact: false,
    element: "water",

    isUltimate: true,
    momentumCost: 55,
    priority: 1,

    healPercentOfDamage: 90,
    minHealPerAlly: 60,
    momentumGainPercentOfDamage: 7,
    transformInto: "alexa_neruvya_primordial",
    transformDuration: 2,

    description() {
      return {
        en: `Alexa Neruvya turns on the chosen target and drives the sea straight through them, ignoring <b>${this.piercingPercentage}%</b> of their <b>Defense</b>. If it lands, the tide rolls back over her and every ally, restoring <b>${this.healPercentOfDamage}%</b> of the damage dealt as <b>HP</b>, never less than <b>${this.minHealPerAlly}</b>, and leaves <b>${this.momentumGainPercentOfDamage}%</b> of it in her as <b>Momentum</b>.

      Only then does she let go of the shape she has been wearing, and a blue dragon rises with the whole ocean hanging off it: her <b>Primordial Form</b>, for <b>${this.transformDuration}</b> turn(s), replacing her skills, her passive and her stats. Not even a strike lost to <b>Blind</b> holds her back. Deals magical damage.`,
        pt: `Alexa Neruvya se volta contra o alvo escolhido e faz o mar inteiro atravessá-lo, ignorando <b>${this.piercingPercentage}%</b> da <b>Defesa</b> dele. Se acertar, a maré reflui sobre ela e sobre cada aliado, restaurando em <b>HP</b> <b>${this.healPercentOfDamage}%</b> do dano causado, nunca menos que <b>${this.minHealPerAlly}</b>, e deixa <b>${this.momentumGainPercentOfDamage}%</b> dele com ela como <b>Momentum</b>.

      Só então ela abandona a forma que vinha vestindo, e um dragão azul se ergue com o oceano inteiro escorrendo do corpo: sua <b>Forma Primordial</b>, por <b>${this.transformDuration}</b> turno(s), substituindo suas habilidades, sua passiva e seus atributos. Nem um golpe perdido por estar <b>Cega</b> a segura. Causa dano mágico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context, resolver }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const damageResult = new DamageEvent({
        baseDamage,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
      }).execute();

      const results = Array.isArray(damageResult)
        ? [...damageResult]
        : [damageResult];
      const [mainDamageResult] = results;

      const healAmount = Math.max(
        Math.floor(
          ((mainDamageResult?.totalDamage || 0) * this.healPercentOfDamage) /
            100,
        ),
        this.minHealPerAlly,
      );

      // The tide only carries healing back if the strike connected.
      if (mainDamageResult?.landed) {
        const allies = TargetFilter.candidates(
          "ally",
          user,
          context.aliveChampions ?? [],
        );

        allies.forEach((ally) => {
          const restored = new HealEvent({
            target: ally,
            amount: healAmount,
            context,
            source: user,
          }).execute();

          if (restored <= 0) return;

          results.push({
            log: {
              en: `The tide rolls back and restores ${restored} HP to ${formatChampionName(ally)}.`,
              pt: `A maré reflui e restaura ${restored} de HP a ${formatChampionName(ally)}.`,
            },
          });
        });
      }

      const momentumGain = Math.floor(
        ((mainDamageResult?.totalDamage || 0) *
          this.momentumGainPercentOfDamage) /
          100,
      );

      if (momentumGain > 0) {
        resolver.applyResourceChange({
          target: user,
          amount: momentumGain,
          context,
          sourceId: user.id,
        });

        results.push({
          log: {
            en: `The tide leaves ${momentumGain} Momentum behind in ${formatChampionName(user)}.`,
            pt: `A maré deixa ${momentumGain} de Momentum com ${formatChampionName(user)}.`,
          },
        });
      }

      results.push(this._awaken(user, context));

      return results;
    },

    // Blind can waste the strike, never the awakening.
    onBlindMiss({ user, context }) {
      return this._awaken(user, context);
    },

    _awaken(user, context) {
      context.requestChampionMutation({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.transformDuration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      return {
        log: {
          en: `${formatChampionName(user)} awakens her <b>Primordial Form</b> for ${this.transformDuration} turn(s)!`,
          pt: `${formatChampionName(user)} desperta sua <b>Forma Primordial</b> por ${this.transformDuration} turno(s)!`,
        },
      };
    },
  },
];

export default alexaNeruvyaSkills;
