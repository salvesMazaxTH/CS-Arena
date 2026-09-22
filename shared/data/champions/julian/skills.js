import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import weightOfTheBolt from "./passive.js";

const julianSkills = [
  totalBlock,

  {
    key: "serpentbite_bolt",
    name: "Serpentbite Bolt",

    maxHPPercent: 8,
    poisonedStacks: 1,

    contact: false,
    damageMode: "piercing",
    piercingPercentage: 100,
    hitVfx: "poisoned_arrow",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Julian rolls a bolt-head across a vial of his own making, unhurried, and admires the sheen on it before firing into the chosen target. Deals <b>Piercing damage</b> equal to <b>${this.maxHPPercent}%</b> of their Max HP and leaves <b>${this.poisonedStacks}</b> stack of <b>Poisoned</b>.`,
        pt: `Julian passa a ponta do dardo por um de seus próprios frascos, sem pressa, admirando o brilho antes de disparar contra o alvo escolhido. Causa <b>dano Perfurante</b> igual a <b>${this.maxHPPercent}%</b> do HP Máximo dele e deixa <b>${this.poisonedStacks}</b> stack de <b>Veneno</b>.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const percent = this.maxHPPercent + weightOfTheBolt.onHitMaxHPPercent;
      const baseDamage = enemy.maxHP * (percent / 100);

      const result = new DamageEvent({
        baseDamage,
        piercingPercentage: this.piercingPercentage,
        mode: "piercing",
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const hit = Array.isArray(result) ? result[0] : result;

      if (effectConnected(hit, "poisoned")) {
        enemy.applyStatusEffect(
          "poisoned",
          undefined,
          context,
          { sourceId: user.id, sourceName: user.name },
          this.poisonedStacks,
        );
      }

      return result;
    },
  },

  {
    key: "breaching_bolt",
    name: "Breaching Bolt",

    maxHPPercent: 11,
    perStackPercent: 2,
    countedStackCap: 8,
    scoreStackThreshold: 4,
    scorePoints: 1,

    contact: false,
    damageMode: "piercing",
    piercingPercentage: 100,
    hitVfx: "poisoned_arrow",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Julian shoulders the heavy crossbow he keeps for gates and for anything that calls itself unbreakable, and puts a quarrel through the chosen target. Deals <b>Piercing damage</b> equal to <b>${this.maxHPPercent}%</b> of their Max HP, plus <b>${this.perStackPercent}%</b> for every stack of <b>Poisoned</b> they carry. If they carry <b>${this.scoreStackThreshold}</b> or more, Julian collects on the mark and his player scores <b>${this.scorePoints}</b> point.`,
        pt: `Julian ergue a besta pesada que reserva para portões e para tudo que se acha indestrutível, e crava um virote no alvo escolhido. Causa <b>dano Perfurante</b> igual a <b>${this.maxHPPercent}%</b> do HP Máximo dele, mais <b>${this.perStackPercent}%</b> por stack de <b>Veneno</b> que carregar. Se carregar <b>${this.scoreStackThreshold}</b> stacks ou mais, Julian cobra a marca e seu time pontua <b>${this.scorePoints}</b> ponto.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const poison = enemy.getStatusEffect("poisoned");
      const stacks = Math.max(0, Number(poison?.stacks) || 0);
      const countedStacks = Math.min(stacks, this.countedStackCap);

      const percent =
        this.maxHPPercent +
        weightOfTheBolt.onHitMaxHPPercent +
        countedStacks * this.perStackPercent;
      const baseDamage = enemy.maxHP * (percent / 100);

      const result = new DamageEvent({
        baseDamage,
        piercingPercentage: this.piercingPercentage,
        mode: "piercing",
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (stacks >= this.scoreStackThreshold) {
        context.registerScore({
          amount: this.scorePoints,
          scoringSlot: user.team - 1,
          reason: this.key,
          sourceId: user.id,
        });

        context.registerDialog({
          message: {
            en: `${formatChampionName(user)} collects on a well-poisoned mark — +${this.scorePoints} point.`,
            pt: `${formatChampionName(user)} cobra a marca bem envenenada — +${this.scorePoints} ponto.`,
          },
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return result;
    },
  },

  {
    key: "nonpareil",
    name: "Nonpareil",

    isUltimate: true,
    momentumCost: 55,

    bf: 135,
    maxHPPercent: 15,
    poisonedMultiplier: 2,

    contact: false,
    damageMode: "standard",
    type: "physical",
    hitVfx: "poisoned_arrow",
    priority: 0,

    hits: [
      { id: "impact", label: "Impact" },
      {
        id: "punch_through",
        label: "Punch-Through",
        damageMode: "piercing",
        piercingPercentage: 100,
      },
    ],

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Julian takes his time, because the room is watching, and draws the siege lock all the way back for the one shot he holds worthy of his name. Deals <b>physical damage</b> to the chosen target, then <b>Piercing damage</b> equal to <b>${this.maxHPPercent}%</b> of their Max HP — doubled if they are <b>Poisoned</b>.`,
        pt: `Julian se demora, porque a plateia está olhando, e puxa a trava de cerco até o fim para o único tiro que considera digno do seu nome. Causa <b>dano físico</b> ao alvo escolhido, seguido de <b>dano Perfurante</b> igual a <b>${this.maxHPPercent}%</b> do HP Máximo dele — dobrado se estiver <b>Envenenado</b>.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      // Read before the hits land: the doubling rewards poison already on the
      // target, not the stack Weight of the Bolt leaves this cast.
      const wasPoisoned = enemy.hasStatusEffect("poisoned");

      const impact = SkillHits.run(this, "impact", {
        user,
        target: enemy,
        context,
      });
      results.push(...(Array.isArray(impact) ? impact : [impact]));

      const pierceDamage = Math.floor(
        enemy.maxHP *
          (this.maxHPPercent / 100) *
          (wasPoisoned ? this.poisonedMultiplier : 1),
      );

      const punchThrough = SkillHits.run(this, "punch_through", {
        user,
        target: enemy,
        baseDamage: pierceDamage,
        context,
      });
      results.push(
        ...(Array.isArray(punchThrough) ? punchThrough : [punchThrough]),
      );

      return results;
    },
  },
];

export default julianSkills;
