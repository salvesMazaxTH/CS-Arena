// Opt-in for stack-bound statuses that declare stackLifetime: every
// application is its own batch that runs out after that many ticks.

function syncStacks(instance) {
  const stacks = instance.stackBatches.reduce((sum, b) => sum + b.stacks, 0);
  instance.stacks = stacks;
  instance.stackCount = stacks;
  return stacks;
}

// Past maxStacks the oldest stacks give way, so a fresh application is
// never wasted: it renews the pile instead.
// Each batch remembers who applied it, so a tick can split its damage.
export function addStackBatch(
  instance,
  stacks,
  { stackLifetime, maxStacks },
  { sourceId = null, sourceTeam = null } = {},
) {
  const batches = [
    ...(instance.stackBatches ?? []),
    { stacks, ticksLeft: stackLifetime, sourceId, sourceTeam },
  ];

  let excess =
    batches.reduce((sum, b) => sum + b.stacks, 0) - (maxStacks ?? Infinity);
  instance.stackBatches = batches
    .map((b) => {
      const cut = Math.min(b.stacks, Math.max(0, excess));
      excess -= cut;
      return { ...b, stacks: b.stacks - cut };
    })
    .filter((b) => b.stacks > 0);

  return syncStacks(instance);
}

// Call once per tick, after the tick has read the stacks; returns what is left.
export function ageStackBatches(instance) {
  instance.stackBatches = (instance.stackBatches ?? [])
    .map((b) => ({ ...b, ticksLeft: b.ticksLeft - 1 }))
    .filter((b) => b.ticksLeft > 0);
  return syncStacks(instance);
}

// Stacks held per applier, oldest applier first. Read before ageStackBatches.
export function stackSources(instance) {
  const bySource = new Map();
  for (const b of instance.stackBatches ?? []) {
    const prev = bySource.get(b.sourceId);
    bySource.delete(b.sourceId);
    bySource.set(b.sourceId, {
      sourceId: b.sourceId ?? null,
      sourceTeam: b.sourceTeam ?? null,
      stacks: (prev?.stacks ?? 0) + b.stacks,
    });
  }
  return [...bySource.values()];
}

// The applier holding the most stacks owns the tick; a tie goes to the latest.
export function leadingStackSource(sources) {
  return sources.reduce(
    (lead, s) => (!lead || s.stacks >= lead.stacks ? s : lead),
    null,
  );
}

// Splits each total across the sources by stacks. Whole totals stay whole:
// the leftover units go to the largest remainders, so shares always add up.
export function splitByStacks(sources, ...totals) {
  const weight = sources.reduce((sum, s) => sum + (Number(s.stacks) || 0), 0);
  const parts = totals.map((total) => {
    const value = Number(total) || 0;
    const exact = sources.map((s) =>
      weight > 0 ? (value * (Number(s.stacks) || 0)) / weight : value / sources.length,
    );
    if (!Number.isInteger(value)) return exact;
    const floored = exact.map(Math.floor);
    let left = value - floored.reduce((a, b) => a + b, 0);
    exact
      .map((x, i) => ({ i, rem: x - floored[i] }))
      .sort((a, b) => b.rem - a.rem || b.i - a.i)
      .forEach(({ i }) => { if (left-- > 0) floored[i] += 1; });
    return floored;
  });
  return sources.map((s, i) => ({
    sourceId: s.sourceId ?? null,
    sourceTeam: s.sourceTeam ?? null,
    amount: parts[0]?.[i] ?? 0,
    absorbed: parts[1]?.[i] ?? 0,
  }));
}
