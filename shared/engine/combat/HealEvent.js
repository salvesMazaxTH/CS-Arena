import { emitCombatEvent } from "./combatEvents.js";

export class HealEvent {
  static Types = Object.freeze({
    NORMAL: "normal",
    LIFESTEAL: "lifesteal",
  });

  constructor(params) {
    const { target, amount, context, source, type, fromTargetId } = params;

    if (!target) {
      throw new Error("HealEvent precisa de target");
    }

    this.target = target;
    this.source = source ?? target;
    this.context = context ?? target.runtime?.currentContext ?? {};

    this.healType = type ?? HealEvent.Types.NORMAL;
    this.isLifesteal = this.healType === HealEvent.Types.LIFESTEAL;
    this.fromTargetId = fromTargetId ?? null;

    const champions = params.allChampions ?? this.context.allChampions;
    this.allChampions =
      champions instanceof Map ? [...champions.values()] : (champions ?? []);

    this.requestedAmount = Number(amount ?? 0);
    this.amount = this.requestedAmount;
    this.healed = 0;
  }

  execute() {
    if (!this.target.alive) return 0;

    this.normalizeAmount();
    this.runBeforeHooks();
    this.applyHeal();

    if (this.healed <= 0) return 0;

    this.register();
    this.runAfterHooks();

    return this.healed;
  }

  normalizeAmount() {
    if (this.amount > 0) {
      this.amount = Math.max(Math.floor(this.amount), 1);
    }

    this.requestedAmount = this.amount;
  }

  runBeforeHooks() {
    const results =
      emitCombatEvent(
        "onBeforeHealing",
        this.buildPayload(this.requestedAmount),
        this.allChampions,
      ) || [];

    // Every hook reads the same payload snapshot, so their results compose as
    // ratios against it — a "last one wins" overwrite would drop all the others.
    let ratio = 1;

    for (const result of results) {
      if (typeof result?.amount !== "number" || this.requestedAmount <= 0) {
        continue;
      }

      ratio *= result.amount / this.requestedAmount;
    }

    this.amount = Math.max(0, Math.round(this.requestedAmount * ratio));
  }

  applyHeal() {
    this.healed = this.target.heal(this.amount);
  }

  register() {
    if (this.isLifesteal && this.context.registerLifesteal) {
      this.context.registerLifesteal({
        target: this.target,
        amount: this.healed,
        sourceId: this.source?.id,
        fromTargetId: this.fromTargetId,
      });
      return;
    }

    this.context.registerHeal?.({
      target: this.target,
      amount: this.healed,
      sourceId: this.source?.id,
    });
  }

  runAfterHooks() {
    const results =
      emitCombatEvent(
        "onAfterHealing",
        this.buildPayload(this.healed),
        this.allChampions,
      ) || [];

    this.context.registerHookLogs?.(results);
  }

  buildPayload(amount) {
    return {
      healSrc: this.source,
      healTarget: this.target,

      amount,
      context: this.context,

      healType: this.healType,
      isLifesteal: this.isLifesteal,
      fromTargetId: this.fromTargetId,
    };
  }
}
