import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";
import { shredSpeed, speedAdvantage } from "./passive.js";

function stripPositiveEffects(target) {
  let removed = 0;

  for (const status of target.getStatusEffects({ type: "buff" })) {
    target.removeStatusEffect(status.key);
    removed += 1;
  }

  const modifiers = target.statModifiers.filter(
    (modifier) =>
      modifier.amount > 0 && !modifier.isPermanent && !modifier.statusKey,
  );

  if (modifiers.length > 0) {
    target.removeStatModifiers(modifiers);
    removed += modifiers.length;
  }

  return removed;
}

const kazeminusSkills = [
  totalBlock,

  {
    key: "rarefied_air",
    name: "Rarefied Air",

    bf: 85,
    speedShred: 40,
    shredDuration: 3,

    element: "air",
    contact: false,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `Kazeminus closes his hand and the air closes with it; the chosen target's breath grows thin as the wind withdraws from them, until each motion costs more than it is worth. Deals magical damage and lowers their <b>Speed</b> by <b>${this.speedShred}</b> for <b>${this.shredDuration}</b> turn(s).`,
        pt: `Kazeminus fecha a mão, e o ar se fecha com ela; o fôlego do alvo escolhido se torna escasso à medida que o vento se retira de seu corpo, até que cada movimento passe a custar mais do que vale. Causa dano mágico e reduz sua <b>Velocidade</b> em <b>${this.speedShred}</b> por <b>${this.shredDuration}</b> turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      shredSpeed(user, enemy, this.speedShred, this.shredDuration, context);

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "zephyr_underfoot",
    name: "Zephyr Underfoot",

    bf: 75,
    bonusPerSpeedAdvantage: 1,
    snaredDuration: 2,

    element: "air",
    contact: false,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return {
        en: `The current the chosen target has been standing on all this time turns over and goes elsewhere, withdrawn as casually as a blessing taken back, and there was never any ground beneath them. Deals magical damage with <b>${this.bonusPerSpeedAdvantage}</b> bonus damage for each point of <b>Speed</b> Kazeminus holds over them, and leaves them Snared for <b>${this.snaredDuration}</b> turn(s).`,
        pt: `A corrente sobre a qual o alvo escolhido esteve de pé durante todo esse tempo simplesmente se volta e segue seu curso para outro lugar, recolhida com a mesma casualidade de uma bênção que se desfaz — e, afinal, nunca houve chão algum sob seus pés. Causa <b>${this.bonusPerSpeedAdvantage}</b> de dano mágico adicional para cada ponto de <b>Velocidade</b> que Kazeminus possuir além do alvo e o deixa <b>Enredado</b> por <b>${this.snaredDuration}</b> turno(s).`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: speedAdvantage(user, enemy) * this.bonusPerSpeedAdvantage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "snared")) {
        enemy.applyStatusEffect("snared", this.snaredDuration, context, {
          sourceId: user.id,
          sourceName: user.name,
        });
      }

      return results;
    },
  },

  {
    key: "the_world_lets_go",
    name: "The World Lets Go",

    bf: 105,

    element: "air",
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 0,
    targetSpec: ["all:enemy"],

    description() {
      return {
        en: `Kazeminus opens the hand he has been holding shut since the fight began, and the world learns what it was to live under his favor: the air stops agreeing to hold anything at all. Deals magical damage to all enemies and takes from each of them every positive status effect and every temporary stat buff they were carrying.`,
        pt: `Kazeminus abre a mão que ele tinha mantido fechada desde que a luta começou, e o mundo todo conhece o que era viver sob a sua bênção: o ar para de concordar em segurar qualquer coisa. Causa dano mágico a todos os inimigos e retira de cada um deles todos os seus respectivos status effects positivos e todos os modificadores positivos temporários de stats.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const results = [];

      for (const enemy of targets) {
        if (!enemy?.alive) continue;

        const result = new DamageEvent({
          baseDamage: (user.Attack * this.bf) / 100,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(
          ...(Array.isArray(result) ? result : [result]).filter(Boolean),
        );

        stripPositiveEffects(enemy);
      }

      return results;
    },
  },
];

export default kazeminusSkills;
