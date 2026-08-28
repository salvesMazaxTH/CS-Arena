export class StatusEffect {
  constructor({ key, duration, owner, context, metadata = {}, hooks = {} }) {
    this.key = key;

    this.ownerId = owner?.id ?? null;

    this.appliedAtTurn = context?.currentTurn ?? 0;
    this.expiresAtTurn = this.appliedAtTurn + duration;
    this.appliedExecutionIndex = context?.executionIndex ?? null;

    this.metadata = metadata;
    Object.assign(this, metadata);

    // Inject hook functions directly into the instance
    Object.assign(this, hooks);
  }

  // True when `context` belongs to the same action that applied this effect.
  // executionIndex is unique per action within a turn (repeat actions included).
  appliedByAction(context) {
    return (
      this.appliedAtTurn === context?.currentTurn &&
      this.appliedExecutionIndex === context?.executionIndex
    );
  }
}
