import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const noyreSkills = [
  // ========================
  // Disparo Básico (global)
  // ========================
  { ...basicShot, type: "magical" },
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "distorcao_entropica",
    name: "Distorção Entrópica",
    damageMode: "standard",
    bf: 65,
    priority: 1,
    dmgBonus: 40,
    description() {
      return `Reduz o Momentum do alvo em 8 unidades. Se o alvo tiver 50 Momentum ou mais, causa ${this.dmgBonus}% a mais de dano.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context, resolver }) {
      const [target] = targets;
      // 🔹 checar condição (50 Momentum)
      const hasHighMomentum = target.momentum >= 50;
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
      }).execute();
      // 🔹 reduzir Momentum
      resolver.applyResourceChange({
        target,
        amount: -8,
        context,
        sourceId: user.id,
        emitHooks: false,
      });
      return {
        log: hasHighMomentum
          ? `${user.name} distorceu a energia de ${target.name} (dano amplificado).`
          : `${user.name} distorceu a energia de ${target.name}.`,
      };
    },
  },
  {
    key: "silencio_energetico",
    name: "Silêncio Energético",
    priority: 2,
    duration: 2,
    allyShieldPercent: 10,
    description() {
      return `Todos os outros campeões não podem ganhar Momentum por ${this.duration} turnos. Aliados afetados recebem escudo de ${this.allyShieldPercent}% do HP máximo quando tiverem ganho de Momentum anulado.`;
    },
    targetSpec: ["all"],
    resolve({ user, targets, context, resolver }) {
      const allyShieldPercent = this.allyShieldPercent;
      const affected = targets.filter(
        (champ) => champ.id !== user.id && champ.alive,
      );

      for (const target of affected) {
        target.runtime.hookEffects ??= [];

        const hookKey = `silencio_energetico_${user.id}_${target.id}`;

        target.runtime.hookEffects = target.runtime.hookEffects.filter(
          (hook) => hook.key !== hookKey,
        );

        target.runtime.hookEffects.push({
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
                log: `${formatChampionName(owner)} teve seu ganho de Momentum anulado e recebeu ${shieldAmount} de escudo!`,
              };
            }

            return {
              log: `${formatChampionName(owner)} teve seu ganho de Momentum anulado!`,
            };
          },
        });
      }

      return {
        log: `${user.name} anulou o ganho de Momentum de todos os outros campeões por ${this.duration} turnos!`,
      };
    },
  },
  {
    key: "colapso_entropico",
    name: "Colapso Entrópico",
    isUltimate: true,
    momentumCost: 66,
    damageRatioPerMomentum: 0.01,
    piercingPercentage: 60,

    priority: 0,

    description() {
      return `Colapsa a energia dos inimigos, causando Dano Perfurante (${this.piercingPercentage}% de perfuração) equivalente a ${this.damageRatioPerMomentum * 100}% do HP máximo para cada unidade de Momentum atual do alvo (Máx.: 65% do HP). Em seguida, drena 2/3 do Momentum do alvo (Mín.: 12 unidades, ou todo o Momentum restante se o alvo tiver menos).`;
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
        const cappedDamage = Math.min(rawDamage, enemy.maxHP * 0.65);

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

        // Drenar 2/3 do Momentum, mínimo 12, máximo o que o alvo tem, nunca negativo
        let momentumToDrain = Math.floor((momentum * 2) / 3);

        momentumToDrain = Math.max(momentumToDrain, Math.min(12, momentum));

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
        message: `<b>[Colapso Entrópico]</b> A energia acumulada colapsa violentamente.`,
        sourceId: user.id,
      });

      return results;
    },
  },
];

export default noyreSkills;
