import { DamageEvent } from "../shared/engine/combat/DamageEvent.js";
import { TurnResolver } from "../shared/engine/combat/TurnResolver.js";
import { GameMatch } from "../shared/engine/match/GameMatch.js";
import { championDB } from "../shared/data/championDB.js";
import { SUPPORTED_LOCALES, resolveText } from "../shared/i18n/locale.js";

const CRIT_MODES = ["auto", "force", "disable"];

function parseValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber) && raw.trim() !== "") return asNumber;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseAssignment(raw) {
  const eqIndex = raw.indexOf("=");
  if (eqIndex <= 0) {
    throw new Error(
      `Invalid assignment '${raw}'. Use format path=value (ex: runtime.foo=3).`,
    );
  }

  const path = raw.slice(0, eqIndex).trim();
  const value = parseValue(raw.slice(eqIndex + 1).trim());

  if (!path) {
    throw new Error(`Invalid assignment '${raw}': path cannot be empty.`);
  }

  return { path, value };
}

function setPath(target, path, value) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) throw new Error(`Invalid path '${path}'.`);

  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
}

function getPath(target, path) {
  const parts = path.split(".").filter(Boolean);
  let cursor = target;

  for (const key of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[key];
  }

  return cursor;
}

function applyAssignments(target, assignments) {
  for (const assignment of assignments) {
    setPath(target, assignment.path, assignment.value);
  }
}

function resolveRootByPath(path, scope) {
  if (path.startsWith("attacker.")) {
    return {
      root: scope.attacker,
      localPath: path.slice("attacker.".length),
    };
  }

  if (path.startsWith("defender.")) {
    return {
      root: scope.defender,
      localPath: path.slice("defender.".length),
    };
  }

  if (path.startsWith("context.")) {
    return {
      root: scope.context,
      localPath: path.slice("context.".length),
    };
  }

  throw new Error(
    `Path '${path}' must start with attacker., defender. or context.`,
  );
}

function parseArgs(argv) {
  const out = {
    attacker: "tharox",
    defender: "bruno",
    skill: "carapace_impact",
    turn: 1,
    crit: "auto",
    locale: "en",
    stacks: null,
    bonusDamage: null,
    comparePassive: false,
    comparePath: null,
    compareMin: 0,
    compareMax: null,
    showJson: false,
    attackerAttack: null,
    defenderDefense: null,
    noPassive: false,
    preSkills: [],
    preSkillsDefender: [],
    attackerSet: [],
    defenderSet: [],
    contextSet: [],
    track: ["attacker.Defense", "attacker.maxHP", "attacker.HP", "defender.HP"],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[i + 1];

    if (key === "compare-passive") {
      out.comparePassive = true;
      continue;
    }

    if (key === "track") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --track");
      }
      out.track.push(next);
      i += 1;
      continue;
    }

    if (key === "pre-skill") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --pre-skill");
      }
      out.preSkills.push(next);
      i += 1;
      continue;
    }

    if (key === "pre-skill-defender") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --pre-skill-defender");
      }
      out.preSkillsDefender.push(next);
      i += 1;
      continue;
    }

    if (key === "attacker-set") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --attacker-set");
      }
      out.attackerSet.push(parseAssignment(next));
      i += 1;
      continue;
    }

    if (key === "defender-set") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --defender-set");
      }
      out.defenderSet.push(parseAssignment(next));
      i += 1;
      continue;
    }

    if (key === "context-set") {
      if (next == null || next.startsWith("--")) {
        throw new Error("Missing value for --context-set");
      }
      out.contextSet.push(parseAssignment(next));
      i += 1;
      continue;
    }

    if (key === "show-json") {
      out.showJson = true;
      continue;
    }

    if (key === "no-passive") {
      out.noPassive = true;
      continue;
    }

    if (next == null || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    if (key === "attacker") out.attacker = next;
    else if (key === "defender") out.defender = next;
    else if (key === "skill") out.skill = next;
    else if (key === "turn") out.turn = Number(next);
    else if (key === "stacks") out.stacks = Number(next);
    else if (key === "bonus-damage") out.bonusDamage = Number(next);
    else if (key === "crit") out.crit = next;
    else if (key === "locale") out.locale = next;
    else if (key === "compare-path") out.comparePath = next;
    else if (key === "compare-min") out.compareMin = Number(next);
    else if (key === "compare-max") out.compareMax = Number(next);
    else if (key === "attacker-attack") out.attackerAttack = Number(next);
    else if (key === "defender-defense") out.defenderDefense = Number(next);
    else throw new Error(`Unknown option: --${key}`);

    i += 1;
  }

  if (!CRIT_MODES.includes(out.crit)) {
    throw new Error(`--crit must be one of: ${CRIT_MODES.join(", ")}`);
  }
  if (!SUPPORTED_LOCALES.includes(out.locale)) {
    throw new Error(`--locale must be one of: ${SUPPORTED_LOCALES.join(", ")}`);
  }

  return out;
}

