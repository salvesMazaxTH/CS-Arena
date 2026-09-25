import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "the_hour_is_kept",
  name: "The Hour Is Kept",

  radiancePerPoint: 15,
  killScore: 1,

  hits: [
    {
      id: "radiance",
      type: "magical",
      contact: false,
      damageMode: "standard",
      hitVfx: "radiant_bolt",
    },
  ],

  description() {
    return {
      en: `Seymour read the appointed hour in the orrery long ago, and the sky keeps its word. The first <b>CLAIM</b> resolved on the field each turn, by either side, makes his star answer over the enemy line for <b>${this.radiancePerPoint}</b> radiant damage per point that <b>CLAIM</b> was worth. If the light puts one of them down, his team takes <b>${this.killScore}</b> point. The sky answers only once a turn, however the hour is called.`,
      pt: `Há muito tempo, Seymour decifrou a hora certa no mecanismo das estrelas, e o céu cumpre a palavra dada. O primeiro <b>CLAIM</b> resolvido em campo a cada turno, não importa de qual lado, faz sua estrela responder sobre a linha inimiga, causando <b>${this.radiancePerPoint}</b> de dano radiante para cada ponto que aquele <b>CLAIM</b> valia. Se a luz derrubar algum inimigo, o time de Seymour ganha <b>${this.killScore}</b> ponto. Por mais vezes que a hora seja chamada, o céu só responde uma vez por turno.`,
    };
  },

  // No hookScope for onActionResolved: it must see every CLAIM on the field,
  // both teams', not only Seymour's own.
  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive) return;

    const points = Number(context?.preActionClaimPoints) || 0;
    if (points <= 0) return;
    if (owner.runtime.lastRadianceTurn === context.currentTurn) return;

    owner.runtime.lastRadianceTurn = context.currentTurn;

    const enemies = context.aliveChampions.filter(
      (c) => c.alive && c.team !== owner.team,
    );
    if (!enemies.length) return;

    const baseDamage = points * this.radiancePerPoint;
    const results = [];
    let felled = false;

    for (const enemy of enemies) {
      const hit = SkillHits.run(this, "radiance", {
        user: owner,
        target: enemy,
        baseDamage,
        context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
      });
      const arr = Array.isArray(hit) ? hit : [hit];
      results.push(...arr);
      if (arr.some((r) => r?.killed)) felled = true;
    }

    context.registerDialog({
      message: `<b>[Passive — ${this.name}]</b> the hour is kept — ${formatChampionName(owner)}'s star burns over the enemy line.`,
      sourceId: owner.id,
    });

    if (felled) {
      context.registerScore({
        amount: this.killScore,
        scoringSlot: owner.team - 1,
        reason: this.key,
        sourceId: owner.id,
      });
    }

    return { logs: results.flatMap((r) => (r?.log ? [r.log] : [])) };
  },
};
