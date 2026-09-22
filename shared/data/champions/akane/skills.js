import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const akaneSkills = [
  totalBlock,

  // ========================
  // Skill 1 — basic attack
  // ========================
  {
    key: "violet_slash",
    name: "Violet Slash",
    bf: 65,
    bleedingStacks: 1,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    hitVfxPalette: "violet",
    priority: 0,

    description() {
      return {
        en: `Akane unsheathes a single katana and draws it across the chosen target in one clean violet arc, the blade back at her hip before the cut is even felt, dealing damage and leaving them <b>Bleeding</b> for <b>${this.bleedingStacks}</b> stack(s).`,
        pt: `Akane desembainha uma única katana e a arrasta pelo alvo escolhido num único arco violeta limpo, a lâmina de volta ao quadril antes mesmo de o corte ser sentido, causando dano e deixando-o <b>Sangrando</b> por <b>${this.bleedingStacks}</b> stack(s).`,
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedingStacks, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  // ========================
  // Skill 2 — lifesteal
  // ========================
  {
    key: "bloodbath",
    name: "Bloodbath",
    lifeStealBuff: 95,
    buffDuration: 2,
    edgeDamagePercent: 18,
    priority: 0,

    description() {
      return {
        en: `The demon beneath Akane's calm surfaces to feed. For <b>${this.buffDuration}</b> turn(s) she gains <b>+${this.lifeStealBuff}%</b> <b>Life Steal</b>, every cut she lands flowing back into her as <b>HP</b>. The first blow she lands while the fury lasts is driven home with an extra <b>${this.edgeDamagePercent}%</b> of her <b>Attack</b>.`,
        pt: `O demônio sob a calma de Akane emerge para se alimentar. Por <b>${this.buffDuration}</b> turno(s) ela ganha <b>+${this.lifeStealBuff}%</b> de <b>Roubo de Vida</b>, todo corte que ela acerta fluindo de volta como <b>HP</b>. O primeiro golpe que ela acertar enquanto o furor durar é cravado com um extra de <b>${this.edgeDamagePercent}%</b> de seu <b>Ataque</b>.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "LifeSteal",
        amount: this.lifeStealBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      const edgeDamagePercent = this.edgeDamagePercent;

      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (hook) => hook.key !== "bloodbath_edge",
      );

      user.addHookEffect(
        {
          type: "buff",
          key: "bloodbath_edge",
          name: "Bloodbath",
          expiresAtTurn: context.currentTurn + this.buffDuration,
          hookScope: { onBeforeDmgDealing: "attacker" },
          onBeforeDmgDealing({ attacker }) {
            attacker.runtime.hookEffects = attacker.runtime.hookEffects.filter(
              (hook) => hook.key !== "bloodbath_edge",
            );

            return { bonusDamage: (attacker.Attack * edgeDamagePercent) / 100 };
          },
        },
        context,
      );

      return {
        log: `${formatChampionName(user)} bathes in blood, gaining +${this.lifeStealBuff}% Life Steal for ${this.buffDuration} turn(s) and readying a killing edge.`,
      };
    },
  },

  // ========================
  // Ultimate
  // ========================
  {
    key: "violet_onslaught",
    name: "Violet Onslaught",
    bf: 95,
    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    hitVfxPalette: "violet",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `Akane draws both katanas and falls upon the chosen target in a furious, perfectly synchronized cadence, every cut and thrust flowing into the next like steps of a dance too fast to follow, dealing heavy damage.`,
        pt: `Akane saca as duas katanas e desce sobre o alvo escolhido numa cadência furiosa e perfeitamente sincronizada, cada corte e estocada fluindo para o próximo como passos de uma dança rápida demais para acompanhar, causando dano pesado.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default akaneSkills;
