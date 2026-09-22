import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import basicStrike from "../generic/basicStrike.js";

const kyleHayatoSkills = [
  // ========================
  // Basic Strike (global)
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "current_thief",
    name: "Current Thief",

    bf: 60,
    paralyzedDuration: 1,
    momentumStealAmount: 5,

    contact: true,
    damageMode: "standard",
    element: "lightning",
    critOptions: { disable: true },

    hitVfx: "slash",
    hitVfxPalette: "azure",

    priority: 0,

    description() {
      return {
        en: `Kyle closes the distance in a single crack of current and takes what he needs on the way past. Deals physical damage equal to <b>${this.bf}%</b> of his <b>Attack</b>, is never a <b>critical hit</b>, <b>Paralyzes</b> the chosen enemy for <b>${this.paralyzedDuration}</b> turn(s), and steals up to <b>${this.momentumStealAmount}</b> <b>Momentum</b> from them.`,
        pt: `Kyle fecha a distância em um único estalo de corrente e leva o que precisa de passagem. Causa dano físico igual a <b>${this.bf}%</b> do seu <b>Ataque</b>, nunca é <b>acerto crítico</b>, <b>Paralisa</b> o inimigo escolhido por <b>${this.paralyzedDuration}</b> turno(s), e rouba até <b>${this.momentumStealAmount}</b> de <b>Momentum</b> dele.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {}, resolver }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzedDuration, context, {
          sourceId: user.id,
        });

        const { applied } = resolver.applyResourceChange({
          target: enemy,
          amount: -this.momentumStealAmount,
          context,
          sourceId: user.id,
          clampToAvailable: true,
        });

        const stolen = Math.abs(applied);
        if (stolen > 0) {
          resolver.applyResourceChange({
            target: user,
            amount: stolen,
            context,
            sourceId: user.id,
          });

          arr.push({
            log: {
              en: `${formatChampionName(user)} steals ${stolen} Momentum on the way past.`,
              pt: `${formatChampionName(user)} rouba ${stolen} de Momentum de passagem.`,
            },
          });
        }
      }

      return arr;
    },
  },

  {
    key: "between_flashes",
    name: "Between Flashes",

    bf: 75,
    bonusDamage: 20,
    invisibleDuration: 2,

    contact: true,
    damageMode: "standard",
    critOptions: { disable: true },

    hitVfx: "slash",

    priority: 0,

    description() {
      return {
        en: `The air cracks white around Kyle and for a heartbeat the enemy is watching the wrong place — the lightning is a trick of the eye, and it is the blade that arrives. Deals physical damage plus <b>${this.bonusDamage}</b> bonus damage, is never a <b>critical hit</b>, and leaves him <b>Invisible</b> for up to <b>${this.invisibleDuration}</b> turns, ending early the moment he acts again.`,
        pt: `O ar racha em branco ao redor de Kyle e por um instante o inimigo olha para o lugar errado — o relâmpago é um mero truque visual, e é a lâmina que encontra o corpo do alvo. Causa dano físico mais <b>${this.bonusDamage}</b> de dano bônus, nunca é <b>acerto crítico</b>, e o deixa <b>Invisível</b> por até <b>${this.invisibleDuration}</b> turnos, terminando antes assim que ele agir novamente.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: this.bonusDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      user.removeStatusEffect("invisible");
      user.applyStatusEffect("invisible", this.invisibleDuration, context, {
        source: this.key,
      });

      arr.push({
        log: {
          en: `${formatChampionName(user)} flashes into the storm, vanishing from sight.`,
          pt: `${formatChampionName(user)} relampeja para dentro da tempestade, sumindo de vista.`,
        },
      });

      return arr;
    },
  },

  {
    key: "usurpers_bolt",
    name: "Usurper's Bolt",

    bf: 95,
    momentumStealAmount: 16,
    claimDivertPercent: 50,
    markWindow: 2,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    critOptions: { disable: true },
    isUltimate: true,
    momentumCost: 58,
    priority: 0,

    description() {
      return {
        en: `Kyle points at whoever has climbed the highest this match and brings the whole storm down on them at once — the throne looks the same from the top no matter who is standing on it. Deals magical damage to the enemy with the most <b>Momentum</b>, is never a <b>critical hit</b>, and steals up to <b>${this.momentumStealAmount}</b> <b>Momentum</b> from them; if they used <b>CLAIM</b> within the last <b>${this.markWindow}</b> turn(s), <b>${this.claimDivertPercent}%</b> of what they scored is usurped for Kyle's team as well.`,
        pt: `Kyle aponta para quem escalou mais alto nesta partida e traz toda a tempestade sobre essa pessoa de uma vez — o trono parece o mesmo do topo não importa quem está nele. Causa dano mágico ao inimigo com mais <b>Momentum</b>, nunca é <b>acerto crítico</b>, e rouba até <b>${this.momentumStealAmount}</b> de <b>Momentum</b> dele; se ele usou <b>CLAIM</b> nos últimos <b>${this.markWindow}</b> turno(s), <b>${this.claimDivertPercent}%</b> do que pontuou também é usurpado para o time de Kyle.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {}, resolver }) {
      const enemies = (context.aliveChampions ?? []).filter(
        (c) => c.team !== user.team,
      );

      if (!enemies.length) {
        return {
          log: {
            en: `${formatChampionName(user)} finds no throne worth taking.`,
            pt: `${formatChampionName(user)} não encontra trono algum que valha a pena tomar.`,
          },
        };
      }

      const enemy = enemies.sort((a, b) => b.momentum - a.momentum)[0];
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];
      if (!arr[0]?.landed) return arr;

      const { applied } = resolver.applyResourceChange({
        target: enemy,
        amount: -this.momentumStealAmount,
        context,
        sourceId: user.id,
        clampToAvailable: true,
      });

      const stolen = Math.abs(applied);
      if (stolen > 0) {
        resolver.applyResourceChange({
          target: user,
          amount: stolen,
          context,
          sourceId: user.id,
        });

        arr.push({
          log: {
            en: `${formatChampionName(user)} steals ${stolen} Momentum from ${formatChampionName(enemy)}.`,
            pt: `${formatChampionName(user)} rouba ${stolen} de Momentum de ${formatChampionName(enemy)}.`,
          },
        });
      }

      const markUntil = enemy.runtime.shadowstormMarkUntilTurn;
      const markPoints = enemy.runtime.shadowstormMarkPoints || 0;

      if (markUntil !== undefined && markUntil > context.currentTurn) {
        // The bolt spends the mark whether or not there is score left to take.
        delete enemy.runtime.shadowstormMarkUntilTurn;
        delete enemy.runtime.shadowstormMarkPoints;

        const diverted = Math.min(
          Math.round(markPoints * (this.claimDivertPercent / 100)),
          context.getScore(enemy.team - 1),
        );

        if (diverted > 0) {
          context.registerScore({
            amount: diverted,
            scoringSlot: user.team - 1,
            reason: this.key,
            sourceId: user.id,
          });
          context.registerScore({
            amount: -diverted,
            scoringSlot: enemy.team - 1,
            reason: this.key,
            sourceId: user.id,
          });

          context.registerDialog({
            message: {
              en: `${formatChampionName(user)} comes down on ${formatChampionName(enemy)} and leaves with what they climbed for.`,
              pt: `${formatChampionName(user)} desce sobre ${formatChampionName(enemy)} e vai embora com aquilo que ele escalou para conseguir.`,
            },
            sourceId: user.id,
            targetId: enemy.id,
          });

          arr.push({
            log: {
              en: `${formatChampionName(user)} usurps ${diverted} point(s) ${formatChampionName(enemy)} had just claimed.`,
              pt: `${formatChampionName(user)} usurpa ${diverted} ponto(s) que ${formatChampionName(enemy)} acabara de reivindicar.`,
            },
          });
        }
      }

      return arr;
    },
  },
];

export default kyleHayatoSkills;
