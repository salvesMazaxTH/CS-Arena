import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const lorenaSkills = [
  totalBlock,

  {
    key: "tag_youre_it",
    name: "Tag, You're It",

    bf: 25,
    markWindow: 2,

    contact: false,
    damageMode: "standard",
    hitVfx: "musket_ball",
    priority: 0,

    description() {
      return {
        en: `Lorena blows the chosen target a mocking little kiss down the barrel before she even fires: deals <b>physical damage</b> and marks them for <b>${this.markWindow}</b> turn(s), so her next hit against them is always a <b>critical hit</b>.`,
        pt: `Lorena manda um beijo zombeteiro pelo cano antes mesmo de puxar o gatilho: causa <b>dano físico</b> e marca o alvo escolhido por <b>${this.markWindow}</b> turno(s), garantindo que seu próximo golpe contra ele seja sempre um <b>acerto crítico</b>.`,
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

      const hitResult = Array.isArray(result) ? result[0] : result;

      // The mark only sticks if the shot actually connects.
      if (hitResult?.landed) {
        enemy.runtime.lorenaMarkUntilTurn =
          context.currentTurn + this.markWindow;
      }

      return result;
    },
  },

  {
    key: "double_tap",
    name: "Double Tap",

    bfPerHit: 35,

    contact: false,
    damageMode: "standard",
    hitVfx: "musket_ball",
    priority: 0,

    description() {
      return {
        en: `Lorena squeezes both triggers before the recoil from the first shot even settles, putting two rounds into the chosen target — each one rolls for its own <b>critical hit</b>.`,
        pt: `Lorena aperta os dois gatilhos antes mesmo do recuo do primeiro tiro se dissipar, cravando duas balas no alvo escolhido — cada uma com sua própria chance de <b>acerto crítico</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bfPerHit) / 100;
      const results = [];

      for (let i = 0; i < 2; i++) {
        const result = new DamageEvent({
          baseDamage,
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

  {
    key: "last_laugh",
    name: "Last Laugh",

    bf: 125,
    markedPiercingPercentage: 15,

    contact: false,
    damageMode: "standard",
    hitVfx: "musket_ball",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `Lorena decides the joke's over: she puts everything she's got into one shot, dealing heavy <b>physical damage</b> to the chosen target — and if they're already marked, the shot also ignores <b>${this.markedPiercingPercentage}%</b> of their <b>Defense</b>.`,
        pt: `Lorena decide que a piada acabou: coloca tudo o que tem em um único tiro, causando pesado <b>dano físico</b> ao alvo escolhido — e, se ele já estiver marcado, o disparo também ignora <b>${this.markedPiercingPercentage}%</b> da <b>Defesa</b> dele.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const marked = enemy.runtime.lorenaMarkUntilTurn !== undefined;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        mode: marked ? "piercing" : undefined,
        piercingPercentage: marked ? this.markedPiercingPercentage : undefined,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
];

export default lorenaSkills;
