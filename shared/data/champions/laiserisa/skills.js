import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { findTwin, survivalDamage } from "../pairs/twinBond.js";

const SISTER_KEYS = ["laisaelis", "laiserisa"];

const laiserisaSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },

  // ========================
  // Erase
  // ========================
  {
    key: "erase",
    name: "Erase",

    momentumGain: 20,

    contact: false,
    priority: 2,

    description() {
      return {
        en: `Laiserisa turns to the one thing her sister only answered into being and withdraws the answer. The <b>Echo</b> of <b>Manifest</b> is erased where it stands, and what it was becomes hers: a <b>Shield</b> equal to the Echo's current HP, and <b>${this.momentumGain}</b> <b>Momentum</b>.`,
        pt: `Laiserisa se volta para a única coisa que sua irmã apenas respondeu em existência e retira a resposta. O <b>Eco</b> de <b>Manifest</b> é apagado onde está, e o que ele era se torna dela: um <b>Escudo</b> igual ao HP atual do Eco, e <b>${this.momentumGain}</b> de <b>Momentum</b>.`,
      };
    },

    // There is at most one Echo on the field, so this resolves it automatically
    // rather than asking the player to pick the only legal target.
    targetSpec: ["self"],

    disabledReason({ allies }) {
      const hasEcho = allies.some(
        (c) => c.alive && c.runtime?.manifestEcho === true,
      );
      return hasEcho ? null : "There is no Echo to withdraw.";
    },

    resolve({ user, targets, context, resolver }) {
      const echo = (context.aliveChampions ?? []).find(
        (c) =>
          c?.alive && c.team === user.team && c.runtime?.manifestEcho === true,
      );

      if (!echo) {
        const message = {
          en: `<b>${this.name}</b> — there is no Echo to withdraw.`,
          pt: `<b>${this.name}</b> — não há Eco algum para retirar.`,
        };
        context.registerDialog({ message, sourceId: user.id });
        return { log: message };
      }

      const shieldAmount = echo.HP;

      echo.HP = 0;
      echo.alive = false;

      user.addShield(shieldAmount, 0, context);
      resolver.applyResourceChange({
        target: user,
        amount: this.momentumGain,
        context,
        sourceId: user.id,
      });

      context.registerDialog({
        message: {
          en: `<b>${this.name}</b> — ${formatChampionName(echo)} is withdrawn, and what it was settles over ${formatChampionName(user)}.`,
          pt: `<b>${this.name}</b> — ${formatChampionName(echo)} é retirado, e o que ele era se instala sobre ${formatChampionName(user)}.`,
        },
        sourceId: user.id,
        targetId: echo.id,
      });

      return {
        log: {
          en: `${formatChampionName(user)} erases ${formatChampionName(echo)}, taking ${shieldAmount} shield and ${this.momentumGain} Momentum from it.`,
          pt: `${formatChampionName(user)} apaga ${formatChampionName(echo)}, tomando ${shieldAmount} de escudo e ${this.momentumGain} de Momentum dele.`,
        },
      };
    },
  },

  // ========================
  // Return to Nothing
  // ========================
  {
    key: "return_to_nothing",
    name: "Return to Nothing",

    vanishTurns: 2,

    contact: false,
    priority: 3,

    description() {
      return {
        en: `Laiserisa lets the chosen target stop being for a while: they leave the field for the <b>Nothingness</b> and step back out <b>${this.vanishTurns}</b> turn(s) later, unreachable on arrival. Should Laiserisa herself be gone by then, the Nothingness lets go at once and returns them early. Neither sister can be sent.`,
        pt: `Laiserisa deixa o alvo escolhido deixar de ser por um tempo: ele sai de campo para o <b>Nada</b> e retorna <b>${this.vanishTurns}</b> turno(s) depois, inalcançável até chegar. Caso a própria Laiserisa já esteja ausente até lá, o Nada solta de imediato e o devolve mais cedo. Nenhuma das irmãs pode ser enviada.`,
      };
    },

    targetSpec: [{ type: "select:any", excludesKeys: SISTER_KEYS }],

    resolve({ user, targets, context }) {
      const [target] = targets;

      context.requestChampionMutation({
        mode: "vanish",
        targetId: target.id,
        turns: this.vanishTurns,
        ruptureSourceId: user.id,
      });

      const message = {
        en: `<b>${this.name}</b> — ${formatChampionName(user)} lets ${formatChampionName(target)} stop being, for a while.`,
        pt: `<b>${this.name}</b> — ${formatChampionName(user)} permite ${formatChampionName(target)} deixar de ser, por um tempo.`,
      };

      context.registerDialog({
        message,
        sourceId: user.id,
        targetId: target.id,
      });

      return { log: message };
    },
  },

  // ========================
  // Ultimate
  // ========================
  {
    key: "then_let_me_take_you_with_me",
    name: "Then Let Me Take You With Me",

    auraDuration: 2,
    vanishTurns: 1,
    returnHPPercent: 25,

    contact: false,
    isUltimate: true,
    momentumCost: 60,
    priority: 4,

    description() {
      return {
        en: `Laiserisa accepts what her sister spent the whole match refusing, and binds their two endings into one. For <b>${this.auraDuration}</b> turn(s), the next lethal effect that would take either sister instead empties her to a sliver, and at the start of the next turn both slip into the <b>Nothingness</b> together — returning <b>${this.vanishTurns}</b> turns later with <b>${this.returnHPPercent}%</b> of their base Max HP each, and only once the field has room for both. Struck down in that sliver of a turn, they go for good. It cannot be bound while her sister is absent from the field.`,
        pt: `Laiserisa aceita o que sua irmã passou a partida inteira recusando, e une os dois finais em um só. Por <b>${this.auraDuration}</b> turno(s), o próximo efeito letal que atingiria qualquer uma das irmãs a esvazia até um fio de vida, e no início do turno seguinte ambas escorregam juntas para o <b>Nada</b> — retornando <b>${this.vanishTurns}</b> turno(s) depois com <b>${this.returnHPPercent}%</b> do HP Máximo base de cada uma, e somente quando houver espaço em campo para as duas. Se derrubadas nesse fio de vida, partem para sempre. Não pode ser conjurada enquanto sua irmã estiver ausente do campo.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const twin = findTwin(user, context);

      if (!twin) {
        return {
          log: {
            en: `${formatChampionName(user)} reaches for her sister and finds no one to take with her.`,
            pt: `${formatChampionName(user)} estende a mão para sua irmã e não encontra ninguém para levar consigo.`,
          },
        };
      }

      const skillName = this.name;
      const vanishTurns = this.vanishTurns;
      const hpRatio = this.returnHPPercent / 100;
      const groupId = `twin_departure_${user.id}`;

      const aura = {
        type: "buff",
        key: "twin_departure",
        group: "skill",
        ownerId: user.id,
        expiresAtTurn: context.currentTurn + this.auraDuration,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        hookPolicies: {
          onBeforeDmgTaking: {
            allowOnDot: true,
            allowOnNestedDamage: true,
            allowOnAbsolute: true,
          },
        },

        onBeforeDmgTaking({ defender, owner, damage, context }) {
          if (defender !== owner) return;
          if (!owner.wouldBeLethal(damage)) return;

          owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

          for (const sister of [user, twin]) {
            sister.runtime.hookEffects = sister.runtime.hookEffects.filter(
              (effect) => effect.key !== "twin_departure",
            );

            context.schedule({
              type: "championMutation",
              turnToHappen: context.currentTurn + 1,
              payload: {
                targetId: sister.id,
                mode: "vanish",
                turns: vanishTurns,
                returnState: { hpRatio, groupId },
              },
            });
          }

          context.registerDialog({
            message: {
              en: `<b>${skillName}</b> — ${formatChampionName(owner)} is taken, and does not go alone.`,
              pt: `<b>${skillName}</b> — ${formatChampionName(owner)} é levada, e não vai sozinha.`,
            },
            sourceId: owner.id,
            targetId: owner.id,
          });

          return {
            damageCap: survivalDamage(owner, 1),
            log: {
              en: `${formatChampionName(user)} and ${formatChampionName(twin)} are bound for the Nothingness together.`,
              pt: `${formatChampionName(user)} e ${formatChampionName(twin)} são atadas ao Nada juntas.`,
            },
          };
        },
      };

      for (const sister of [user, twin]) {
        sister.runtime.hookEffects ??= [];
        sister.runtime.hookEffects = sister.runtime.hookEffects.filter(
          (effect) => effect.key !== "twin_departure",
        );
        sister.addHookEffect({ ...aura }, context);
      }

      return {
        log: {
          en: `${formatChampionName(user)} binds her ending to ${formatChampionName(twin)}'s: neither will be left behind.`,
          pt: `${formatChampionName(user)} ata seu fim ao de ${formatChampionName(twin)}: nenhuma das duas ficará para trás.`,
        },
      };
    },
  },
];

export default laiserisaSkills;
