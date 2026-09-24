// ============================================================
//  Vine Lash Animation
//
//  Living variant of the chain lash, opted into with `hitVfx: "vine_lash"`.
//  The line bows far more on the way out, coils tighter around the target
//  and unfurls small blades along its length once it has swept past — the
//  only thing that separates it from the ribbon is what grows on it.
// ============================================================

import { ChainLashEffect, CHAIN_LASH_PALETTES } from "./chainLashAnimation.js";
import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "../core/animationUtils.js";

const PADDING = 220;

const VINE_OPTIONS = Object.freeze({
  dash: null,
  loopCount: 5,
  slackScale: 1.7,
  sprouts: 7,
});

export async function playVineLash({
  userEl,
  targetEl,
  skill,
  hit,
  canvasBatch,
}) {
  if (!targetEl) return;

  const requested =
    hit?.hitVfxPalette || skill?.hitVfxPalette || hit?.element || skill?.element;
  const paletteKey = requested in CHAIN_LASH_PALETTES ? requested : "verdant";

  const rect = targetEl.getBoundingClientRect();
  const target = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const size = Math.max(rect.width, rect.height);
  const start = userEl
    ? getElementCenter(userEl)
    : { x: target.x - 280, y: target.y - 60 };

  const buildEffect = (ctx) =>
    new ChainLashEffect(ctx, start, target, size, paletteKey, VINE_OPTIONS);

  let flashed = false;
  const onFrame = (effect) => {
    if (!effect.cracked || flashed) return;

    flashed = true;
    targetEl.classList.add("slash-hit");
    setTimeout(() => targetEl.classList.remove("slash-hit"), 380);
  };

  if (canvasBatch) {
    await canvasBatch.run([start, target], PADDING, buildEffect, onFrame);
  } else {
    await runSoloEffect(
      computeEffectBox([start, target], PADDING),
      buildEffect,
      onFrame
    );
  }
}
