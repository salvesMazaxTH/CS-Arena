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
      return `Noyre reaches into the energy the chosen target has been hoarding and bends it out of shape, dealing magical damage and stripping ${this.momentumDrain} units of Momentum.

      The fuller the reserve, the worse the distortion: against a target holding ${this.highMomentumThreshold} Momentum or more, the damage is increased by ${this.dmgBonus}%.`;
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
          ? `${user.name} distorts the energy of ${target.name} (damage amplified).`
          : `${user.name} distorts the energy of ${target.name}.`,
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
      return `Noyre spreads the silence he carries across the field. For ${this.duration} turn(s), no other champion can gain Momentum at all — every gain is unmade the instant it happens.

      His allies are given something back for what the silence takes: each time one of them has a Momentum gain nullified, they receive a Shield equal to ${this.allyShieldPercent}% of their Max HP.`;
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
                log: `${formatChampionName(owner)} had their Momentum gain nullified and received ${shieldAmount} Shield!`,
              };
            }

            return {
              log: `${formatChampionName(owner)} had their Momentum gain nullified!`,
            };
          },
        }, context);
      }

      return {
        log: `${user.name} nullified the Momentum gain of every other champion for ${this.duration} turn(s)!`,
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
      return `Noyre lets every reserve on the field fall in on itself. All enemies take piercing magical damage (${this.piercingPercentage}% piercing) equal to ${this.damageRatioPerMomentum * 100}% of their Max HP for each unit of Momentum they currently hold, up to ${this.damageCapPercent}% of their Max HP.

      What is left of the collapse drains away: each target loses two thirds of their Momentum, never less than ${this.minMomentumDrain} units — or everything they still have, if it is less than that.`;
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
        message: `<b>[Entropic Collapse]</b> The gathered energy falls violently in on itself.`,
        sourceId: user.id,
      });

      return results;
    },
  },
];

export default noyreSkills;
