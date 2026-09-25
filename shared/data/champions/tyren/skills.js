import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const tyrenSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Passive
  // =========================
  // Living Metallurgy
  // =========================

  // =========================
  // Special Abilities
  // =========================

  {
    key: "mercurial_lance",
    name: "Mercurial Lance",

    bf: 75,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "steel",
    hitVfx: "liquid_steel_lance",

    snareDuration: 2,

    description() {
      return {
        en: `Tyren shapes his liquid steel into a piercing lance, dealing steel magical damage. The metal then leaves the target <b>Snared</b> for <b>${this.snareDuration}</b> turn(s).`,
        pt: `Tyren molda seu aço líquido em uma lança perfurante, causando dano mágico de aço. O metal então deixa o alvo <b>Enredado</b> por <b>${this.snareDuration}</b> turno(s).`,
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      // The metal hardens and pins the target down even on a hit that did not
      // break skin.
      const hitSuccess = results.some((r) => effectConnected(r, "snared"));

      if (hitSuccess && enemy.alive) {
        enemy.applyStatusEffect("snared", this.snareDuration, context);
      }

      return results;
    },
  },

  {
    key: "living_steel_aegis",
    name: "Living Steel Aegis",

    contact: false,
    priority: 2,

    duration: 2,
    attackBonus: 60,
    defenseBonus: 20,
    speedMultiplier: 0.5,

    description() {
      return {
        en: `Tyren transmutes his body into Living Steel for <b>${this.duration}</b> turns.

        His <b>Attack</b> and <b>Defense</b> are inverted, then he gains <b>+${this.attackBonus}</b> <b>Attack</b> and <b>+${this.defenseBonus}</b> <b>Defense</b>. His <b>Speed</b> is reduced by <b>${Math.round((1 - this.speedMultiplier) * 100)}%</b>.

        <b>Living Steel Aegis</b> cannot be used again while its effect is still active.`,
        pt: `Tyren transmuta seu corpo em Aço Vivo por <b>${this.duration}</b> turnos.

        Seu <b>Ataque</b> e sua <b>Defesa</b> se invertem, e então ele ganha <b>+${this.attackBonus}</b> de <b>Ataque</b> e <b>+${this.defenseBonus}</b> de <b>Defesa</b>. Sua <b>Velocidade</b> é reduzida em <b>${Math.round((1 - this.speedMultiplier) * 100)}%</b>.

        <b>Transmutação de Aço Vivo</b> não pode ser usada novamente enquanto seu efeito ainda estiver ativo.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.runtime ??= {};

      if (
        user.runtime.livingSteelAegisExpiresAtTurn != null &&
        context.currentTurn < user.runtime.livingSteelAegisExpiresAtTurn
      ) {
        return {
          log: `${formatChampionName(
            user,
          )} cannot use <b>Living Steel Aegis</b> while already under its effect.`,
        };
      }

      const originalAttack = user.Attack;
      const originalDefense = user.Defense;
      const originalSpeed = user.Speed;

      const transformedAttack = originalDefense + this.attackBonus;
      const transformedDefense = originalAttack + this.defenseBonus;
      const transformedSpeed = Math.floor(originalSpeed * this.speedMultiplier);

      user.runtime.livingSteelAegisExpiresAtTurn =
        context.currentTurn + this.duration;

      const statOpts = {
        duration: this.duration,
        context,
        statModifierSrc: user,
      };

      // Timed stat modifiers so the transformation rides the stat system and
      // reverts itself on expiry instead of being restored by hand.
      user.applyStatModifier({
        statName: "Attack",
        amount: transformedAttack - originalAttack,
        ...statOpts,
      });
      user.applyStatModifier({
        statName: "Defense",
        amount: transformedDefense - originalDefense,
        ...statOpts,
      });
      user.applyStatModifier({
        statName: "Speed",
        amount: transformedSpeed - originalSpeed,
        ...statOpts,
      });

      return {
        log:
          `<b>[${this.name}]</b> ${formatChampionName(user)} ` +
          `transmutes his body into Living Steel: ` +
          `Attack ${originalAttack} → ${user.Attack}, ` +
          `Defense ${originalDefense} → ${user.Defense}, ` +
          `Speed ${originalSpeed} → ${user.Speed}.`,
      };
    },
  },

  {
    key: "grand_metallic_transmutation",
    name: "Grand Metallic Transmutation",

    bf: 110,
    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    stunDuration: 1,
    empoweredPercent: 35,

    description() {
      return {
        en: `Tyren unleashes a massive wave of living steel, dealing powerful steel magical damage.

        If the target is under crowd control, the metal violently crystallizes around them, dealing an additional <b>${this.empoweredPercent}%</b> of this ability's base damage as bonus damage and extending their current crowd control by <b>${this.stunDuration}</b> turn(s).

        Otherwise, the target is <b>Stunned</b> for <b>${this.stunDuration}</b> turn(s).`,
        pt: `Tyren libera uma onda massiva de aço vivo, causando poderoso dano mágico de aço.

        Se o alvo estiver sob controle de grupo, o metal se cristaliza violentamente ao redor dele, causando <b>${this.empoweredPercent}%</b> adicionais do dano base desta habilidade como dano bônus e estendendo o controle de grupo atual em <b>${this.stunDuration}</b> turno(s).

        Caso contrário, o alvo fica <b>Atordoado</b> por <b>${this.stunDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      // Any active Crowd Control counts: softCC or hardCC.
      const controlEffects = enemy.getStatusEffects({
        subtype: ["softCC", "hardCC"],
      });
      const wasControlled = controlEffects.length > 0;

      const result = new DamageEvent({
        baseDamage,
        bonusDamage: wasControlled
          ? baseDamage * (this.empoweredPercent / 100)
          : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      const mainHit = results.find((r) => r?.targetId === enemy.id);

      if (!effectConnected(mainHit, "stunned") || !enemy.alive) return results;

      if (wasControlled) {
        // Preserve the existing Crowd Control and extend
        // its expiration instead of replacing it with Stun.
        controlEffects[0].expiresAtTurn += this.stunDuration;
      } else {
        // No Crowd Control: apply the default Stun.
        enemy.applyStatusEffect("stunned", this.stunDuration, context);
      }

      return results;
    },
  },
];

export default tyrenSkills;
