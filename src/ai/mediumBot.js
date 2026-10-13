// Medium-difficulty AI opponent. Pure decision logic, no I/O: the server feeds
// it the board as the bot's side sees it and enqueues whatever it returns
// through the same functions a human's socket goes through.
//
// It reads the board the way a player does — HP bars, classes, momentum, the
// skill strength printed on the card — and never simulates the engine or runs
// a damage formula. It plays the best-looking option and only gambles between
// options that look about as good (close calls). It does not predict the Speed
// order, coordinate combos between allies or plan beyond the current turn.

import { TargetFilter } from "../../shared/engine/combat/targetFilter.js";
import { SpawnProtection } from "../../shared/engine/combat/spawnProtection.js";
import { emitCombatEvent } from "../../shared/engine/combat/combatEvents.js";
import { CLAIM_ACTION_KEY, getClaimPoints } from "../../shared/engine/combat/claim.js";
import { getHardCCActionDenial } from "../../shared/core/championStatus.js";
import { getChampionClassKeys } from "../../shared/data/championClasses.js";
import { StatusEffectsRegistry } from "../../shared/data/statusEffects/effectsRegistry.js";
import {
  STAR_CHECKPOINT_TURNS,
  STAR_SCORE_THRESHOLD,
} from "../../shared/engine/match/matchRules.js";

export const BOT_TUNING = {
  username: "AI Opponent",
  firstChoiceDelayMs: 1000,
  thinkDelayMs: 1500,

  // Options scoring within this fraction of the best one are a close call and
  // drawn at random; anything below is never played.
  closeCallMargin: 0.12,

  // Skill strength read off the card when it prints no bf.
  defaultSkillStrength: 60,
  aoeTargetFactor: 0.75,
  secondaryEffectBonus: 0.12,

  ultimate: {
    multiplier: 1.5,
    // A single-target damaging ultimate waits for a target at least this juicy...
    minTargetWeight: 1.1,
    // ...unless momentum is this close to full, where holding it wastes gain.
    spendWhenWithinOfMax: 10,
    minSupportScore: 60,
  },

  target: {
    lowHpWeight: 0.6,
    finishHpPct: 0.3,
    finishBonus: 0.5,
    squishyBonus: 0.2,
    tankPenalty: 0.3,
    minionPenalty: 0.3,
    threatWeight: 0.4,
    ultReadyBonus: 0.25,
    shieldPenalty: 0.25,
    immunityFactor: 0.15,
    minWeight: 0.1,
  },

  heal: { base: 130, minMissingPct: 0.15 },
  shield: { base: 35, missingHpWeight: 60, threatBonus: 15 },
  buff: { base: 40, damageDealerBonus: 10, lowHpPenalty: 20 },
  debuff: { base: 40, ccBonus: 15, ultReadyBonus: 20 },
  unknown: { base: 35 },

  totalBlock: {
    base: 8,
    lowHpPct: 0.35,
    lowHpValue: 55,
    perMissingPct: 100,
    enemyUltReadyBonus: 20,
    repeatFactor: 0.5,
  },

  claim: {
    base: 10,
    perPoint: 7,
    checkpointBonus: 35,
    preCheckpointBonus: 10,
    thresholdBonus: 60,
    comfortableLead: 15,
    dyingHpPct: 0.25,
    dyingFactor: 0.5,
  },

  summon: {
    roleWeight: 2,
    matchupWeight: 1,
    hurtTeamHpPct: 0.55,
    swarmSize: 3,
  },

  firstChoice: { frontlineBonus: 100 },
};

const SQUISHY_CLASSES = ["assassin", "mage", "marksman", "enchanter"];
const DAMAGE_CLASSES = ["assassin", "mage", "marksman", "brawler"];
const FRONTLINE_CLASSES = ["tank", "brawler"];

const KEYWORDS = {
  heal: /\bheal|\brestores?\b|\brecovers?\b/,
  shield: /\bshield/,
  cc: /\bstun|\bparaly|\bfroz|\bfreez|\broot|\bsnare|\bsilenc|\btaunt|\bsleep|\bfear/,
  debuff: /\breduc|\bdecreas|\bweaken|\bbleed|\bburn|\bpoison|\bblind|\bchill|\bheal block/,
  buff: /\bgains?\b|\bincreas|\bempower|\bimmun|\bprotect/,
};

