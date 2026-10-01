import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const killerMeowSkills = [
  totalBlock,

  // ========================
  // H1 — Whetted Claws
  // ========================
  {
    key: "whetted_claws",
    name: "Whetted Claws",

    bf: 65,
    bleedingStacks: 1,

    contact: true,
    damageMode: "standard",
    hitVfx: "claw",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Killer Meow drops off the ledge behind the chosen target and opens them on the way down, four lines drawn so cleanly they take a moment to start bleeding, and leaves them <b>Bleeding</b> for <b>${this.bleedingStacks}</b> stack(s). Deals physical damage.`,
        pt: `Killer Meow salta da beirada atrás do alvo escolhido e o abre na queda, quatro linhas traçadas com tamanha limpeza que demoram um instante para começar a sangrar, e o deixa <b>Sangrando</b> por <b>${this.bleedingStacks}</b> acúmulo(s). Causa dano físico.`,
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

      if (effectConnected(results[0], "bleeding")) {
        enemy.applyStatusEffect(
          "bleeding",
          undefined,
          context,
          { sourceId: user.id },
          this.bleedingStacks,
        );
      }

      return results;
    },
  },

  // ========================
  // H2 — Gutter Feint
  // ========================
  {
    key: "gutter_feint",
    name: "Gutter Feint",

    bf: 35,
    piercingPercentage: 75,
    evasionBuff: 15,

    contact: true,
    damageMode: "piercing",
    hitVfx: "claw",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Killer Meow offers the chosen target the shoulder they were expecting, lets them commit to it, and puts the claw in under the guard instead, ignoring <b>${this.piercingPercentage}%</b> of their <b>Defense</b>. He keeps the low, sideways footing the feint left him in for <b>+${this.evasionBuff}%</b> <b>Evasion</b> for the rest of the turn. Deals physical damage.`,
        pt: `Killer Meow oferece ao alvo escolhido o ombro que ele esperava, deixa que se comprometa com o golpe, e enfia a garra sob a guarda em seu lugar, ignorando <b>${this.piercingPercentage}%</b> da <b>Defesa</b> do alvo. Ele mantém a postura baixa e de lado que a finta lhe deu por <b>+${this.evasionBuff}%</b> de <b>Esquiva</b> pelo resto do turno. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      user.buffStat({
        statName: "Evasion",
        amount: this.evasionBuff,
        duration: 1,
        context,
      });

      return Array.isArray(result) ? result : [result];
    },
  },

  // ========================
  // Ultimate — The Last Life
  // ========================
  {
    key: "the_last_life",
    name: "The Last Life",

    isUltimate: true,
    momentumCost: 55,

    bf: 85,
    bfPerLife: 7,

    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Killer Meow throws everything the cat has survived into one fall and lands on the chosen target with all of it at once, striking <b>${this.bfPerLife}%</b> of his <b>Attack</b> harder for every life he came into the turn with. Deals physical damage.`,
        pt: `Killer Meow lança tudo o que o gato já sobreviveu em uma única queda e cai sobre o alvo escolhido com tudo de uma vez, golpeando <b>${this.bfPerLife}%</b> do seu <b>Ataque</b> mais forte para cada vida com que entrou no turno. Causa dano físico.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const lives = user.runtime.meowLivesAtLock ?? 0;
      const bf = this.bf + lives * this.bfPerLife;

      context.registerDialog({
        message: {
          en: `${formatChampionName(user)} comes down on ${formatChampionName(enemy)} with all ${lives} of the lives he came into this turn with.`,
          pt: `${formatChampionName(user)} cai sobre ${formatChampionName(enemy)} com todas as ${lives} vidas com que entrou neste turno.`,
        },
        sourceId: user.id,
        targetId: enemy.id,
      });

      const result = new DamageEvent({
        baseDamage: (user.Attack * bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return Array.isArray(result) ? result : [result];
    },
  },
];

export default killerMeowSkills;
