import { formatChampionName } from "../../../ui/formatters.js";
import { SkillHits } from "../../../engine/combat/SkillHits.js";

export default {
  key: "unstoppable_progression",
  name: "Unstoppable Progression",
  stackCap: 8,
  speedPercentAsDamage: 0.85,

  hits: [
    {
      id: "explosion",
      type: "magical",
      contact: false,
      damageMode: "piercing",
      // Ignores 50% of the target's Defense.
      piercingPercentage: 50,
    },
  ],

  description(champion) {
    return {
      en: `Whenever Blyskartri or an ally gains <b>Speed</b> or <b>Evasion</b>, Blyskartri gains <b>1</b> stack of <b>Impulse</b>. Whenever Blyskartri evades an attack, he gains <b>1</b> additional stack. Max: <b>${this.stackCap}</b>.

    Current Stacks: <b>${champion.runtime?.impulseStacks ?? 0}</b>

    At <b>${this.stackCap}</b> stacks, consume all stacks to immediately deal <b>50%</b> <b>Hybrid Damage</b> equal to <b>${this.speedPercentAsDamage * 100}%</b> of the fastest ally's <b>Speed</b> to the enemy with the lowest HP.`,
      pt: `Sempre que Blyskartri ou um aliado ganha <b>Velocidade</b> ou <b>Esquiva</b>, Blyskartri ganha <b>1</b> carga de <b>Impulso</b>. Sempre que Blyskartri evade um ataque, ele ganha <b>1</b> carga adicional. Máx.: <b>${this.stackCap}</b>.

    Cargas Atuais: <b>${champion.runtime?.impulseStacks ?? 0}</b>

    Ao atingir <b>${this.stackCap}</b> cargas, consome todas as cargas para causar imediatamente <b>50%</b> de <b>Dano Híbrido</b> igual a <b>${this.speedPercentAsDamage * 100}%</b> da <b>Velocidade</b> do aliado mais rápido ao inimigo com menos HP.`,
    };
  },

  hookScope: {
    onBuffingStat: undefined,
    onEvade: undefined,
  },

  onBuffingStat({ owner, statName, amount, buffSrc, buffTarget, context }) {
    if (amount <= 0) return;
    if (!buffSrc || buffSrc.team !== owner.team) return;
    if (!buffTarget || buffTarget.team !== owner.team) return;

    if (statName !== "Speed" && statName !== "Evasion") return;

    return this._addStack({ owner, context });
  },

  onEvade({ owner, defender, context }) {
    if (defender.id !== owner.id) return;

    return this._addStack({ owner, context });
  },

  _addStack({ owner, context }) {
    owner.runtime ??= {};
    owner.runtime.impulseStacks ??= 0;

    if (owner.runtime.impulseStacks >= this.stackCap) return;

    owner.runtime.impulseStacks++;

    const gained = {
      log: `${formatChampionName(owner)} gained 1 Impulse stack. Current stacks: ${owner.runtime.impulseStacks}`,
    };

    if (owner.runtime.impulseStacks < this.stackCap) return gained;

    const allies = context.aliveChampions.filter((c) => c.team === owner.team);

    const fastestAlly = allies.reduce((a, b) => (a.Speed > b.Speed ? a : b));

    const damageAmount = Math.floor(
      fastestAlly.Speed * this.speedPercentAsDamage,
    );

    const enemies = context.aliveChampions.filter(
      (c) => c.team !== owner.team,
    );

    if (!enemies.length) return gained;

    const lowestHealthEnemy = enemies.reduce((a, b) => {
      if (a.HP < b.HP) return a;
      if (b.HP < a.HP) return b;

      // Tie → random
      return Math.random() < 0.5 ? a : b;
    }, enemies[0]);

    context.registerDialog({
      message: `${formatChampionName(owner)} unleashed a burst of speed, consuming all Impulse against ${formatChampionName(lowestHealthEnemy)}!`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    const damageEvent = SkillHits.run(this, "explosion", {
      user: owner,
      target: lowestHealthEnemy,
      baseDamage: damageAmount,
      context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
    });

    owner.runtime.impulseStacks = 0;

    return {
      damageEvent,
      log: `${formatChampionName(owner)} unleashed a burst of speed, consuming all Impulse against ${formatChampionName(lowestHealthEnemy)}!`,
    };
  },
};
