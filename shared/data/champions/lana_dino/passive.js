export default {
  key: "wild_instinct",
  name: "Wild Instinct",

  description() {
    return `Tutu stands in front of Lana until there is nothing left of him. When he is defeated, Lana returns to the battle with the same HP she left it with.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ owner, context }) {
    // Still standing: nothing to do.
    if (owner.HP > 0) return;

    const lanaOriginalId = owner.runtime.swappedFrom;

    if (!lanaOriginalId) {
      // No original id stored (abnormal state — Lana was never swapped out).
      return;
    }

    if (!context)
      throw new Error(
        `[wild_instinct] ERROR: context is undefined while registering the replace request for ${owner.name}`,
      );

    // Register the restore intent (Tutu → Lana).
    // Lana's full state (original HP included) is restored automatically.
    context.requestChampionMutation?.({
      mode: "restore",
      targetId: lanaOriginalId,
    });

    return {
      log: `${owner.name} falls! Lana returns to the battle!`,
    };
  },
};
