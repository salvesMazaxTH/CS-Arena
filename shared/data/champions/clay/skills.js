import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const claySkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "reckoning_blow",
    name: "Reckoning Blow",

    bf: 75,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `Clay swings his whole weight into a single blow, no finesse, just force. Deals physical damage.`,
        pt: `Clay lança todo o peso do corpo em um único golpe — sem sutileza, sem técnica, apenas força bruta. Causa dano físico.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "reckless_fury",
    name: "Reckless Fury",

    bf: 45,
    missingHpScalingPercent: 70,
    bleedingStacks: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `The worse off Clay already is, the less he holds back — the wound itself becomes a weapon. Deals physical damage, adding up to an extra ${this.missingHpScalingPercent}% of his Attack scaled by how much HP he has already lost, and leaves the target Bleeding for ${this.bleedingStacks} stack(s).`,
        pt: `Quanto mais ferido Clay estiver, menos ele se contém — a própria ferida se transforma em arma. Causa dano físico, acrescentando até ${this.missingHpScalingPercent}% de seu Ataque, escalado conforme a quantidade de Vida que já perdeu, e deixa o alvo Sangrando por ${this.bleedingStacks} stack(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const missingHpRatio = 1 - user.HP / user.maxHP;
      const baseDamage =
        (user.Attack * this.bf) / 100 +
        (user.Attack * this.missingHpScalingPercent * missingHpRatio) / 100;

      const result = new DamageEvent({
        baseDamage,
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

  {
    key: "worth_the_blood",
    name: "Worth the Blood",

    bf: 140,
    recoilPercentOfMaxHP: 18,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    hits: [
      {
        id: "recoil",
        label: "Recoil (Worth the Blood)",
        type: "physical",
        contact: false,
        damageMode: "absolute",
        suppressLog: true,
      },
    ],

    description() {
      return {
        en: `Clay throws everything he has at the chosen target and pays for it out of his own body. Deals physical damage, plus Absolute recoil damage equal to ${this.recoilPercentOfMaxHP}% of his Max HP whether the blow lands or not — which may be exactly what drives him over the edge.`,
        pt: `Clay despeja tudo o que tem sobre o alvo escolhido e paga o preço com o próprio corpo. Causa dano físico, além de dano de recuo Absoluto equivalente a ${this.recoilPercentOfMaxHP}% de sua Vida Máxima, acerte o golpe ou não — o que talvez seja justamente o bastante para empurrá-lo para além do limite.`,
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];
      const recoilDamage = Math.floor(
        (user.maxHP * this.recoilPercentOfMaxHP) / 100,
      );

      context.registerDialog({
        message: `${formatChampionName(user)} tears himself open to swing that hard.`,
        sourceId: user.id,
        targetId: user.id,
      });

      const recoilResult = SkillHits.run(this, "recoil", {
        user,
        target: user,
        baseDamage: recoilDamage,
        context: { ...context, damageDepth: 1 },
      });

      const recoilEntries = Array.isArray(recoilResult)
        ? recoilResult
        : [recoilResult];
      results.push(...recoilEntries);

      const userName = formatChampionName(user);
      results.push({
        log: `${userName} takes ${recoilEntries[0].totalDamage} Absolute recoil damage from <b>${this.name}</b>.\nfinal HP of ${userName}: ${recoilEntries[0].finalHP}/${user.maxHP}`,
      });

      return results;
    },
  },
];

export default claySkills;
