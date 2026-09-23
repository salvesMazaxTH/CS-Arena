import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";

const noyreSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },
  // ========================
  // Special Abilities
  // ========================
  {
    key: "entropic_distortion",
    name: "Entropic Distortion",
    damageMode: "standard",
    bf: 65,
    priority: 1,
    dmgBonus: 40,
    momentumDrain: 8,
    highMomentumThreshold: 50,
    description() {
      return {
        en: `Noyre reaches into the energy the chosen target has been hoarding and bends it out of shape, dealing <b>magical damage</b> and stripping <b>${this.momentumDrain}</b> units of <b>Momentum</b>.

        The fuller the reserve, the worse the distortion: against a target holding <b>${this.highMomentumThreshold}</b> Momentum or more, the damage is increased by <b>${this.dmgBonus}%</b>.`,
        pt: `Noyre agarra a energia que o alvo escolhido vem acumulando e a retorce até deformá-la, causando <b>dano mágico</b> e removendo <b>${this.momentumDrain}</b> unidades de <b>Momentum</b>.

        Quanto mais cheia a reserva, pior a distorção: contra um alvo com <b>${this.highMomentumThreshold}</b> ou mais de Momentum, o dano é aumentado em <b>${this.dmgBonus}%</b>.`,
      };
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context, resolver }) {
      const [target] = targets;

      const hasHighMomentum = target.momentum >= this.highMomentumThreshold;
      const damage = hasHighMomentum
        ? Math.floor(
            ((user.Attack * this.bf) / 100) * (1 + this.dmgBonus / 100),
          )
        : Math.floor((user.Attack * this.bf) / 100);

      new DamageEvent({
        baseDamage: damage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context.allChampions,
        flags: { denyMomentumFromDamage: true },
      }).execute();

      resolver.applyResourceChange({
        target,
        amount: -this.momentumDrain,
        context,
        sourceId: user.id,
        emitHooks: false,
      });

      return {
        log: hasHighMomentum
          ? {
              en: `${user.name} distorts the energy of ${target.name} (damage amplified).`,
              pt: `${user.name} distorce a energia de ${target.name} (dano amplificado).`,
            }
          : {
              en: `${user.name} distorts the energy of ${target.name}.`,
              pt: `${user.name} distorce a energia de ${target.name}.`,
            },
      };
    },
  },
  {
    key: "silence_of_the_hollow",
    name: "Silence of the Hollow",
    priority: 2,
    duration: 2,
    allyShieldPercent: 10,
    description() {
      return {
        en: `Noyre spreads the silence he carries across the field. For <b>${this.duration}</b> turn(s), no other champion can gain <b>Momentum</b> at all — every gain is unmade the instant it happens.

        His allies are given something back for what the silence takes: each time one of them has a Momentum gain nullified, they receive a <b>Shield</b> equal to <b>${this.allyShieldPercent}%</b> of their Max HP.`,
        pt: `Noyre espalha o silêncio que carrega pelo campo. Por <b>${this.duration}</b> turno(s), nenhum outro campeão pode ganhar <b>Momentum</b> — todo ganho é desfeito no instante em que acontece.

        Seus aliados recebem algo em troca do que o silêncio toma: cada vez que um deles tem um ganho de Momentum anulado, recebe um <b>Escudo</b> igual a <b>${this.allyShieldPercent}%</b> do seu HP Máximo.`,
      };
    },
    targetSpec: ["all"],
    resolve({ user, targets, context }) {
      const allyShieldPercent = this.allyShieldPercent;
      const affected = targets.filter(
        (champ) => champ.id !== user.id && champ.alive,
      );

      for (const target of affected) {
        target.runtime.hookEffects ??= [];

        const hookKey = `silence_of_the_hollow_${user.id}_${target.id}`;

        target.runtime.hookEffects = target.runtime.hookEffects.filter(
          (hook) => hook.key !== hookKey,
        );

        target.addHookEffect({
        type: "debuff",
          key: hookKey,
          group: "skill_effect",
          expiresAtTurn: context.currentTurn + this.duration,
          hookScope: {
            onResourceGain: "target",
          },
          onResourceGain({ owner, amount, resolver, context, target }) {
            if (amount <= 0) return;
            if (!owner || owner.id !== target.id) return;

            resolver.applyResourceChange({
              target: owner,
              amount: -amount,
              context,
              sourceId: user.id,
              emitHooks: false,
            });

            if (owner.team === user.team) {
              const shieldAmount = Math.floor(
                owner.maxHP * (allyShieldPercent / 100),
              );
              owner.addShield(shieldAmount, 0, context);

              return {
                log: {
                  en: `${formatChampionName(owner)} had their Momentum gain nullified and received <b>${shieldAmount}</b> Shield!`,
                  pt: `${formatChampionName(owner)} teve seu ganho de Momentum anulado e recebeu <b>${shieldAmount}</b> de Escudo!`,
                },
              };
            }

            return {
              log: {
                en: `${formatChampionName(owner)} had their Momentum gain nullified!`,
                pt: `${formatChampionName(owner)} teve seu ganho de Momentum anulado!`,
              },
            };
          },
        }, context);
      }

      return {
        log: {
          en: `${user.name} nullified the Momentum gain of every other champion for <b>${this.duration}</b> turn(s)!`,
          pt: `${user.name} anulou o ganho de Momentum de todo outro campeão por <b>${this.duration}</b> turno(s)!`,
        },
      };
    },
  },
  {
    key: "entropic_collapse",
    name: "Entropic Collapse",
    isUltimate: true,
    momentumCost: 66,
    damageRatioPerMomentum: 0.01,
    damageCapPercent: 65,
    piercingPercentage: 60,
    minMomentumDrain: 12,

    priority: 0,

    description() {
      return {
        en: `Noyre lets every reserve on the field fall in on itself. All enemies take <b>piercing magical damage</b> (<b>${this.piercingPercentage}%</b> piercing) equal to <b>${this.damageRatioPerMomentum * 100}%</b> of their Max HP for each unit of <b>Momentum</b> they currently hold, up to <b>${this.damageCapPercent}%</b> of their Max HP.

        What is left of the collapse drains away: each target loses two thirds of their <b>Momentum</b>, never less than <b>${this.minMomentumDrain}</b> units — or everything they still have, if it is less than that.`,
        pt: `Noyre faz cada reserva do campo desabar sobre si mesma. Todos os inimigos sofrem <b>dano mágico perfurante</b> (<b>${this.piercingPercentage}%</b> de perfuração) igual a <b>${this.damageRatioPerMomentum * 100}%</b> do seu HP Máximo para cada unidade de <b>Momentum</b> que possuem no momento, até um teto de <b>${this.damageCapPercent}%</b> do HP Máximo.

        O que resta do colapso escoa embora: cada alvo perde dois terços do seu <b>Momentum</b>, nunca menos que <b>${this.minMomentumDrain}</b> unidades — ou tudo o que ainda tiver, se for menos que isso.`,
      };
    },

    targetSpec: ["all:enemy"],
    resolve({ user, targets, context, resolver }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const results = [];

      for (const enemy of enemies) {
        const momentum = enemy.momentum || 0;
        if (momentum <= 0) continue;

        const rawDamage = enemy.maxHP * this.damageRatioPerMomentum * momentum;
        const cappedDamage = Math.min(
          rawDamage,
          enemy.maxHP * (this.damageCapPercent / 100),
        );

        const damage = Math.floor(cappedDamage);

        const damageResult = new DamageEvent({
          baseDamage: damage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context.allChampions,
          mode: "piercing",
          piercingPercentage: this.piercingPercentage,
        }).execute();

        const damageResults = Array.isArray(damageResult)
          ? damageResult
          : [damageResult];

        results.push(...damageResults);

        // Drain two thirds of the Momentum, at least the minimum,
        // capped at whatever the target still holds. Never negative.
        let momentumToDrain = Math.floor((momentum * 2) / 3);

        momentumToDrain = Math.max(
          momentumToDrain,
          Math.min(this.minMomentumDrain, momentum),
        );

        if (momentumToDrain > 0) {
          resolver.applyResourceChange({
            target: enemy,
            amount: -momentumToDrain,
            context,
            sourceId: user.id,
            emitHooks: false,
          });
        }
      }

      context.registerDialog({
        message: {
          en: `<b>[Entropic Collapse]</b> The gathered energy falls violently in on itself.`,
          pt: `<b>[Colapso Entrópico]</b> A energia acumulada desaba violentamente sobre si mesma.`,
        },
        sourceId: user.id,
      });

      return results;
    },
  },
];

export default noyreSkills;