// A real match and resolver, so every skill runs against the same context,
// registries and hooks the server builds — no hand-rolled mock to drift.
function createArena(options) {
  const match = new GameMatch();
  match.combat.currentTurn = options.turn;

  const spawn = (championKey, team) => {
    if (!championDB[championKey]) {
      const available = Object.keys(championDB).sort().join(", ");
      throw new Error(
        `Champion '${championKey}' not found. Available: ${available}`,
      );
    }
    return match.combat.spawnChampion({
      championKey,
      team,
      combatSlot: 0,
      spawnProtection: false,
    });
  };

  const attacker = spawn(options.attacker, 1);
  const defender = spawn(options.defender, 2);

  // `force` rides the engine's own debug flag; `disable` zeroes the stat, so a
  // skill that adds its own crit chance can still crit.
  const resolver = new TurnResolver(match, {
    alwaysCrit: options.crit === "force",
  });
  if (options.crit === "disable") attacker.Critical = 0;

  if (options.attackerAttack != null) {
    attacker.Attack = options.attackerAttack;
    attacker.baseAttack = options.attackerAttack;
  }

  if (options.defenderDefense != null) {
    defender.Defense = options.defenderDefense;
    defender.baseDefense = options.defenderDefense;
  }

  if (options.noPassive) attacker.passive = null;

  applyAssignments(attacker, options.attackerSet || []);
  applyAssignments(defender, options.defenderSet || []);

  if (options.stacks != null) attacker.runtime.theopetraStacks = options.stacks;

  seedTidesModifier(attacker);

  return { resolver, attacker, defender };
}

// Naelys' passive only registers its Tides modifier when a stack is gained, so
// stacks seeded through --attacker-set would otherwise add nothing. Mirrors the
// passive's own modifier (same id, so the passive never adds a second one).
function seedTidesModifier(attacker) {
  const passive = attacker.passive;
  if (passive?.key !== "heart_of_the_tides") return;
  if (!(attacker.runtime.mareStacks > 0)) return;
  if (attacker.getDamageModifiers().some((m) => m.id === "tides-stacks")) {
    return;
  }

  attacker.addDamageModifier({
    id: "tides-stacks",
    name: "Tides",
    permanent: true,
    apply: ({ baseDamage, attacker: atk }) =>
      baseDamage +
      Math.min(atk.runtime?.mareStacks || 0, passive.maxStacks) *
        passive.dmgPerStack,
  });
}

function createContext(resolver, user, options) {
  const context = resolver.createBaseContext({ sourceId: user.id });
  applyAssignments(context, options.contextSet || []);
  return context;
}

function getSkill(champion, skillKey) {
  const skill = (champion.skills || []).find((s) => s.key === skillKey);
  if (!skill) {
    const keys = (champion.skills || []).map((s) => s.key).join(", ");
    throw new Error(
      `Skill '${skillKey}' not found on ${champion.name}. Available: ${keys}`,
    );
  }
  return skill;
}

function estimateSkillBaseDamage(attacker, skill) {
  if (!Number.isFinite(skill?.bf)) return null;
  return (attacker.Attack * skill.bf) / 100;
}

// One-on-one arena: a self-targeting skill hits its user, anything else the foe.
function resolveTargets({ user, foe, skill }) {
  return skill?.targetSpec?.[0] === "self" ? [user] : [foe];
}

// Runs a skill through the resolver's real skill path and flattens its results.
function executeSkill({ resolver, user, foe, skill, context }) {
  const targets = resolveTargets({ user, foe, skill });
  return resolver
    .performSkillExecution(user, skill, targets, context)
    .flat(Infinity)
    .filter(Boolean);
}

function collectLogs(results) {
  return results.flatMap((r) => [r.log].flat(Infinity)).filter(Boolean);
}

// Dialogs hang off the visual event they follow, or sit in globalDialogs.
function collectDialogs(context) {
  const dialogs = [];
  for (const [bucket, entries] of Object.entries(context.visual)) {
    if (!Array.isArray(entries)) continue;
    if (bucket === "globalDialogs") {
      dialogs.push(...entries);
      continue;
    }
    for (const entry of entries) {
      dialogs.push(...(entry.preDialogs ?? []), ...(entry.postDialogs ?? []));
    }
  }
  return dialogs;
}

