import { getClaimPoints } from "../claim.js";

export function applyDamage(event) {
  if (event.constructor.debugMode) console.group(`❤️ [APLICANDO DANO]`);
  if (event.constructor.debugMode) {
    console.log(`👤 Defender: ${event.defender.name}`);
    console.log(`📍 HP Antes: ${event.defender.HP}/${event.defender.maxHP}`);
    console.log(`💥 Dano: ${event.damage}`);
  }

  const currentTurn = event.context?.currentTurn ?? 0;
  event.defender.runtime ??= {};
  event.defender.runtime.claimValueBeforeDeath = getClaimPoints(
    event.defender,
    currentTurn,
  );

  const hpBefore = event.defender.HP;
  const shieldBefore = Array.isArray(event.defender.runtime?.shields)
    ? event.defender.runtime.shields
        .filter((s) => !s?.type || s.type === "regular")
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    : 0;

  // Positive damage can never round down to 0 — a hit that connects always
  // deals at least 1. Only hooks composing together (e.g. Avarik's Edict
  // clamping to 1 alongside another champion's own percentage reduction)
  // can land in the sub-1 range; this is the single point every DamageEvent
  // funnels through before touching HP, so it's the right place to enforce it.
  if (event.damage > 0 && event.damage < 1) {
    event.damage = 1;
  }

  const damageToApply = Math.floor(event.damage);

  console.log(`[DAMAGE COMPOSITION] damageToApply: ${damageToApply}`);
  console.log(`[DAMAGE COMPOSITION] hpBefore: ${hpBefore}`);

  event.defender.takeDamage(damageToApply, event.context);

  console.log(
    `➡️ [applyDamage] Dano aplicado, após takeDamage: ${damageToApply}, HP de ${event.defender.name}: ${event.defender.HP}/${event.defender.maxHP}`,
  );

  event.hpAfter = event.defender.HP;
  event.actualDmg = hpBefore - event.hpAfter;
  const remainingShield = Array.isArray(event.defender.runtime?.shields)
    ? event.defender.runtime.shields
        .filter((s) => !s?.type || s.type === "regular")
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
    : 0;
  const absorbedByShield = Math.max(0, shieldBefore - remainingShield);

  event.context.registerDamage({
    target: event.defender,
    amount: event.actualDmg,
    rawAmount: damageToApply,
    absorbedByShield,
    remainingShield,
    sourceId: event.attacker?.id,
    isCritical: event.crit?.didCrit,
    isDot: !!event.context.isDot,
    element: event.element,
    contact: event.contact,
    hitVfx: event.hitVfx,
    flags: {
      ...event.flags,
      evaded: event.evasionAttempted ? false : undefined,
    },
  });

  // Agora _lastEventRef está correto, registre o dialog de afinidade se existir
  if (event.affinityDialog) {
    event.context.registerDialog(event.affinityDialog);
    delete event.affinityDialog;
  }

  if (event.constructor.debugMode) {
    console.log(`📍 HP Depois: ${event.hpAfter}/${event.defender.maxHP}`);
    console.log(`✅ Dano efetivo: ${event.actualDmg}`);
    if (event.hpAfter <= event.defender.maxHP * 0.2)
      console.log(`🚨 ALERTA: Defender em perigo! (<20% HP)`);
    if (event.hpAfter <= 0) console.log(`💀 Defender DERROTADO!`);
    console.groupEnd();
  }
}
