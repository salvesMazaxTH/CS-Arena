import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const CORROSION_KEY = "zophirox_corrosion";

function isCorroded(champion, context) {
  return champion.runtime?.hookEffects?.some(
    (effect) =>
      effect.key === CORROSION_KEY &&
      effect.expiresAtTurn > context.currentTurn,
  );
}

const zophiroxSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // Z1 — Caustic Rend
  // ========================
  {
    key: "caustic_rend",
    name: "Caustic Rend",

    bf: 55,
    defenseShredPercent: 20,
    corrosionDuration: 2,
    poisonedStacks: 2,

    contact: true,
    damageMode: "standard",
    element: "poison",
    hitVfx: "acid_claw",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Zophiróx rakes the chosen target with claws still dripping from his glands, and the acid keeps eating after the claws are gone. The target is <b>Corroded</b> for <b>${this.corrosionDuration}</b> turns, losing <b>${this.defenseShredPercent}%</b> of its <b>Defense</b>, and receives <b>${this.poisonedStacks}</b> stacks of <b>Poisoned</b>. Striking an already <b>Corroded</b> target renews the corrosion instead of deepening it. Deals physical damage.`,
        pt: `Zophiróx rasga o alvo escolhido com garras ainda pingando das próprias glândulas, e o ácido continua corroendo depois que as garras se vão. O alvo fica <b>Corroído</b> por <b>${this.corrosionDuration}</b> turnos, perdendo <b>${this.defenseShredPercent}%</b> da sua <b>Defesa</b>, e recebe <b>${this.poisonedStacks}</b> acúmulos de <b>Envenenado</b>. Golpear um alvo já <b>Corroído</b> renova a corrosão em vez de aprofundá-la. Causa dano físico.`,
      };
    },

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

      const results = Array.isArray(result) ? result : [result];

      if (results[0]?.landed && enemy.alive) {
        this._corrode(user, enemy, context);
      }

      if (effectConnected(results[0], "poisoned")) {
        enemy.applyStatusEffect(
          "poisoned",
          undefined,
          context,
          {},
          this.poisonedStacks,
        );
      }

      return results;
    },

    // Corroded is Zophiróx's own mark, not a shared status effect: a hookEffect
    // carrying the Defense modifier it owns, so a reapplication can replace
    // both instead of stacking the shred.
    _corrode(user, enemy, context) {
      enemy.removeHookEffects((effect) => effect.key === CORROSION_KEY);

      const modifierCount = enemy.statModifiers.length;

      enemy.modifyStat({
        statName: "Defense",
        amount: -this.defenseShredPercent,
        isPercent: true,
        duration: this.corrosionDuration,
        context,
        statModifierSrc: user,
      });

      const modifier =
        enemy.statModifiers.length > modifierCount
          ? enemy.statModifiers.at(-1)
          : null;

      enemy.addHookEffect(
        {
          type: "debuff",
          key: CORROSION_KEY,
          expiresAtTurn: context.currentTurn + this.corrosionDuration,

          onTurnStart({ owner, context }) {
            if (context.currentTurn < this.expiresAtTurn) return;
            owner.removeHookEffects((effect) => effect === this);
          },

          onRemoved({ owner }) {
            if (modifier) owner.removeStatModifiers([modifier]);
          },
        },
        context,
      );
    },
  },

  // ========================
  // Z2 — Hardened Scales
  // ========================
  {
    key: "hardened_scales",
    name: "Hardened Scales",

    baseShield: 5,
    shieldPerWornSkin: 5,
    shieldPerAfflictedEnemy: 30,
    shieldDecay: 30,

    contact: false,
    priority: 1,

    targetSpec: ["self"],

    description() {
      return {
        en: `Every enemy carrying his venom or his acid is a wound Zophiróx can smell, and his scales set hard against each one, harder still the more worn his old skin has grown. He gains a <b>${this.baseShield}</b> <b>Shield</b>, plus <b>${this.shieldPerWornSkin}</b> for every stack of <b>Worn Skin</b> and <b>${this.shieldPerAfflictedEnemy}</b> for every enemy that is <b>Poisoned</b> or <b>Corroded</b>, decaying by <b>${this.shieldDecay}</b> each turn.`,
        pt: `Todo inimigo carregando o veneno ou o ácido dele é uma ferida que Zophiróx consegue farejar, e as escamas dele endurecem contra cada um, e mais ainda quanto mais gasta estiver a pele velha. Ele ganha <b>${this.baseShield}</b> de <b>Escudo</b>, mais <b>${this.shieldPerWornSkin}</b> por acúmulo de <b>Pele Gasta</b> e <b>${this.shieldPerAfflictedEnemy}</b> por inimigo <b>Envenenado</b> ou <b>Corroído</b>, que decai <b>${this.shieldDecay}</b> por turno.`,
      };
    },

    resolve({ user, context = {} }) {
      const afflicted = TargetFilter.candidates(
        "enemy",
        user,
        context.aliveChampions ?? [],
      ).filter(
        (enemy) => enemy.hasStatusEffect("poisoned") || isCorroded(enemy, context),
      );

      const wornSkin = Number(user.runtime?.zophiroxWornSkin) || 0;

      const amount =
        this.baseShield +
        wornSkin * this.shieldPerWornSkin +
        afflicted.length * this.shieldPerAfflictedEnemy;

      user.addShield(amount, this.shieldDecay, context, "regular", {
        sourceKey: this.key,
        visualVariant: "venom",
      });

      return {
        log: {
          en: `${formatChampionName(user)}'s scales harden (${amount} Shield).`,
          pt: `As escamas de ${formatChampionName(user)} endurecem (${amount} de Escudo).`,
        },
      };
    },
  },

  // ========================
  // Ultimate — Corrosive Maw
  // ========================
  {
    key: "corrosive_maw",
    name: "Corrosive Maw",

    isUltimate: true,
    momentumCost: 55,

    bf: 100,
    executeHpPercent: 60,
    executeBonusDamage: 40,
    poisonedStacks: 3,

    contact: true,
    damageMode: "standard",
    element: "poison",
    hitVfx: "acid_bite",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Zophiróx closes his jaws on the chosen target and empties every gland he has into the bite. Below <b>${this.executeHpPercent}%</b> of its <b>Max HP</b>, the target is already too weak to pull free, and the bite deals <b>${this.executeBonusDamage}</b> bonus damage. If it lands, it applies <b>${this.poisonedStacks}</b> stacks of <b>Poisoned</b>. Deals physical damage.`,
        pt: `Zophiróx fecha as mandíbulas no alvo escolhido e esvazia todas as glândulas na mordida. Abaixo de <b>${this.executeHpPercent}%</b> do seu <b>HP Máximo</b>, o alvo já está fraco demais para se soltar, e a mordida causa <b>${this.executeBonusDamage}</b> de dano bônus. Se acertar, aplica <b>${this.poisonedStacks}</b> acúmulos de <b>Envenenado</b>. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const weakened = enemy.HP < (enemy.maxHP * this.executeHpPercent) / 100;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: weakened ? this.executeBonusDamage : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "poisoned")) {
        enemy.applyStatusEffect(
          "poisoned",
          undefined,
          context,
          {},
          this.poisonedStacks,
        );
      }

      return results;
    },
  },
];

export default zophiroxSkills;