function readTracked(paths, scope) {
  return paths.map((path) => {
    const { root, localPath } = resolveRootByPath(path, scope);
    return { path, value: getPath(root, localPath) };
  });
}

function runPreSkills({ resolver, user, foe, keys, options }) {
  const executed = [];
  for (const key of keys) {
    if (!key || key === "none") continue;
    if (!(user.skills || []).some((s) => s.key === key)) continue;

    const context = createContext(resolver, user, options);
    const results = executeSkill({
      resolver,
      user,
      foe,
      skill: getSkill(user, key),
      context,
    });
    executed.push({ key, user: user.name, results });
  }
  return executed;
}

function runScenario(options, tag) {
  const { resolver, attacker, defender } = createArena(options);
  const skill = getSkill(attacker, options.skill);

  // Defender pre-skills run first, then the attacker's, each as its own action.
  const preSkills = [
    ...runPreSkills({
      resolver,
      user: defender,
      foe: attacker,
      keys: options.preSkillsDefender,
      options,
    }),
    ...runPreSkills({
      resolver,
      user: attacker,
      foe: defender,
      keys: options.preSkills,
      options,
    }),
  ];

  const context = createContext(resolver, attacker, options);
  const scope = { attacker, defender, context };
  const trackedBefore = readTracked(options.track, scope);
  const baseDamage = estimateSkillBaseDamage(attacker, skill);

  const results = executeSkill({
    resolver,
    user: attacker,
    foe: defender,
    skill,
    context,
  });

  const [target] = resolveTargets({ user: attacker, foe: defender, skill });
  const mainResult =
    results.find(
      (r) => r.targetId === target.id && Number.isFinite(r.totalDamage),
    ) ?? null;

  const trackedAfter = readTracked(options.track, scope);

  return {
    tag,
    locale: options.locale,
    attacker: attacker.name,
    defender: defender.name,
    skill: skill.key,
    baseDamage,
    tracked: trackedBefore.map((entry, idx) => ({
      path: entry.path,
      before: entry.value,
      after: trackedAfter[idx]?.value,
    })),
    preSkills: preSkills.map(({ key, user }) => ({ key, user })),
    totalDamage: mainResult?.totalDamage ?? null,
    mitigatedDamage: mainResult?.journey?.mitigated ?? null,
    hpAfter: `${defender.HP}/${defender.maxHP}`,
    logs: collectLogs(results),
    dialogs: collectDialogs(context),
    rawResult: results,
  };
}

// Direct DamageEvent probe: fires one hit with an explicit bonusDamage rider so
// the semi-absolute merge can be eyeballed without touching any champion kit.
function runBonusProbe(options) {
  const { resolver, attacker, defender } = createArena(options);
  const context = createContext(resolver, attacker, options);

  const skill = getSkill(attacker, options.skill);
  const [target] = resolveTargets({ user: attacker, foe: defender, skill });
  const baseDamage = estimateSkillBaseDamage(attacker, skill) ?? 100;

  const critOptions =
    options.crit === "force"
      ? { force: true }
      : options.crit === "disable"
        ? { disable: true }
        : {};

  const result = new DamageEvent({
    baseDamage,
    bonusDamage: options.bonusDamage,
    mode: skill.damageMode,
    type: skill.type ?? "physical",
    attacker,
    defender: target,
    skill,
    context,
    critOptions,
    allChampions: context.allChampions,
  }).execute();

  const results = [result].flat(Infinity).filter(Boolean);
  const main = results[0];
  const j = main?.journey ?? {};

  console.log(`\n=== Bonus-damage probe ===`);
  console.log(
    `${attacker.name} -> ${target.name} | skill: ${skill.key} (mode: ${skill.damageMode ?? "standard"})`,
  );
  console.log(
    `baseDamage: ${baseDamage.toFixed(2)} | bonusDamage: ${options.bonusDamage}`,
  );
  console.log(
    `journey: base=${j.base} bonus=${j.bonus} mitigated=${j.mitigated} final=${j.final} actual=${j.actual}`,
  );
  console.log(`Applied damage (HP delta): ${main?.totalDamage}`);
  console.log(`Defender HP after: ${target.HP}/${target.maxHP}`);

  printText("Log", collectLogs(results), options.locale);
  printText(
    "Dialogs",
    collectDialogs(context).map((d) => d.message),
    options.locale,
  );

  if (options.showJson) {
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(result, null, 2));
  }
}

