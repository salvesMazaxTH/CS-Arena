import { SCORE_THRESHOLD } from "/shared/engine/match/matchRules.js";

/**
 * Team scoreboard: updates the two player score displays with an animated
 * increment/decrement, and paces the scoreboard reaction during CLAIM plays.
 */
export function createScoreboard() {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  [1, 2].forEach((team) => {
    document.getElementById(`player${team}-goal-display`).textContent =
      `/${SCORE_THRESHOLD}`;
  });

  function updateScoreValue(element, progressFill, newValue) {
    const oldValue = Number(element.textContent) || 0;
    const nextValue = Number(newValue) || 0;

    if (oldValue === nextValue) return;

    progressFill.style.width = `${Math.min(100, (nextValue / SCORE_THRESHOLD) * 100)}%`;

    const increasing = nextValue > oldValue;
    const delta = Math.abs(nextValue - oldValue);

    // Reset the animation in case the score changes again quickly.
    element.classList.remove(
      "score-changing",
      "score-increased",
      "score-decreased",
    );

    element.dataset.scoreDelta = `${increasing ? "+" : "-"}${delta}`;

    // Force the browser to recognize the removal before adding again.
    void element.offsetWidth;

    element.textContent = String(nextValue);

    element.classList.add(
      "score-changing",
      increasing ? "score-increased" : "score-decreased",
    );

    element.addEventListener(
      "animationend",
      () => {
        delete element.dataset.scoreDelta;
        element.classList.remove(
          "score-changing",
          "score-increased",
          "score-decreased",
        );
      },
      { once: true },
    );
  }

  function update(score) {
    if (!score) return;

    updateScoreValue(
      document.getElementById("player1-score-display"),
      document.getElementById("player1-progress-fill"),
      score.player1 ?? 0,
    );
    updateScoreValue(
      document.getElementById("player2-score-display"),
      document.getElementById("player2-progress-fill"),
      score.player2 ?? 0,
    );
  }

  async function animateClaim(score) {
    if (!score) return;

    // Small delay for the CLAIM balloon to appear before the scoreboard reacts.
    await wait(220);

    update(score);

    // Keeps the CLAIM block active until the scoreboard animation is legible.
    await wait(900);
  }

  return { update, animateClaim };
}