// ============================================================
//  PUBLIC API
// ============================================================

/** The first champion to send into the 1v1: a frontliner, else the sturdiest. */
export function chooseFirstChampion(roster, championDB) {
  const scored = roster
    .filter((key) => championDB[key])
    .map((key) => {
      const data = championDB[key];
      const frontline = getChampionClassKeys(data).some((c) =>
        FRONTLINE_CLASSES.includes(c),
      );
      const sturdiness = (data.HP ?? 0) + (data.Defense ?? 0) * 2;
      return {
        key,
        score: sturdiness + (frontline ? BOT_TUNING.firstChoice.frontlineBonus : 0),
      };
    });

  if (!scored.length) return roster[0];
  return pickCloseCall(scored)?.key ?? roster[0];
}

/**
 * Decides one planning window.
 *
 * @param {object}   args
 * @param {object[]} args.champions      Every champion the bot can see (concealed enemy summons left out).
 * @param {Map}      args.perceivedById  Serialized champions as the bot's side sees them (disguises applied).
 * @param {number}   args.team           The bot's team.
 * @param {number}   args.currentTurn
 * @param {number[]} args.scores         match.combat.playerScores, indexed by slot.
 * @param {string[]} args.summonableKeys Reserve champions the server would accept as a summon now.
 * @param {object}   args.championDB
 * @param {object[]} args.players        match.players, for the onValidateActionIntent hooks.
 * @param {object}   args.editMode
 * @returns {{ summonKey: string|null, actions: {userId, skillKey, targetIds}[] }}
 */
export function planTurn(args) {
  const board = buildBoard(args);

  let summonKey = null;
  try {
    summonKey = chooseSummon(board, args.summonableKeys ?? [], args.championDB);
  } catch (err) {
    console.error("[bot] summon choice failed:", err);
  }

  const actions = [];
  for (const user of board.allies) {
    if (!canAct(user)) continue;

    try {
      const option = pickCloseCall(listOptions(user, board, args));
      if (option) actions.push(option.action);
    } catch (err) {
      console.error(`[bot] ${user.championKey} planning failed, falling back to CLAIM:`, err);
      actions.push(claimAction(user));
    }
  }

  return { summonKey, actions };
}

// ============================================================
//  BOARD
// ============================================================

function buildBoard({ champions, perceivedById, team, currentTurn, scores, editMode }) {
  const alive = champions.filter((c) => c.alive);
  const view = (c) => perceivedById?.get(c.id) ?? c;

  const allies = alive.filter((c) => c.team === team);
  const enemies = alive.filter((c) => c.team !== team);
  const enemyAttacks = enemies.map((c) => view(c).Attack ?? 0);
  const avgEnemyAttack =
    enemyAttacks.reduce((sum, a) => sum + a, 0) / Math.max(1, enemyAttacks.length);

  const mySlot = team - 1;
  const myScore = scores?.[mySlot] ?? 0;
  const opponentScore = scores?.[1 - mySlot] ?? 0;

  return {
    team,
    currentTurn,
    editMode: editMode ?? {},
    champions: alive,
    allies,
    enemies,
    view,
    avgEnemyAttack,
    myScore,
    opponentScore,
    enemyUltReady: enemies.some((c) => ultimateReady(c, view(c))),
  };
}

function canAct(user) {
  return user.alive && !SpawnProtection.isActive(user) && !getHardCCActionDenial(user);
}

function hpPct(c) {
  return c.maxHP > 0 ? Math.max(0, c.HP) / c.maxHP : 0;
}

function hasClass(c, classes) {
  return getChampionClassKeys(c).some((k) => classes.includes(k));
}

/** Whether a champion's ultimate is affordable — momentum and the card's cost are both on screen. */
function ultimateReady(champion, seen = champion) {
  const ult = champion.skills?.find((s) => s.isUltimate);
  if (!ult) return false;
  const cost = champion.getSkillCost?.(ult) ?? 0;
  return cost > 0 && (seen.momentum ?? 0) >= cost;
}

