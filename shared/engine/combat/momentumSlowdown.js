export const MOMENTUM_SLOWDOWN_THRESHOLD = 50;

export const MOMENTUM_SLOWDOWN_TOOLTIP = {
  en: `At ${MOMENTUM_SLOWDOWN_THRESHOLD}+ Momentum, generic gains (damage dealt, damage taken and turn regen) are halved. Kit gains are unaffected.`,
  pt: `Com ${MOMENTUM_SLOWDOWN_THRESHOLD}+ de Momentum, os ganhos genéricos (dano causado, dano sofrido e regeneração de turno) caem pela metade. Ganhos de kit não são afetados.`,
};

export function isMomentumSlowed(champion) {
  return (Number(champion?.momentum) || 0) >= MOMENTUM_SLOWDOWN_THRESHOLD;
}

// Generic gains (damage dealt/taken, turn regen) are halved, rounded down but never
// below 1, while the champion sits at or above the threshold.
export function scaleGenericMomentumGain(champion, amount) {
  if (amount <= 0 || !isMomentumSlowed(champion)) return amount;
  return Math.max(1, Math.floor(amount / 2));
}
