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
export function addStackBatch(instance, stacks, { stackLifetime, maxStacks }) {
  const batches = [
    ...(instance.stackBatches ?? []),
    { stacks, ticksLeft: stackLifetime },
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
