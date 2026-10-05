import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import { formatChampionName } from "../../../ui/formatters.js";
import thorns from "../../statusEffects/thorns.js";
import totalBlock from "../generic/totalBlock.js";

const xharkovarSkills = [
  totalBlock,

  // ========================
  // Skill 1 — Whet the Briar
  // ========================
  {
    key: "whet_the_briar",
    name: "Whet the Briar",
    bristleDamage: 25,
    contact: false,
    damageMode: "piercing",
    hitVfx: "spine_volley",
    priority: 2,
    tierGain: 1,

    description() {
      return {
        en: `Xharkovar drags his spines against one another until they bleed an edge, raising his <b>Thorns</b> by <b>${this.tierGain}</b> tier. Once they can grow no sharper (<b>Thorns V</b>), he bristles instead and sheds them over every enemy for <b>${this.bristleDamage}</b> physical damage that ignores <b>Defense</b>.`,
        pt: `Xharkovar raspa os espinhos uns nos outros até que sangrem um gume, elevando seus <b>Espinhos</b> em <b>${this.tierGain}</b> nível. Quando já não há como afiá-los mais (<b>Espinhos V</b>), ele se eriça e os dispara sobre todos os inimigos, causando <b>${this.bristleDamage}</b> de dano físico que ignora <b>Defesa</b>.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      if (thorns.tierOf(user) < thorns.maxTier) {
        user.applyStatusEffect(
          "thorns",
          Infinity,
          context,
          { persistent: true, sourceId: user.id },
          this.tierGain,
        );

        const tier = thorns.toRoman(thorns.tierOf(user));
        return {
          log: {
            en: `<b>[${this.name}]</b> ${formatChampionName(user)} whets his spines to Thorns ${tier}.`,
            pt: `<b>[${this.name}]</b> ${formatChampionName(user)} afia seus espinhos até Espinhos ${tier}.`,
          },
        };
      }

      const results = [];
      const enemies = TargetFilter.candidates(
        "enemy",
        user,
        context.aliveChampions ?? [],
      );

      for (const enemy of enemies) {
        const result = new DamageEvent({
          baseDamage: this.bristleDamage,
          mode: DamageEvent.Modes.PIERCING,
          piercingPercentage: 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(...(Array.isArray(result) ? result : [result]));
      }

      return results;
    },
  },

  // ========================
  // Skill 2 — Pinning Spines
  // ========================
  {
    key: "pinning_spines",
    name: "Pinning Spines",
    bf: 65,
    contact: true,
    damageMode: "standard",
    hitVfx: "spine_volley",
    priority: 0,
    snareDuration: 1,

    description() {
      return {
        en: `Xharkovar grabs the chosen target and drives his forearm spines through them, leaving them <b>Snared</b> for <b>${this.snareDuration}</b> turn. Deals physical damage.`,
        pt: `Xharkovar agarra o alvo escolhido e crava nele os espinhos do antebraço, deixando-o <b>Enredado</b> por <b>${this.snareDuration}</b> turno. Causa dano físico.`,
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

      if (effectConnected(arr[0], "snared")) {
        enemy.applyStatusEffect("snared", this.snareDuration, context, {
          sourceId: user.id,
        });
      }

      return arr;
    },
  },

  // ========================
  // Ultimate — Briarbound Embrace
  // ========================
  {
    key: "briarbound_embrace",
    name: "Briarbound Embrace",
    bf: 110,
    contact: true,
    damageMode: "standard",
    hitVfx: "briar_crush",
    isUltimate: true,
    maxTierBonusDamage: 30,
    momentumCost: 55,
    priority: 0,
    shieldAmount: 80,
    tierGain: 2,

    description() {
      return {
        en: `Xharkovar pulls the chosen target into his arms and crushes them against every spine he has. Afterwards his <b>Thorns</b> rise by <b>${this.tierGain}</b> tiers. If he is already at <b>Thorns V</b>, the embrace deals <b>${this.maxTierBonusDamage}</b> bonus damage instead, and he gains a <b>Shield</b> of <b>${this.shieldAmount}</b>. Deals physical damage.`,
        pt: `Xharkovar puxa o alvo escolhido para os braços e o esmaga contra cada espinho que tem. Em seguida, seus <b>Espinhos</b> sobem <b>${this.tierGain}</b> níveis. Se ele já estiver em <b>Espinhos V</b>, o abraço causa <b>${this.maxTierBonusDamage}</b> de dano bônus no lugar disso, e ele ganha um <b>Escudo</b> de <b>${this.shieldAmount}</b>. Causa dano físico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      // Read before the hit: the payoff belongs to spines already at full edge.
      const atMax = thorns.tierOf(user) >= thorns.maxTier;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: atMax ? this.maxTierBonusDamage : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      // The return of a thorned target can kill him mid-embrace.
      if (!user.alive) return arr;

      if (atMax) {
        user.addShield(this.shieldAmount, 0, context, "regular", {
          sourceId: user.id,
        });
      } else {
        user.applyStatusEffect(
          "thorns",
          Infinity,
          context,
          { persistent: true, sourceId: user.id },
          this.tierGain,
        );
      }

      return arr;
    },
  },
];

export default xharkovarSkills;
