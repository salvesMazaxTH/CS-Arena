import {
  STAR_SCORE_THRESHOLD,
  STARS_TO_WIN,
  GENERIC_SCORE_HALVING_THRESHOLD,
} from "/shared/engine/match/matchRules.js";

// Star icon: "Round star" by Delapouite (game-icons.net, CC BY 3.0).

/**
 * Team scoreboard: updates the two player score displays with an animated
 * increment/decrement, and paces the scoreboard reaction during CLAIM plays.
 */
export function createScoreboard() {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const penaltyText = `Kill and CLAIM points score at a reduced rate from ${GENERIC_SCORE_HALVING_THRESHOLD} points on.`;

  [1, 2].forEach((team) => {
    const penalty = document.getElementById(`player${team}-score-penalty`);
    penalty.dataset.tooltip = penaltyText;
    penalty.setAttribute("aria-label", penaltyText);

    updateStars(document.getElementById(`player${team}-stars`), 0);
  });

  function updateScoreValue(element, progressFill, newValue) {
    const oldValue = Number(element.textContent) || 0;
    const nextValue = Number(newValue) || 0;

    if (oldValue === nextValue) return;

    progressFill.style.width = `${Math.min(100, (nextValue / STAR_SCORE_THRESHOLD) * 100)}%`;

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

  function updatePenaltyBadge(element, value) {
    element.hidden = (Number(value) || 0) < GENERIC_SCORE_HALVING_THRESHOLD;
  }

  /** Draws STARS_TO_WIN slots (more if the threshold star pushes a team past
   *  it), fills the earned ones, and pops the ones earned since last time. */
  function updateStars(container, value) {
    const earned = Math.max(0, Number(value) || 0);
    const slots = Math.max(STARS_TO_WIN, earned);

    while (container.children.length < slots) {
      const star = document.createElement("span");
      star.className = "match-star";
      container.appendChild(star);
    }
    while (container.children.length > slots) {
      container.lastElementChild.remove();
    }

    Array.from(container.children).forEach((star, index) => {
      const shouldEarn = index < earned;
      const wasEarned = star.classList.contains("earned");
      star.classList.toggle("earned", shouldEarn);
      if (shouldEarn && !wasEarned) {
        star.classList.remove("star-gained");
        void star.offsetWidth;
        star.classList.add("star-gained");
      } else if (!shouldEarn) {
        star.classList.remove("star-gained");
      }
    });

    container.setAttribute("aria-label", `${earned} of ${STARS_TO_WIN} stars`);
  }

  function update(score) {
    if (!score) return;

    updateStars(
      document.getElementById("player1-stars"),
      score.stars?.player1 ?? 0,
    );
    updateStars(
      document.getElementById("player2-stars"),
      score.stars?.player2 ?? 0,
    );

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

    updatePenaltyBadge(
      document.getElementById("player1-score-penalty"),
      score.player1 ?? 0,
    );
    updatePenaltyBadge(
      document.getElementById("player2-score-penalty"),
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
