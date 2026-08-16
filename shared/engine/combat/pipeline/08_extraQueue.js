export function processExtraQueue(event) {
  const queue = event.context.extraDamageQueue || [];
  if (queue.length === 0) return [];

  console.log(
    `🔥 processExtraQueue: Processing ${queue.length} extra events.`,
  );

  // Clean the original queue to avoid re-processing the same events in case of recursion
  const itemsToProcess = [...queue];
  event.context.extraDamageQueue = [];

  const results = [];

  for (const extra of itemsToProcess) {
    // 1. Create an instance for the extra event (Reflect, Thorns, etc)
    const extraEvent = new event.constructor({
      ...extra, // baseDamage, attacker, defender, skill, etc.
      allChampions: event.allChampions,
      context: {
        ...event.context,
        // Increment the depth to avoid infinite recursion (stops at 2 or 3)
        damageDepth: (event.context.damageDepth || 0) + 1,
        origin: extra.skill?.key || "reaction",
        // Important: We pass the reference of the cleaned queue to the new event
        extraDamageQueue: event.context.extraDamageQueue,
      },
    });

    // 2. Execute the full pipeline for the new event
    const result = extraEvent.execute();

    // 3. If the event generated a dialog, we register it in the context to be displayed later
    if (extra.dialog && extraEvent.context._lastEventRef) {
      extraEvent.context._lastEventRef.postDialogs.push(extra.dialog);
    }

    // 4. Accumulate the formatted result
    if (Array.isArray(result)) results.push(...result);
    else if (result) results.push(result);
  }

  // Store in the internal state of the current instance for buildFinalResult to consolidate later
  event.extraResults.push(...results);
  return results;
}
