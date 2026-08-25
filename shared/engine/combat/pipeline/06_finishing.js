export function processFinishing(event) {
  const rule = event.skill?.finishingRule ?? event.skill?.obliterateRule;
  if (!rule) return;

  const finishingType = resolveFinishingType(event.skill);
  const finishingFlags = buildFinishingFlags(finishingType);

  if (event.defender.team === event.attacker.team) return;

  if (!event.actualDmg || event.actualDmg <= 0) return;

  const preventUntil = event.defender.runtime?.preventFinishingUntilTurn ?? 0;
  if (preventUntil > (event.context?.currentTurn ?? 0)) return;

  let threshold =
    typeof rule === "function" ? rule.call(event.skill, event) : rule;

  const override = event.context?.editMode?.executionOverride;

  if (typeof override === "number") {
    threshold = override;
  }

  const hpAfter = Number.isFinite(event.hpAfter)
    ? event.hpAfter
    : event.defender.HP;
  const hpPercent = hpAfter / event.defender.maxHP;

  if (hpPercent <= threshold) {
    const remainingHp = Math.max(0, hpAfter);

    registerFinishingDialog(event, finishingType);

    event.defender.HP = 0;
    event.defender.alive = false;
    event.hpAfter = 0;

    event.context.registerDamage({
      target: event.defender,
      amount: remainingHp,
      sourceId: event.attacker?.id,
      flags: finishingFlags,
    });
  }
}

function resolveFinishingType(skill) {
  const skillType =
    typeof skill?.finishingType === "function"
      ? skill.finishingType()
      : skill?.finishingType;

  return skillType || (skill?.obliterateRule ? "obliterate" : "regular");
}

function buildFinishingFlags(finishingType) {
  return {
    finishing: true,
    finishingType,
  };
}

function registerFinishingDialog(event, finishingType) {
  const dialogFactory = event.skill?.finishingDialog;
  if (typeof dialogFactory !== "function") return;

  const message = dialogFactory({
    attacker: event.attacker,
    defender: event.defender,
    event,
    finishingType,
  });

  if (!message) return;

  event.context.registerDialog({
    message,
    sourceId: event.attacker?.id,
    targetId: event.defender?.id,
  });
}

export { processFinishing as processObliterate };
