import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";
import totalBlock from "../generic/totalBlock.js";
import { SELINA_WARD } from "./passive.js";

const selinaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "light_that_shelters",
    name: "Light That Shelters",

    healAmount: 30,
    shieldAmount: 50,
    shieldDecay: 17,

    contact: false,
    priority: 2,

    description() {
      return {
        en: `Selina cups a soft light in her hands and lets it settle over the chosen ally, mending what it touches and refusing to let anything cruel linger. Restores <b>${this.healAmount}</b> HP, grants <b>${this.shieldAmount}</b> Shield that decays by <b>${this.shieldDecay}</b> per turn, and cleanses one negative status effect.`,
        pt: `Selina toma uma luz suave nas mãos e a deixa pousar sobre o aliado escolhido, curando o que toca e não deixando nada cruel se demorar. Restaura <b>${this.healAmount}</b> de HP, concede <b>${this.shieldAmount}</b> de Escudo que decai <b>${this.shieldDecay}</b> por turno, e cura um efeito de status negativo.`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;

      const healed = new HealEvent({
        target: ally,
        amount: this.healAmount,
        context,
        source: user,
        allChampions: context?.allChampions,
      }).execute();

      ally.addShield(this.shieldAmount, this.shieldDecay, context, "regular", {
        source: SELINA_WARD,
      });

      const [cleansed] = ally.getStatusEffects({ type: "debuff" });
      if (cleansed) ally.removeStatusEffect(cleansed.key);

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: {
          en: `${userName} wraps ${
            userName === allyName ? "herself" : allyName
          } in <b>Light That Shelters</b>: <b>${healed}</b> HP restored and <b>${this.shieldAmount}</b> Shield raised${cleansed ? `, ${cleansed.name} cleansed` : ""}.`,
          pt: `${userName} envolve ${
            userName === allyName ? "a si mesma" : allyName
          } em <b>Luz Que Protege</b>: <b>${healed}</b> de HP restaurado e <b>${this.shieldAmount}</b> de Escudo erguido${cleansed ? `, ${cleansed.name} removido` : ""}.`,
        },
      };
    },
  },

  {
    key: "blinding_radiance",
    name: "Blinding Radiance",

    bf: 55,
    blindDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 1,

    hits: [
      { id: "flare", type: "magical", hitVfx: "radiant_bolt" },
      {
        id: "cut",
        label: "Blade",
        bf: 35,
        type: "physical",
        contact: true,
        hitVfx: "slash",
      },
    ],

    description() {
      return {
        en: `Selina opens her palm and lets her light flare past anything merciful about it, searing across the chosen enemy's eyes, and the sword she has been dragging all this time finally comes up to finish the motion. Deals <b>magical damage</b> equal to <b>${this.bf}%</b> of her Attack and <b>physical damage</b> equal to <b>${SkillHits.spec(this, "cut").bf}%</b> of her Attack, leaving them <b>Blinded</b> for <b>${this.blindDuration}</b> turn(s).`,
        pt: `Selina abre a palma da mão e deixa sua luz brilhar além de qualquer piedade, queimando os olhos do inimigo escolhido, e a espada que vinha arrastando o tempo todo finalmente sobe para terminar o movimento. Causa <b>dano mágico</b> igual a <b>${this.bf}%</b> do seu Ataque e <b>dano físico</b> igual a <b>${SkillHits.spec(this, "cut").bf}%</b> do seu Ataque, deixando o alvo <b>Cego</b> por <b>${this.blindDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      for (const hitId of ["flare", "cut"]) {
        const result = SkillHits.run(this, hitId, {
          user,
          target: enemy,
          context,
        });
        results.push(...(Array.isArray(result) ? result : [result]));
      }

      if (effectConnected(results[0], "blind")) {
        enemy.applyStatusEffect("blind", this.blindDuration, context, {
          sourceId: user.id,
        });
      }

      return results;
    },
  },

  {
    key: "cataclysm_of_dawn",
    name: "Cataclysm of Dawn",

    bf: 100,
    allyShieldAmount: 60,
    allyShieldDecay: 20,
    allyDamageReductionPercent: 20,
    allyReductionDuration: 2,

    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    hitVfx: "radiant_bolt",
    priority: 0,

    description() {
      return {
        en: `Every ounce of restraint Selina has learned to carry gives out at once, and the light she has spent the whole match holding back breaks loose across the entire field. Deals <b>magical damage</b> to all enemies, while every ally caught in the same flare gains <b>${this.allyShieldAmount}</b> Shield that decays by <b>${this.allyShieldDecay}</b> per turn and takes <b>${this.allyDamageReductionPercent}%</b> less damage for <b>${this.allyReductionDuration}</b> turn(s).`,
        pt: `Cada grama de contenção que Selina aprendeu a carregar se esgota de uma vez, e a luz que segurou o combate inteiro se solta por todo o campo. Causa <b>dano mágico</b> a todos os inimigos, enquanto cada aliado pego pelo mesmo clarão ganha <b>${this.allyShieldAmount}</b> de Escudo que decai <b>${this.allyShieldDecay}</b> por turno e recebe <b>${this.allyDamageReductionPercent}%</b> menos dano por <b>${this.allyReductionDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const allies = TargetFilter.candidates("ally", user, context.aliveChampions ?? []);

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of enemies) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();
        results.push(...(Array.isArray(result) ? result : [result]));
      }

      for (const ally of allies) {
        ally.addShield(
          this.allyShieldAmount,
          this.allyShieldDecay,
          context,
          "regular",
          { source: SELINA_WARD },
        );

        ally.applyDamageReduction({
          amount: this.allyDamageReductionPercent,
          duration: this.allyReductionDuration,
          type: "percent",
          source: this.key,
          context,
        });
      }

      results.push({
        log: {
          en: `${formatChampionName(user)} unleashes <b>Cataclysm of Dawn</b> — the enemy line is seared with light while every ally is shielded from the same blast.`,
          pt: `${formatChampionName(user)} desencadeia <b>Cataclismo do Amanhecer</b> — a linha inimiga é queimada com luz enquanto cada aliado é blindado pela mesma explosão.`,
        },
      });

      return results;
    },
  },
];

export default selinaSkills;
