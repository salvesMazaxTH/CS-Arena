import { DamageEvent } from "./DamageEvent.js";
import { formatChampionName } from "../../ui/formatters.js";

// Reactions between an element and a status effect of an opposing one.
export class ElementalInteractions {
  // Reaction damage, as a percentage of the target's max HP.
  static SHATTER_MAXHP_PERCENT = 4;
  static VAPORIZE_MAXHP_PERCENT = 7.5;
  static ELECTROCUTE_MAXHP_PERCENT = 2.5;

  // Statuses that cannot coexist: either one landing on the other vaporizes both.
  static OPPOSING_STATUSES = { burning: "frozen", frozen: "burning" };

  static onFrozenBroken({ target, element, context }) {
    if (element === "fire") return this.vaporize({ target, context });

    return this._react({
      target,
      context,
      percent: this.SHATTER_MAXHP_PERCENT,
      key: "shatter",
      name: "Shatter",
      dialog: `The ice around ${formatChampionName(target)} shatters!`,
    });
  }

  // Returns true when the caller must drop the application it was about to make.
  static resolveOpposingStatus({ target, incomingKey, context }) {
    const opposing = this.OPPOSING_STATUSES[incomingKey];

    if (!opposing || !target.hasStatusEffect(opposing)) return false;

    target.removeStatusEffect(opposing);
    this.vaporize({ target, context });

    return true;
  }

  static onBurningDoused({ target, context }) {
    target.removeStatusEffect("burning");

    return this.vaporize({ target, context });
  }

  static onConductorSoaked({ target, context }) {
    return this._react({
      target,
      context,
      percent: this.ELECTROCUTE_MAXHP_PERCENT,
      key: "electrocute",
      name: "Electrocute",
      dialog: `The water carries the charge — ${formatChampionName(target)} is electrocuted!`,
    });
  }

  static vaporize({ target, context }) {
    return this._react({
      target,
      context,
      percent: this.VAPORIZE_MAXHP_PERCENT,
      key: "vaporize",
      name: "Vaporize",
      dialog: `${formatChampionName(target)} is swallowed by scalding steam!`,
    });
  }

  static _react({ target, context, percent, key, name, dialog }) {
    // No attacker: the elements did this, so no lifesteal or on-hit passive feeds
    // off it. `isDot` is what permits that, and it also blocks reaction cascades.
    const reactionContext = {
      ...context,
      isDot: true,
      damageDepth: (context.damageDepth ?? 0) + 1,
    };

    const result = new DamageEvent({
      baseDamage: (target.maxHP * percent) / 100,
      attacker: null,
      defender: target,
      skill: { key: `${key}_reaction`, name, contact: false, suppressLog: true },
      type: "magical",
      mode: DamageEvent.Modes.ABSOLUTE,
      context: reactionContext,
      allChampions: context.allChampions,
    }).execute();

    reactionContext.registerDialog({
      message: dialog,
      sourceId: target.id,
      targetId: target.id,
    });

    return {
      name,
      damage: result?.totalDamage ?? 0,
      log: `${formatChampionName(target)} takes ${result?.totalDamage ?? 0} damage from <b>${name}</b>.`,
    };
  }
}