function hasShield(seen) {
  const shields = seen.runtime?.shields;
  return Array.isArray(shields) && shields.some((s) => (s?.amount ?? 0) > 0);
}

function statusKeys(seen) {
  const effects = seen.statusEffects;
  if (effects instanceof Map) return [...effects.keys()];
  if (Array.isArray(effects)) return effects.map((e) => (Array.isArray(e) ? e[0] : e?.key));
  return [];
}

function hasImmunity(seen) {
  return statusKeys(seen).some((key) =>
    StatusEffectsRegistry[key]?.subtypes?.includes("immunity"),
  );
}

// ============================================================
//  SKILL READING
// ============================================================

function readDescription(skill, user) {
  try {
    const d = typeof skill.description === "function"
      ? skill.description.call(skill, user)
      : skill.description;
    const text = typeof d === "string" ? d : d?.en ?? "";
    return text.replace(/<[^>]*>/g, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeSpec(skill) {
  return (skill.targetSpec ?? []).map((s) => (typeof s === "string" ? { type: s } : s));
}

/** What a skill does, as a player reads it off the card. */
function classifySkill(skill, user) {
  const text = readDescription(skill, user);
  const specs = normalizeSpec(skill);
  const sides = specs.map((s) => TargetFilter.sideOf(s));

  return {
    damages: !!skill.damageMode,
    strength: Number.isFinite(skill.bf) ? skill.bf : BOT_TUNING.defaultSkillStrength,
    heal: KEYWORDS.heal.test(text),
    shield: KEYWORDS.shield.test(text),
    cc: KEYWORDS.cc.test(text),
    debuff: KEYWORDS.debuff.test(text),
    buff: KEYWORDS.buff.test(text),
    offensive: sides.includes("enemy") || sides.includes("any") || sides.includes("all"),
    supportive: sides.includes("ally") || sides.includes("self"),
    global: specs.some((s) => s.type.startsWith("all")),
    specs,
  };
}

// ============================================================
//  TARGETING (mirrors public/js/ui/targeting.js)
// ============================================================

function activeTaunterId(user, currentTurn, skill) {
  if (skill.ignoresTaunt) return null;
  return user.tauntEffects?.find((e) => e.expiresAtTurn > currentTurn)?.taunterId ?? null;
}

const byFieldOrder = (list) =>
  [...list].sort((a, b) => (a.combatSlot ?? 0) - (b.combatSlot ?? 0));

/**
 * Every way the bot would fill a skill's targets: one variant per candidate of
 * the first player-chosen role, the remaining roles filled greedily with the
 * best-scoring candidate. Returns [] when the skill has no legal target.
 */
function targetVariants(user, skill, kind, board, scoreTarget) {
  const specs = kind.specs;
  if (!specs.length) return [];
  if (kind.global) return [{ targetIds: {}, chosen: [] }];

  const taunterId = activeTaunterId(user, board.currentTurn, skill);

  // Candidates per role, in declaration order.
  const roles = [];
  let enemyIndex = 0;
  for (const spec of specs) {
    if (spec.type === "self") {
      roles.push({ key: "self", fixed: user, spec });
    } else if (spec.type === "ally") {
      roles.push({ key: "ally", automatic: true, spec });
    } else if (spec.type === "select:ally" || spec.type === "select:any") {
      roles.push({ key: spec.type === "select:ally" ? "ally" : "any", spec });
    } else if (spec.type === "enemy") {
      enemyIndex++;
      roles.push({ key: enemyIndex === 1 ? "enemy" : `enemy${enemyIndex}`, spec, enemy: true });
    }
  }

  const candidatesFor = (role, chosenIds) => {
    const unique = role.spec.unique === true;
    const notChosen = (list) => (unique ? list.filter((c) => !chosenIds.has(c.id)) : list);

    if (role.automatic) {
      return byFieldOrder(
        notChosen(board.champions.filter((c) => c.team === user.team && c.id !== user.id)),
      ).slice(0, 1);
    }

    let list = byFieldOrder(notChosen(TargetFilter.candidates(role.spec, user, board.champions)));
    if (role.enemy && !unique) {
      const taunter = list.find((c) => c.id === taunterId);
      if (taunter) list = [taunter];
    }
    return list;
  };

  const fill = (firstPick) => {
    const targetIds = {};
    const chosen = [];
    const chosenIds = new Set();
    let first = true;

    for (const role of roles) {
      let pick;
      if (role.fixed) {
        pick = role.fixed;
      } else {
        const list = candidatesFor(role, chosenIds);
        if (!list.length) continue; // skipped slot, like the client
        pick = first && firstPick && list.includes(firstPick)
          ? firstPick
          : maxBy(list, (c) => scoreTarget(c, role));
        if (!role.automatic) first = false;
      }
      targetIds[role.key] = pick.id;
      chosen.push({ champion: pick, role });
      chosenIds.add(pick.id);
    }

    return Object.keys(targetIds).length ? { targetIds, chosen } : null;
  };

  const firstSelectable = roles.find((r) => !r.fixed && !r.automatic);
  if (!firstSelectable) {
    const only = fill(null);
    return only ? [only] : [];
  }

  return candidatesFor(firstSelectable, new Set())
    .map((pick) => fill(pick))
    .filter(Boolean);
}

// ============================================================
//  SCORING
// ============================================================

/** How much the bot wants to hit an enemy, read off what is on screen. */
function enemyWeight(enemy, board) {
  const t = BOT_TUNING.target;
  const seen = board.view(enemy);
  const pct = hpPct(seen);
  let w = 1 + (1 - pct) * t.lowHpWeight;

  if (pct <= t.finishHpPct) w += t.finishBonus;
  if (hasClass(seen, SQUISHY_CLASSES)) w += t.squishyBonus;
  if (hasClass(seen, ["tank"])) w -= t.tankPenalty;
  if ((seen.entityType ?? "champion") === "minion") w -= t.minionPenalty;

  if (board.avgEnemyAttack > 0) {
    const threat = (seen.Attack ?? 0) / board.avgEnemyAttack - 1;
    w += Math.max(-0.2, Math.min(0.4, threat * t.threatWeight));
  }
  if (ultimateReady(enemy, seen)) w += t.ultReadyBonus;
  if (hasShield(seen)) w -= t.shieldPenalty;
  if (hasImmunity(seen)) w *= t.immunityFactor;

  return Math.max(t.minWeight, w);
}

function allyMissing(ally) {
  return 1 - hpPct(ally);
}

function supportValue(target, kind, board) {
  if (kind.heal) {
    const missing = allyMissing(target);
    return missing < BOT_TUNING.heal.minMissingPct ? 0 : BOT_TUNING.heal.base * missing;
  }
  if (kind.shield) {
    const s = BOT_TUNING.shield;
    return s.base + s.missingHpWeight * allyMissing(target) + (board.enemyUltReady ? s.threatBonus : 0);
  }
  const b = BOT_TUNING.buff;
  let value = b.base;
  if (hasClass(target, DAMAGE_CLASSES)) value += b.damageDealerBonus;
  if (hpPct(target) < 0.3) value -= b.lowHpPenalty;
  return value;
}

function hostileUtilityValue(enemy, kind, board) {
  const d = BOT_TUNING.debuff;
  let value = d.base * enemyWeight(enemy, board);
  if (kind.cc) value += d.ccBonus;
  if (ultimateReady(enemy, board.view(enemy))) value += d.ultReadyBonus;
  return value;
}

/** How good a filled target set is for this skill. */
function scoreVariant(variant, kind, user, board) {
  // Global skills hit everything on their side.
  if (kind.global) {
    let score = 0;
    const touchesEnemies = kind.specs.some((s) => s.type === "all:enemy" || s.type === "all");
    const touchesAllies = kind.specs.some((s) => s.type === "all:ally" || s.type === "all");

    if (touchesEnemies) {
      for (const e of board.enemies) {
        if (!TargetFilter.accepts({ type: "enemy" }, user, e)) continue;
        score += kind.damages
          ? kind.strength * enemyWeight(e, board) * BOT_TUNING.aoeTargetFactor
          : hostileUtilityValue(e, kind, board) * BOT_TUNING.aoeTargetFactor;
      }
    }
    if (touchesAllies && !kind.damages) {
      for (const a of board.allies) score += supportValue(a, kind, board) * BOT_TUNING.aoeTargetFactor;
    }
    return score;
  }

  let score = 0;
  for (const { champion, role } of variant.chosen) {
    const isEnemy = champion.team !== user.team;
    if (isEnemy) {
      score += kind.damages
        ? kind.strength * enemyWeight(champion, board)
        : hostileUtilityValue(champion, kind, board);
    } else if (role.key !== "self" || !kind.damages) {
      score += kind.damages ? 0 : supportValue(champion, kind, board);
    }
  }
  return score;
}

function targetScorer(kind, user, board) {
  return (candidate) =>
    candidate.team !== user.team
      ? (kind.damages ? kind.strength : BOT_TUNING.debuff.base) * enemyWeight(candidate, board)
      : supportValue(candidate, kind, board);
}

// ============================================================
//  OPTIONS
// ============================================================

function claimAction(user) {
  return { userId: user.id, skillKey: CLAIM_ACTION_KEY, targetIds: {} };
}

function intentAllowed(user, skill, players) {
  const results = emitCombatEvent(
    "onValidateActionIntent",
    { actionSource: user, skill },
    [user],
    { players },
  );
  return !results.some((r) => r?.deny);
}

function listOptions(user, board, args) {
  const options = [];

  if (intentAllowed(user, null, args.players)) {
    options.push({ score: claimScore(user, board, args), action: claimAction(user) });
  }

  for (const skill of user.skills ?? []) {
    if (skill.isUltimate) {
      const cost = user.getSkillCost(skill);
      if (!board.editMode.freeCostSkills && user.momentum < cost) continue;
    }
    if (!intentAllowed(user, skill, args.players)) continue;

    if (skill.key === "total_block") {
      options.push({
        score: totalBlockScore(user, board),
        action: { userId: user.id, skillKey: skill.key, targetIds: { self: user.id } },
      });
      continue;
    }

    const kind = classifySkill(skill, user);
    const variants = targetVariants(user, skill, kind, board, targetScorer(kind, user, board));

    for (const variant of variants) {
      let score = scoreVariant(variant, kind, user, board);

      // A damaging skill that also cripples or protects reads stronger.
      if (kind.damages && (kind.cc || kind.debuff || kind.heal || kind.shield)) {
        score *= 1 + BOT_TUNING.secondaryEffectBonus;
      }
      if (!kind.damages && !kind.heal && !kind.shield && !kind.buff && !kind.debuff && !kind.cc) {
        score = Math.max(score, BOT_TUNING.unknown.base);
      }

      if (skill.isUltimate) {
        if (shouldHoldUltimate(user, kind, variant, score, board)) continue;
        score *= BOT_TUNING.ultimate.multiplier;
      }

      if (score > 0) {
        options.push({
          score,
          action: { userId: user.id, skillKey: skill.key, targetIds: variant.targetIds },
        });
      }
    }
  }

  return options;
}

function shouldHoldUltimate(user, kind, variant, score, board) {
  const u = BOT_TUNING.ultimate;
  if (board.editMode.freeCostSkills) return false;
  if ((user.momentumMax ?? Infinity) - user.momentum <= u.spendWhenWithinOfMax) return false;

  if (kind.damages && !kind.global) {
    const best = Math.max(
      0,
      ...variant.chosen
        .filter(({ champion }) => champion.team !== user.team)
        .map(({ champion }) => enemyWeight(champion, board)),
    );
    return best < u.minTargetWeight;
  }
  if (!kind.damages) return score < u.minSupportScore;
  return false;
}

function totalBlockScore(user, board) {
  const tb = BOT_TUNING.totalBlock;
  const pct = hpPct(user);
  let score = tb.base;

  if (pct < tb.lowHpPct) score += tb.lowHpValue + (tb.lowHpPct - pct) * tb.perMissingPct;
  if (board.enemyUltReady && pct < 0.6) score += tb.enemyUltReadyBonus;

  // Chaining it halves the odds each time; the player sees the last use.
  if (user.runtime?.lastTotalBlockTurn === board.currentTurn - 1) {
    const streak = (user.runtime.totalBlockStreak ?? 0) + 1;
    score *= Math.pow(tb.repeatFactor, streak);
  }
  return score;
}

function claimScore(user, board, args) {
  const c = BOT_TUNING.claim;
  const points = getClaimPoints(user, board.currentTurn);
  let score = c.base + points * c.perPoint;

  const checkpointNow =
    board.editMode.everyTurnIsCheckpoint || STAR_CHECKPOINT_TURNS.includes(board.currentTurn);
  const checkpointNext = STAR_CHECKPOINT_TURNS.includes(board.currentTurn + 1);
  const lead = board.myScore - board.opponentScore;

  if (checkpointNow && lead < c.comfortableLead) score += c.checkpointBonus;
  else if (checkpointNext && lead < c.comfortableLead) score += c.preCheckpointBonus;

  const crossesThreshold =
    board.myScore < STAR_SCORE_THRESHOLD && board.myScore + points >= STAR_SCORE_THRESHOLD;
  if (crossesThreshold && board.opponentScore < STAR_SCORE_THRESHOLD) score += c.thresholdBonus;

  if (hpPct(user) < c.dyingHpPct) score *= c.dyingFactor;
  return score;
}

// ============================================================
//  SUMMON (role first, matchup breaks ties)
// ============================================================

function chooseSummon(board, summonableKeys, championDB) {
  if (!summonableKeys.length) return null;
  const s = BOT_TUNING.summon;

  const hasFrontline = board.allies.some((c) => hasClass(c, FRONTLINE_CLASSES));
  const avgAllyHp =
    board.allies.reduce((sum, c) => sum + hpPct(c), 0) / Math.max(1, board.allies.length);

  let neededRole;
  if (!hasFrontline) neededRole = FRONTLINE_CLASSES;
  else if (board.allies.length && avgAllyHp < s.hurtTeamHpPct) neededRole = ["enchanter"];
  else neededRole = ["assassin", "mage", "marksman"];

  const enemiesSeen = board.enemies.map((c) => board.view(c));
  const enemyTanks = enemiesSeen.filter((c) => hasClass(c, ["tank"])).length;
  const enemySquishies = enemiesSeen.filter((c) => hasClass(c, SQUISHY_CLASSES)).length;
  const enemiesHurt =
    enemiesSeen.length > 0 &&
    enemiesSeen.reduce((sum, c) => sum + hpPct(c), 0) / enemiesSeen.length < 0.5;

  const scored = summonableKeys.map((key) => {
    const data = championDB[key] ?? {};
    const classes = getChampionClassKeys(data);
    let score = classes.some((c) => neededRole.includes(c)) ? s.roleWeight : 0;

    let matchup = 0;
    if (classes.includes("assassin") && (enemiesHurt || enemySquishies > enemyTanks)) matchup++;
    if (classes.includes("mage") && enemyTanks > 0) matchup++;
    if (
      enemiesSeen.length >= s.swarmSize &&
      (data.skills ?? []).some((sk) => sk.damageMode && normalizeSpec(sk).some((sp) => sp.type === "all:enemy"))
    ) {
      matchup++;
    }
    score += Math.min(1, matchup) * s.matchupWeight;

    return { key, score };
  });

  const best = Math.max(...scored.map((o) => o.score));
  const tied = scored.filter((o) => o.score === best);
  return tied[Math.floor(Math.random() * tied.length)].key;
}

// ============================================================
//  HELPERS
// ============================================================

function maxBy(list, fn) {
  let best = list[0];
  let bestValue = -Infinity;
  for (const item of list) {
    const value = fn(item);
    if (value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

/** The best option, or a random one among those within the close-call margin of it. */
function pickCloseCall(options) {
  if (!options.length) return null;
  const best = Math.max(...options.map((o) => o.score));
  const floor = best - Math.abs(best) * BOT_TUNING.closeCallMargin;
  const pool = options.filter((o) => o.score >= floor);
  return pool[Math.floor(Math.random() * pool.length)];
}
