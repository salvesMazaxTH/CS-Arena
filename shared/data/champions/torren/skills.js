import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import totalBlock from "../generic/totalBlock.js";

const SCORNFUL_DOMINION_HOOK_KEY = "scornful_dominion_hook";

const torrenSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Skills
  // ========================

  {
    key: "resounding_sword",
    name: "Resounding Sword",
    bf: 50,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `Torren swings his sword with crushing force, the resounding blow striking the chosen enemy while <b>Stunning</b> another enemy at random.`,
        pt: `Torren golpeia com força esmagadora — o impacto ressoante atinge o inimigo escolhido enquanto <b>Atordoa</b> outro inimigo aleatório.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const damageEvent = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (!damageEvent?.landed || !(damageEvent?.totalDamage > 0)) {
        return damageEvent;
      }

      const otherEnemies = context?.allChampions
        ? Array.from(context.allChampions.values()).filter(
            (champion) =>
              champion.team !== user.team &&
              champion.id !== enemy.id &&
              champion.alive,
          )
        : [];

      if (!otherEnemies.length) return damageEvent;

      const randomEnemy =
        otherEnemies[Math.floor(Math.random() * otherEnemies.length)];

      randomEnemy.applyStatusEffect("stunned", 1, context, {
        source: {
          type: "skill",
          skill: this,
          champion: user,
        },
      });

      return damageEvent;
    },
  },

  {
    key: "scorn_the_weak",
    name: "Scorn the Weak",
    bf: 40,
    contact: true,
    damageMode: "piercing",
    piercingPercentage: 100,
    thresholdMultiplier: 1.35,
    priority: 2,
    tauntDuration: 2,
    dominionDuration: 3,
    claimBonusPoints: 2,

    description() {
      return {
        en: `Torren singles out the most fragile enemy on the field, striking through their defenses with a <b>Piercing</b> blow. If their fragility is significantly greater than his own, they are <b>Taunted</b> for <b>${this.tauntDuration}</b> turn(s) and deal <b>30%</b> less damage to anyone else.

        For the next <b>${this.dominionDuration}</b> turns, any <b>CLAIM</b> Torren makes while that <b>Taunted</b> foe still stands banks <b>${this.claimBonusPoints}</b> extra point(s).`,
        pt: `Torren escolhe o inimigo mais frágil do campo, atingindo-o com um golpe <b>Perfurante</b> que atravessa suas defesas. Se a fragilidade desse alvo for consideravelmente maior que a dele, o inimigo fica <b>Provocado</b> por <b>${this.tauntDuration}</b> turno(s) e passa a causar <b>30%</b> a menos de dano a qualquer outro alvo.

        Pelos próximos <b>${this.dominionDuration}</b> turnos, todo <b>CLAIM</b> que Torren fizer enquanto esse inimigo <b>Provocado</b> ainda estiver de pé garante <b>${this.claimBonusPoints}</b> ponto(s) extra(s).`,
      };
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const torrenScore = user.Attack / Math.max(1, user.HP + user.Defense);

      const scoredTargets = targets.map((t) => {
        const score = t.Attack / Math.max(1, t.HP + t.Defense);
        return { t, score };
      });

      // Always picks the most fragile, even if the threshold isn't met.
      const best = scoredTargets.reduce((best, curr) => {
        return !best || curr.score > best.score ? curr : best;
      }, null);

      if (!best) return null;

      const target = best.t;
      const targetScore = best.score;

      const damageEvent = new DamageEvent({
        baseDamage,
        mode: this.damageMode,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: target,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // The scornful aura opens on every cast; the bonus only pays out on a
      // CLAIM made while a Torren-taunt is still holding a foe.
      user.runtime ??= {};
      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (he) => he.key !== SCORNFUL_DOMINION_HOOK_KEY,
      );

      const claimBonusPoints = this.claimBonusPoints;

      user.addHookEffect(
        {
          type: "buff",
          key: SCORNFUL_DOMINION_HOOK_KEY,
          group: "skill",
          expiresAtTurn: context.currentTurn + this.dominionDuration,
          hookScope: {
            onActionResolved: "actionSource",
          },

          onActionResolved({ owner, skill, context }) {
            if (skill?.key !== CLAIM_ACTION_KEY) return;

            const holdsTaunt = context.aliveChampions.some(
              (champ) =>
                champ.team !== owner.team &&
                champ.tauntEffects?.some(
                  (taunt) =>
                    taunt.taunterId === owner.id &&
                    taunt.expiresAtTurn > context.currentTurn,
                ),
            );

            if (!holdsTaunt) return;

            return {
              type: "score",
              amount: claimBonusPoints,
              scoringSlot: owner.team - 1,
              log: `${formatChampionName(owner)} claims the ground with a scorned foe pinned to him — <b>Scorn the Weak</b> banks ${claimBonusPoints} extra point(s).`,
            };
          },
        },
        context,
      );

      const connected =
        damageEvent?.landed && damageEvent?.totalDamage > 0;

      // Actual weakness condition.
      const isWeakEnough =
        targetScore >= torrenScore * this.thresholdMultiplier;

      let tauntLog = null;

      if (connected && isWeakEnough) {
        tauntLog = target.applyTaunt(user.id, this.tauntDuration, context);

        target.damageModifiers = target.damageModifiers.filter(
          (mod) => mod.id !== "scorned",
        );

        target.addDamageModifier({
          id: "scorned",
          expiresAtTurn: context.currentTurn + this.tauntDuration,

          apply: ({ baseDamage, defender }) => {
            if (defender !== user) {
              return baseDamage * 0.7;
            }

            return baseDamage;
          },
        });
      }

      return tauntLog ? [damageEvent, tauntLog] : damageEvent;
    },
  },

  {
    key: "juggernaut",
    name: "Juggernaut",
    bf: 115,
    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    stunDuration: 2,
    priority: 0,

    description() {
      return {
        en: `Torren advances with unstoppable force, crushing the chosen enemy beneath a devastating blow and <b>Stunning</b> them for <b>${this.stunDuration}</b> turn(s).`,
        pt: `Torren avança com força implacável, esmagando o inimigo escolhido sob um golpe devastador e o deixando <b>Atordoado</b> por <b>${this.stunDuration}</b> turno(s).`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const damageEvent = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (effectConnected(damageEvent, "stunned")) {
        enemy.applyStatusEffect("stunned", this.stunDuration, context, {
          sourceId: user.id,
        });
      }

      return damageEvent;
    },
  },
];

export default torrenSkills;