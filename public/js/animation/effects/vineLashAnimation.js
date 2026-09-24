// ============================================================
//  Vine Lash Animation
//
//  Plant-flavoured variant of the chain lash, opted into with
//  `hitVfx: "vine_lash"`. Same snap-and-coil motion, but the line grows as
//  one continuous tendril instead of glinting like articulated metal, it
//  bows more heavily on the way out, and it settles into an extra coil.
// ============================================================

import { ChainLashEffect } from "./chainLashAnimation.js";
import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "../core/animationUtils.js";

const PADDING = 220;

const VINE_OPTIONS = Object.freeze({
  dash: null,
  loopCount: 4,
  slackScale: 1.45,
});

export async function playVineLash({ userEl, targetEl, canvasBatch }) {
  if (!targetEl) return;

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
    new ChainLashEffect(ctx, start, target, size, "plant", VINE_OPTIONS);

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
