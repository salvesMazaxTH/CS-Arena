import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import { spendDefense } from "./passive.js";

const farkovethSkills = [
  basicStrike,

  {
    key: "perched",
    name: "Perched",

    effectDuration: 2,
    nextSkillBonus: 30,

    contact: false,
    priority: 2,
    targetSpec: ["self"],

    description() {
      return {
        en: `Four metres of hooded stone settle onto whatever will hold them and stop being a thing anyone thinks to look at. Farkoveth becomes <b>Invisible</b> for <b>${this.effectDuration}</b> turn(s) or until he acts, and the next damaging skill he uses deals <b>${this.nextSkillBonus}%</b> increased damage.`,
        pt: `Quatro metros de pedra encapuzada se acomodam sobre o que quer que os sustente e deixam de ser algo em que alguém pensa em reparar. Farkoveth fica <b>Invisível</b> por <b>${this.effectDuration}</b> turno(s) ou até agir, e a próxima habilidade de dano que usar causa dano <b>${this.nextSkillBonus}%</b> maior.`,
      };
    },

    resolve({ user, context = {} }) {
      const bonus = this.nextSkillBonus;

      user.removeStatusEffect("invisible");
      user.applyStatusEffect("invisible", this.effectDuration, context, {
        source: this.key,
      });

      user.removeHookEffects((hook) => hook.key === "perched_edge");

      user.addHookEffect(
        {
          type: "buff",
          key: "perched_edge",
          group: "skill",
          expiresAtTurn: context.currentTurn + this.effectDuration,
          hookScope: { onBeforeDmgDealing: "attacker" },
          onBeforeDmgDealing({ attacker, owner, damage, skill, context }) {
            if (attacker !== owner || !skill || context.damageDepth > 0) return;

            owner.removeHookEffects((hook) => hook.key === "perched_edge");
            return { damage: Number(damage) * (1 + bonus / 100) };
          },
        },
        context,
      );

      context.registerDialog?.({
        message: {
          en: `${formatChampionName(user)} folds into the stone and stops being there.`,
          pt: `${formatChampionName(user)} se dobra na pedra e deixa de estar ali.`,
        },
        sourceId: user.id,
      });

      return [
        {
          log: {
            en: `${formatChampionName(user)} perches, unseen, waiting for the drop.`,
            pt: `${formatChampionName(user)} se empoleira, despercebido, esperando o momento de atacar.`,
          },
        },
      ];
    },
  },

  {
    key: "chipped_edge",
    name: "Chipped Edge",

    bf: 65,
    defenseCost: 50,
    bonusPerDefense: 1,

    element: "earth",
    hitVfx: "slash",
    hitVfxPalette: "earth",
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `He breaks a shard off his own forearm, sets it against the kunai and lets the edge carry the weight of the piece he just lost. Farkoveth spends <b>${this.defenseCost}</b> of his <b>Defense</b>. Deals <b>physical damage</b>, plus bonus damage equal to <b>${this.bonusPerDefense}x</b> the Defense actually spent.`,
        pt: `Ele quebra um estilhaço do próprio antebraço, encosta-o na kunai e deixa que a lâmina carregue o peso do pedaço que acabou de perder. Farkoveth gasta <b>${this.defenseCost}</b> de sua <b>Defesa</b>. Causa <b>dano físico</b>, mais dano bônus igual a <b>${this.bonusPerDefense}x</b> a Defesa realmente gasta.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const spent = spendDefense({
        user,
        amount: this.defenseCost,
        context,
      });

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: spent * this.bonusPerDefense,
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
    key: "the_statue_comes_down",
    name: "The Statue Comes Down",

    bf: 120,
    bonusPerDefense: 0.6,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Farkoveth stops holding himself together and drops the whole four metres of it onto the chosen target at once. He spends every point of <b>Defense</b> he still has, and is left with none of it. Deals <b>physical damage</b>, plus bonus damage equal to <b>${this.bonusPerDefense}x</b> the Defense spent.`,
        pt: `Farkoveth para de se manter unido e derruba os quatro metros inteiros sobre o alvo escolhido de uma vez. Ele gasta cada ponto de <b>Defesa</b> que ainda tem, ficando sem nenhuma. Causa <b>dano físico</b>, mais dano bônus igual a <b>${this.bonusPerDefense}x</b> a Defesa gasta.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const spent = spendDefense({
        user,
        amount: user.Defense,
        context,
      });

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: spent * this.bonusPerDefense,
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

export default farkovethSkills;
