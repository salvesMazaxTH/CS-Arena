// Smoke test for the medium AI: every draftable champion plans a turn on a
// real arena, and every plan must be one the server would accept.
//   node scripts/botSmoke.js [rounds]
import { GameMatch } from "../shared/engine/match/GameMatch.js";
import { TargetFilter } from "../shared/engine/combat/targetFilter.js";
import { CLAIM_ACTION_KEY } from "../shared/engine/combat/claim.js";
import { championDB } from "../shared/data/championDB.js";
import { isChampionDraftable } from "../shared/data/draftEligibility.js";
import { planTurn, chooseFirstChampion } from "../src/ai/mediumBot.js";

const ROUNDS = Number(process.argv[2]) || 3;
const editMode = {};
const draftable = Object.keys(championDB).filter((key) =>
  isChampionDraftable(championDB[key], editMode),
);

const pick = (pool, n, exclude = []) =>
  pool
    .filter((key) => !exclude.includes(key))
    .sort(() => Math.random() - 0.5)
    .slice(0, n);

const failures = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);

function runCase(focusKey, round) {
  const match = new GameMatch();
  match.combat.currentTurn = 2 + round * 3;

  const allyKeys = [focusKey, ...pick(draftable, 2, [focusKey])];
  const enemyKeys = pick(draftable, 3);
  const spawnTeam = (keys, team) =>
    keys.map((championKey, combatSlot) =>
      match.combat.spawnChampion({ championKey, team, combatSlot, spawnProtection: false }),
    );
  const allies = spawnTeam(allyKeys, 1);
  const enemies = spawnTeam(enemyKeys, 2);

  // Vary the board: wounded champions and, on later rounds, full momentum.
  for (const champion of [...allies, ...enemies]) {
    champion.HP = Math.max(1, Math.round(champion.maxHP * (0.25 + Math.random() * 0.75)));
    if (round > 0) champion.momentum = 99;
  }

  const champions = Array.from(match.combat.activeChampions.values());
  const perceivedById = new Map(champions.map((c) => [c.id, c.serialize()]));
  const where = `${focusKey} (round ${round})`;

  let plan;
  try {
    plan = planTurn({
      champions,
      perceivedById,
      team: 1,
      currentTurn: match.combat.currentTurn,
      scores: [0, 0],
      summonableKeys: pick(draftable, 2, allyKeys),
      championDB,
      players: match.players,
      editMode,
    });
  } catch (err) {
    fail(where, `planTurn threw ${err.stack}`);
    return;
  }

  const seenUsers = new Set();
  for (const action of plan.actions) {
    const user = match.combat.activeChampions.get(action.userId);
    if (!user || user.team !== 1) {
      fail(where, `action for a non-ally user ${action.userId}`);
      continue;
    }
    if (seenUsers.has(user.id)) fail(where, `${user.championKey} acts twice`);
    seenUsers.add(user.id);

    if (action.skillKey === CLAIM_ACTION_KEY) continue;
    const skill = user.skills.find((s) => s.key === action.skillKey);
    if (!skill) {
      fail(where, `${user.championKey} uses unknown skill ${action.skillKey}`);
      continue;
    }
    if (skill.isUltimate && user.momentum < user.getSkillCost(skill)) {
      fail(where, `${user.championKey} casts ${skill.key} without momentum`);
    }

    // targetIds is { role: id }, the same shape the client sends.
    for (const [role, targetId] of Object.entries(action.targetIds ?? {})) {
      const target = match.combat.activeChampions.get(targetId);
      if (role === "self") {
        if (target !== user) fail(where, `${skill.key} self role points at another champion`);
        continue;
      }
      const spec = TargetFilter.specForRole(skill.targetSpec ?? [], role);
      const accepted = target && spec && TargetFilter.accepts(spec, user, target);
      if (!accepted) fail(where, `${skill.key} ${role} → invalid ${target?.championKey ?? targetId}`);
    }
  }
}

for (const key of draftable) {
  for (let round = 0; round < ROUNDS; round += 1) runCase(key, round);
}

const roster = pick(draftable, 6);
if (!roster.includes(chooseFirstChampion(roster, championDB))) {
  fail("chooseFirstChampion", "picked a champion outside the roster");
}

console.log(`${draftable.length} champions × ${ROUNDS} rounds planned.`);
if (failures.length) {
  console.log(`${failures.length} failure(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("All plans valid.");
