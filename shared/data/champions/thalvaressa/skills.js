import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const thalvaressaSkills = [
  // =========================
  // Total Block (global)
  // =========================

  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "vine_lash",
    name: "Vine Lash",

    bf: 80,
    damageMode: "standard",
    rootDuration: 2,

    contact: false,
    element: "plant",
    hitVfx: "vine_lash",
    hitVfxPalette: "verdant",

    priority: 0,

    description() {
      return {
        en: `A vine uncoils from Thálvaressa's canopy and snaps across the chosen target, dealing <b>magical damage</b> and taking root around their legs, leaving them <b>Rooted</b> for <b>${this.rootDuration}</b> turn(s).`,
        pt: `Um cipó se desenrola da copa de Thálvaressa e estala sobre o alvo escolhido, causando <b>dano mágico</b> e criando raízes ao redor de suas pernas, deixando-o <b>Enraizado</b> por <b>${this.rootDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context }) {
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

      if (effectConnected(result, "rooted")) {
        enemy.applyStatusEffect("rooted", this.rootDuration, context, {
          sourceId: user.id,
        });
      }

      return result;
    },
  },

  {
    key: "bramble_ward",
    name: "Bramble Ward",

    damageReduction: 20,
    wardDuration: 2,

    contact: false,
    element: "plant",

    priority: 2,

    description() {
      return {
        en: `Thálvaressa closes a wall of brambles around the chosen ally, tearing one <b>negative status effect</b> off them and reducing the damage they take by <b>${this.damageReduction}%</b> for <b>${this.wardDuration}</b> turn(s).`,
        pt: `Thálvaressa fecha uma parede de espinheiros ao redor do aliado escolhido, arrancando dele um <b>efeito de status negativo</b> e reduzindo em <b>${this.damageReduction}%</b> o dano que ele recebe por <b>${this.wardDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context }) {
      const [ally] = targets;
      if (!ally) return;

      const [cleansed] = ally.getStatusEffects({ type: "debuff" });
      if (cleansed) ally.removeStatusEffect(cleansed.key);

      ally.applyDamageReduction({
        amount: this.damageReduction,
        duration: this.wardDuration,
        type: "percent",
        source: this.key,
        context,
      });

      return {
        log: {
          en: `${formatChampionName(user)} closes <b>Bramble Ward</b> around ${formatChampionName(
            ally,
          )}: <b>${this.damageReduction}%</b> less damage taken for <b>${this.wardDuration}</b> turn(s)${
            cleansed ? `, <b>${cleansed.name}</b> torn off` : ""
          }.`,
          pt: `${formatChampionName(user)} fecha o <b>Manto de Espinheiros</b> ao redor de ${formatChampionName(
            ally,
          )}: <b>${this.damageReduction}%</b> menos dano recebido por <b>${this.wardDuration}</b> turno(s)${
            cleansed ? `, <b>${cleansed.name}</b> arrancado` : ""
          }.`,
        },
      };
    },
  },

  {
    key: "mother_earths_protection",
    name: "Mother Earth's Protection",

    healPerTurn: 45,
    auraDuration: 3,
    cleanseCount: 2,
    damageReduction: 8,

    contact: false,
    element: "plant",
    hitVfx: "roots",
    isUltimate: true,
    momentumCost: 55,

    priority: 5,

    description() {
      return {
        en: `Thálvaressa calls Mother Earth's protection down over her whole team, herself included, tearing up to <b>${this.cleanseCount}</b> <b>negative status effects</b> off each of them. For <b>${this.auraDuration}</b> turn(s), everyone under it takes <b>${this.damageReduction}%</b> less damage and restores <b>${this.healPerTurn}</b> HP at the start of each turn — the healing alone never reaches Thálvaressa.`,
        pt: `Thálvaressa invoca a proteção da Mãe Terra sobre todo o seu time, ela inclusa, arrancando de cada um até <b>${this.cleanseCount}</b> <b>efeitos de status negativos</b>. Por <b>${this.auraDuration}</b> turno(s), todos sob ela recebem <b>${this.damageReduction}%</b> menos dano e restauram <b>${this.healPerTurn}</b> de HP no início de cada turno — só a cura é que nunca alcança Thálvaressa.`,
      };
    },

    targetSpec: ["all:ally"],

    resolve({ user, targets, context }) {
      const { healPerTurn } = this;
      const key = this.key;

      for (const ally of targets) {
        if (!ally.alive) continue;
        if (ally.team !== user.team) continue;

        for (const debuff of ally
          .getStatusEffects({ type: "debuff" })
          .slice(0, this.cleanseCount)) {
          ally.removeStatusEffect(debuff.key);
        }

        ally.applyDamageReduction({
          amount: this.damageReduction,
          duration: this.auraDuration,
          type: "percent",
          source: key,
          context,
        });

        ally.runtime.hookEffects ??= [];
        ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
          (effect) => effect.key !== key,
        );

        ally.addHookEffect(
          {
            type: "buff",
            key,
            group: "skill",
            ownerId: user.id,
            expiresAtTurn: context.currentTurn + this.auraDuration,

            onTurnStart({ owner, context }) {
              const healed = new HealEvent({
                target: owner,
                amount: healPerTurn,
                context,
                source: owner,
              }).execute();

              if (healed <= 0) return;

              return {
                log: {
                  en: `<b>Mother Earth's Protection</b> restores <b>${healed}</b> HP to ${formatChampionName(owner)}.`,
                  pt: `A <b>Proteção da Mãe Terra</b> restaura <b>${healed}</b> de HP a ${formatChampionName(owner)}.`,
                },
              };
            },
          },
          context,
        );
      }

      return {
        log: {
          en: `${formatChampionName(user)} calls down <b>Mother Earth's Protection</b>: her team is cleansed of up to <b>${this.cleanseCount}</b> <b>negative status effects</b> each, takes <b>${this.damageReduction}%</b> less damage and restores <b>${this.healPerTurn}</b> HP at the start of each turn for <b>${this.auraDuration}</b> turn(s).`,
          pt: `${formatChampionName(user)} invoca a <b>Proteção da Mãe Terra</b>: seu time é limpo de até <b>${this.cleanseCount}</b> <b>efeitos de status negativos</b> cada, recebe <b>${this.damageReduction}%</b> menos dano e restaura <b>${this.healPerTurn}</b> de HP no início de cada turno por <b>${this.auraDuration}</b> turno(s).`,
        },
      };
    },
  },
];

export default thalvaressaSkills;
