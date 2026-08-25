/**
 * Team scoreboard: updates the two player score displays with an animated
 * increment/decrement, and paces the scoreboard reaction during CLAIM plays.
 * Self-contained — reads and writes only its own DOM elements.
 */
export function createScoreboard() {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function updateScoreValue(element, newValue) {
    if (!element) return;

    const oldValue = Number(element.textContent) || 0;
    const nextValue = Number(newValue) || 0;

    if (oldValue === nextValue) return;

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
      score.player1 ?? 0,
    );
    updateScoreValue(
      document.getElementById("player2-score-display"),
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
