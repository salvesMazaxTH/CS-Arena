import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const thornsTier = (champion) => champion.statusEffects?.get("thorns")?.tier ?? 0;

const toArray = (result) => (Array.isArray(result) ? result : [result]);

const zagurothSkills = [
  basicStrike,

  // ========================
  // Skill 1 — Club Swing
  // ========================
  {
    key: "club_swing",
    name: "Club Swing",
    bf: 90,
    bonusDamagePerTier: 6,
    contact: true,
    damageMode: "standard",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Zaguroth swings his spiked club into the chosen target, and every spine on his arm bites in with it, dealing <b>${this.bonusDamagePerTier}</b> bonus damage per tier of his <b>Thorns</b>. Deals physical damage.`,
        pt: `Zaguroth acerta o alvo escolhido com a clava cravejada, e cada espinho do braço morde junto, causando <b>${this.bonusDamagePerTier}</b> de dano bônus por nível dos seus <b>Espinhos</b>. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return toArray(
        new DamageEvent({
          baseDamage: (user.Attack * this.bf) / 100,
          bonusDamage: this.bonusDamagePerTier * thornsTier(user),
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute(),
      );
    },
  },

  // ========================
  // Skill 2 — Thorn Vines
  // ========================
  {
    key: "thorn_vines",
    name: "Thorn Vines",
    bf: 60,
    bonusDamagePerTierSpent: 15,
    rootedDuration: 1,
    allyThornsTier: 1,
    contact: false,
    damageMode: "standard",
    hitVfx: "roots",
    priority: 0,

    targetSpec: ["enemy", { type: "select:ally", excludesSelf: true }],

    description() {
      return {
        en: `Zaguroth tears his spines loose and plants them in the sand, and giant thorn vines burst up around the chosen enemy, dealing <b>${this.bonusDamagePerTierSpent}</b> bonus damage per tier of <b>Thorns</b> spent and leaving it <b>Rooted</b> for <b>${this.rootedDuration}</b> turn. His <b>Thorns</b> fall back to <b>I</b>, and the vines coil around the chosen ally too, granting it permanent <b>Thorns</b>. Deals physical damage.`,
        pt: `Zaguroth arranca os próprios espinhos e os planta na areia, e vinhas de espinhos gigantescas irrompem ao redor do inimigo escolhido, causando <b>${this.bonusDamagePerTierSpent}</b> de dano bônus por nível de <b>Espinhos</b> gasto e deixando-o <b>Enraizado</b> por <b>${this.rootedDuration}</b> turno. Seus <b>Espinhos</b> voltam ao <b>I</b>, e as vinhas também se enroscam no aliado escolhido, concedendo-lhe <b>Espinhos</b> permanentes. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const enemy = targets.find((t) => t.team !== user.team);
      const ally = targets.find((t) => t.team === user.team && t.id !== user.id);

      const tiersSpent = thornsTier(user);
      if (tiersSpent > 0) {
        user.removeStatusEffect("thorns");
        user.applyStatusEffect(
          "thorns",
          Infinity,
          context,
          { persistent: true, sourceId: user.id },
          1,
        );
      }

      const results = enemy
        ? toArray(
            new DamageEvent({
              baseDamage: (user.Attack * this.bf) / 100,
              bonusDamage: this.bonusDamagePerTierSpent * tiersSpent,
              attacker: user,
              defender: enemy,
              skill: this,
              type: "physical",
              context,
              allChampions: context?.allChampions,
            }).execute(),
          )
        : [];

      if (enemy && effectConnected(results[0], "rooted")) {
        enemy.applyStatusEffect("rooted", this.rootedDuration, context, {
          sourceId: user.id,
        });
      }

      if (ally?.alive) {
        ally.applyStatusEffect(
          "thorns",
          Infinity,
          context,
          { persistent: true, sourceId: user.id },
          this.allyThornsTier,
        );
        results.push({
          log: {
            en: `<b>[${this.name}]</b> Thorn vines coil around ${formatChampionName(ally)}.`,
            pt: `<b>[${this.name}]</b> Vinhas de espinhos se enroscam em ${formatChampionName(ally)}.`,
          },
        });
      }

      return results;
    },
  },

  // ========================
  // Ultimate — Break the Ranks
  // ========================
  {
    key: "break_the_ranks",
    name: "Break the Ranks",

    isUltimate: true,
    momentumCost: 55,

    bf: 135,
    bonusDamagePerTier: 12,

    contact: true,
    damageMode: "standard",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Zaguroth charges into the enemy line and brings his club down on the chosen target with all his weight, dealing <b>${this.bonusDamagePerTier}</b> bonus damage per tier of his <b>Thorns</b>. Deals physical damage.`,
        pt: `Zaguroth avança contra a linha inimiga e desce a clava sobre o alvo escolhido com todo o peso, causando <b>${this.bonusDamagePerTier}</b> de dano bônus por nível dos seus <b>Espinhos</b>. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return toArray(
        new DamageEvent({
          baseDamage: (user.Attack * this.bf) / 100,
          bonusDamage: this.bonusDamagePerTier * thornsTier(user),
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute(),
      );
    },
  },
];

export default zagurothSkills;