// Logs and dialogs are plain strings or { en, pt } pairs; print the chosen locale.
function printText(title, entries, locale) {
  if (!entries.length) return;
  console.log(`--- ${title} ---`);
  for (const entry of entries) console.log(resolveText(entry, locale));
}

function printSummary(summary) {
  console.log(`\n=== ${summary.tag} ===`);
  console.log(
    `${summary.attacker} -> ${summary.defender} | skill: ${summary.skill}`,
  );
  if (summary.baseDamage != null) {
    console.log(
      `Estimated baseDamage (bf x Attack): ${summary.baseDamage.toFixed(2)}`,
    );
  }

  if (summary.tracked.length) {
    console.log("Tracked fields:");
    for (const field of summary.tracked) {
      console.log(`- ${field.path}: ${field.before} -> ${field.after}`);
    }
  }

  if (summary.preSkills.length) {
    console.log("Pre-skills executed:");
    for (const step of summary.preSkills) {
      console.log(`- ${step.user}: ${step.key}`);
    }
  }

  console.log(`Mitigated damage in pipeline: ${summary.mitigatedDamage}`);
  console.log(`Applied damage (HP delta): ${summary.totalDamage}`);
  console.log(`Defender HP after: ${summary.hpAfter}`);

  printText("Log", summary.logs, summary.locale);
  printText(
    "Dialogs",
    summary.dialogs.map((d) => d.message),
    summary.locale,
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.stacks != null && !options.track.length) {
    options.track.push("attacker.runtime.theopetraStacks");
  }

  if (options.bonusDamage != null) {
    runBonusProbe(options);
    return;
  }

  if (options.comparePassive) {
    const probePassive = championDB[options.attacker]?.passive;
    const comparePath =
      options.comparePath || "attacker.runtime.theopetraStacks";
    const compareMax =
      options.compareMax != null
        ? options.compareMax
        : (probePassive?.maxStacks ?? 0);

    if (!Number.isFinite(compareMax)) {
      throw new Error(
        "Could not infer compare max value. Use --compare-max explicitly.",
      );
    }

    if (!options.track.includes(comparePath)) {
      options.track.push(comparePath);
    }

    const compareScenarioA = structuredClone(options);
    const compareScenarioB = structuredClone(options);

    const targetPathA = comparePath.replace(/^attacker\./, "");
    const targetPathD = comparePath.replace(/^defender\./, "");
    const targetPathC = comparePath.replace(/^context\./, "");

    if (comparePath.startsWith("attacker.")) {
      compareScenarioA.attackerSet.push({
        path: targetPathA,
        value: options.compareMin,
      });
      compareScenarioB.attackerSet.push({
        path: targetPathA,
        value: compareMax,
      });
    } else if (comparePath.startsWith("defender.")) {
      compareScenarioA.defenderSet.push({
        path: targetPathD,
        value: options.compareMin,
      });
      compareScenarioB.defenderSet.push({
        path: targetPathD,
        value: compareMax,
      });
    } else if (comparePath.startsWith("context.")) {
      compareScenarioA.contextSet.push({
        path: targetPathC,
        value: options.compareMin,
      });
      compareScenarioB.contextSet.push({
        path: targetPathC,
        value: compareMax,
      });
    } else {
      throw new Error(
        "--compare-path must start with attacker., defender. or context.",
      );
    }

    const noStackSummary = runScenario(
      compareScenarioA,
      `${comparePath} = ${options.compareMin}`,
    );
    const fullStackSummary = runScenario(
      compareScenarioB,
      `${comparePath} = ${compareMax}`,
    );

    printSummary(noStackSummary);
    printSummary(fullStackSummary);

    if (
      Number.isFinite(noStackSummary.totalDamage) &&
      Number.isFinite(fullStackSummary.totalDamage) &&
      noStackSummary.totalDamage > 0
    ) {
      const ratio = fullStackSummary.totalDamage / noStackSummary.totalDamage;
      console.log(`\nObserved final-damage ratio: ${ratio.toFixed(3)}x`);
    }

    if (options.showJson) {
      console.log("\n--- JSON ---");
      console.log(
        JSON.stringify({ noStackSummary, fullStackSummary }, null, 2),
      );
    }

    return;
  }

  const summary = runScenario(options, "Single scenario");
  printSummary(summary);

  if (options.showJson) {
    console.log("\n--- JSON ---");
    console.log(JSON.stringify(summary, null, 2));
  }
}

main();
