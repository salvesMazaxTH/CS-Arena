/**
 * Client-side target selection for a skill: reads the champions on the field and
 * opens a picker overlay when the player must choose. Returns the chosen targets;
 * it never mutates shared game state. Depends on the live champion list and on
 * removeSkillOverlay, both injected.
 */
export function createTargeting({ getActiveChampions, removeSkillOverlay }) {
  async function collectClientTargets(user, skill) {
    if (!skill || !Array.isArray(skill.targetSpec)) return null;

    const normalizedSpec = skill.targetSpec.map((s) =>
      typeof s === "string" ? { type: s } : s,
    );

    const hasGlobal = normalizedSpec.some(
      (s) =>
        s.type === "all" || s.type === "all:enemy" || s.type === "all:ally",
    );

    // If it's a global skill, don't open the selection UI.
    if (hasGlobal) return {};

    const championsInField = Array.from(getActiveChampions().values());

    const targets = {};
    const enemyCounter = { count: 0 };
    const chosenTargets = new Set();

    for (const spec of normalizedSpec) {
      const target = await selectTargetForRole(
        spec,
        user,
        championsInField,
        enemyCounter,
        chosenTargets,
        spec.unique === true,
      );

      // Manual cancel.
      if (target === null) return null;

      // Skipped slot.
      if (target === undefined) continue;

      Object.assign(targets, target);
    }

    if (Object.keys(targets).length === 0) {
      alert("There are no valid targets for this skill.");
      return null;
    }

    return targets;
  }

  async function selectTargetForRole(
    spec,
    user,
    championsInField,
    enemyCounter,
    chosenTargets,
    enforceUnique,
  ) {
    // Helper: filters already chosen targets when uniqueness is enforced.
    const filterUnique = (list) =>
      enforceUnique ? list.filter((c) => !chosenTargets.has(c.id)) : list;

    // Helper: sorts candidates to match their visual order on the field (by combatSlot).
    const byFieldOrder = (list) =>
      [...list].sort((a, b) => (a.combatSlot ?? 0) - (b.combatSlot ?? 0));

    const role = spec.type;

    // SELF (automatic)
    if (role === "self") {
      chosenTargets.add(user.id);
      return { self: user };
    }

    // ALLY (automatic — first available ally)
    if (role === "ally") {
      let allies = championsInField.filter(
        (c) => c.team === user.team && c.id !== user.id,
      );
      allies = byFieldOrder(filterUnique(allies));
      if (allies.length === 0) return undefined;
      chosenTargets.add(allies[0].id);
      return { ally: allies[0] };
    }

    // SELECT ALLY (manual selection)
    if (role === "select:ally") {
      let candidates = championsInField.filter((c) => c.team === user.team);

      if (spec.excludesSelf) {
        candidates = candidates.filter((c) => c.id !== user.id);
      }

      candidates = byFieldOrder(filterUnique(candidates));

      const target = await createTargetSelectionOverlay(
        candidates,
        "Choose an Ally",
      );

      if (target === null) return null;
      if (target === undefined) return undefined;

      chosenTargets.add(target.id);
      return { ally: target };
    }

    // SELECT ANY (manual selection, either team)
    if (role === "select:any") {
      let candidates = championsInField;

      if (spec.excludesSelf) {
        candidates = candidates.filter((c) => c.id !== user.id);
      }

      if (Array.isArray(spec.excludesKeys)) {
        candidates = candidates.filter(
          (c) => !spec.excludesKeys.includes(c.championKey),
        );
      }

      candidates = byFieldOrder(filterUnique(candidates));

      const target = await createTargetSelectionOverlay(
        candidates,
        "Choose a Target",
      );

      if (target === null) return null;
      if (target === undefined) return undefined;

      chosenTargets.add(target.id);
      return { any: target };
    }

    // ALLY/ENEMY GLOBAL (no selection, affects all champions of the type)
    if (role === "all:ally" || role === "all" || role === "all:enemy") return {};

    // ENEMY (manual selection)
    if (role === "enemy") {
      enemyCounter.count++;

      const index = enemyCounter.count;

      let candidates = championsInField.filter((c) => c.team !== user.team);
      candidates = byFieldOrder(filterUnique(candidates));

      const target = await createTargetSelectionOverlay(
        candidates,
        index === 1 ? "Select the ENEMY" : `Select the ENEMY ${index}`,
      );

      if (target === null) return null;
      if (target === undefined) return undefined;

      chosenTargets.add(target.id);
      const key = index === 1 ? "enemy" : `enemy${index}`;

      return { [key]: target };
    }

    console.error(`[selectTargetForRole] Unknown target role: ${role}`);
    return undefined;
  }

  function createTargetSelectionOverlay(candidates, title) {
    // Remove skill overlay if open (fixes mobile bug).
    removeSkillOverlay && removeSkillOverlay();
    return new Promise((resolve) => {
      // If there are no candidates, avoid opening the empty selection UI.
      if (!Array.isArray(candidates) || candidates.length === 0) {
        resolve(undefined);
        return;
      }

      const overlay = document.createElement("div");
      overlay.classList.add("targetSelectionOverlay");

      const h2 = document.createElement("h2");
      h2.textContent = title;
      overlay.appendChild(h2);

      const container = document.createElement("div");
      container.classList.add("target-candidates");

      candidates.forEach((champion) => {
        const card = document.createElement("div");
        card.classList.add("target-candidate");
        card.innerHTML = `
        <img src="${champion.portrait}" alt="${champion.name}">
        <h3>${champion.name}</h3>
        <p>HP: ${champion.HP}/${champion.maxHP}</p>
      `;
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          closeTargetOverlay(overlay);
          resolve(champion);
        });
        container.appendChild(card);
      });

      overlay.appendChild(container);

      // Click outside cancels the selection.
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          closeTargetOverlay(overlay);
          resolve(null);
        }
      });

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add("active"));
    });
  }

  function closeTargetOverlay(overlay) {
    overlay.classList.remove("active");
    setTimeout(() => overlay.remove(), 200);
  }

  return { collectClientTargets };
}
