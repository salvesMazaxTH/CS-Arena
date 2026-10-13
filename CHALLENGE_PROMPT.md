# Challenge: design the UI of Champion Showdown Arena

This repository is a complete, working browser game, **Champion Showdown Arena (CSA)**, whose HTML and
CSS layer is missing. Your job is to **conceive, write and wire the whole visual layer** (HTML and CSS)
to the standard of a modern AAA game, with the visual identity you judge best fits *this* game.

All design decisions are yours: art direction, palette, typography, layout, motion, iconography.
This prompt deliberately gives no visual direction.

Work only inside this repository. Do not search the machine for other copies, versions, backups or
earlier designs of this project, and do not use git history; design from what is here.

---

## 1. The game

CSA is a turn-based, server-authoritative 1v1 browser game (Node + Express + socket.io, Supabase
auth/teams, vanilla ES-module client, Three.js for effects). Read
`readme/GAME_ARCHITECTURE_v6_4 (current).md` for the rules, flow and client structure.

## 2. Existing pages you must keep working

Two parts of the UI already exist and are **read-only**: the Team Manager page and the pre-match lobby (hub).

| Part | Files |
|---|---|
| Team Manager | `public/teamsManager.html`, `public/js/teamsManager.js`, `public/js/teamsManager/*`, `public/styles/teamsManager.css` |
| Team card component | `public/js/ui/teamCard.js`, `public/styles/teamCard.css` |
| Lobby (hub) | `public/styles/hub.css`, markup in `preserved/hub-screen.fragment.html`, logic in the hub section of `public/js/main.js` |
| Global reset and `.hidden` / `.visible` | `public/styles/base.css` |
| Rules those pages depend on | `public/styles/shared.css` |

* Do not edit these files. You may add new files and new rules.
* Paste `preserved/hub-screen.fragment.html` into your `public/index.html` verbatim (same ids and classes).
* The lobby and the Team Manager must keep working.

## 3. What you must create

1. `public/index.html`: the full document and every screen, overlay and container the JS expects.
2. Stylesheets under `public/styles/`, split as you see fit, linked from `index.html`
   (keep `base.css`, `hub.css`, `teamCard.css` and `shared.css` linked too).
3. Any JS changes strictly needed to bind the visuals (see section 6).
4. `UI_DESIGN_NOTES.md` at the repo root: your design pillars, tokens, component inventory,
   every JS edit you made, and anything you could not do and why.

### Document boilerplate the JS needs

```html
<!-- head: boxicons is required (the existing pages and the JS emit "bx bx-*" icon classes) -->
<link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet" />
<!-- fonts: your choice -->

<!-- end of body, in this order -->
<div id="webgl-container" style="position:fixed;inset:0;pointer-events:none;z-index:9999;mix-blend-mode:screen"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js"></script>
<script type="importmap">
  { "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
      "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2" } }
</script>
<script src="/socket.io/socket.io.js"></script>
<script src="/config.js"></script>
<script type="module" src="/js/main.js"></script>
```

## 4. Discovering the markup contract

The JS is the specification of the markup. Run:

```bash
node scripts/domContract.mjs            # every id / selector / class the client JS touches, per file
node scripts/domContract.mjs --missing  # ids the JS needs that public/index.html does not define yet
```

Then read the code that builds markup dynamically (template strings, `createElement`) in
`public/js/**` and `shared/**`, and look at `public/assets/**` and `shared/data/**` for the content
you will be presenting. Every id, class, `dataset` key and toggled state the JS uses must exist in your
markup or be created by the JS, and must be styled. Keep a contract table in your notes.

## 5. Goal

* AAA quality: cohesive, legible, polished, with complete interaction states and purposeful motion.
* A visual identity specific to this game.
* Every screen the JS can show is designed: derive the list from the contract, do not assume it.

## 6. Technical constraints

1. Vanilla HTML/CSS/ES modules, served as is. No build step, no new runtime dependencies.
2. The match screen is scaled by `public/js/ui/matchViewport.js`; read it and lay the match out accordingly.
3. The project already runs a few WebGL contexts for effects. Do not add more for UI chrome.
4. Shaders, if you write any, must declare `precision highp float`.
5. JS edits are limited to binding visuals (classes, `data-*`, wrapper elements in templates, `aria-*`).
   Do not change game logic, networking, damage maths or the server. List every edit in your notes.
6. Code, comments and identifiers are in English. Player-facing text is bilingual (EN/PT) through the
   existing i18n layer; do not hard-code one language where the JS fills text at runtime.
7. Nothing on screen may reveal hidden information (for example the opponent's queued actions)
   before the game itself would.

## 7. Running and verifying

```bash
npm start   # = node src/server.js; the console prints the port it binds
```

* `.env` holds the Supabase keys: never print or commit it.
* The hub offers a vs-AI match, so you can reach the match screens alone. `node scripts/botSmoke.js`
  exercises the bot headlessly.
* Drive the real flow with Playwright, take screenshots at several viewport sizes (desktop and a phone in
  landscape), look at them and iterate.
* Zero console errors and no missing DOM lookups.

## 8. Acceptance

1. The whole flow plays through with no runtime errors or missing elements.
2. Everything the JS references is defined and styled; the contract table is delivered.
3. The lobby and Team Manager still work.
4. The result is legible and responsive.
5. `UI_DESIGN_NOTES.md` is honest about what is done, what is not, and every JS edit.

Start by running the contract script and reading the architecture doc, then write your design pillars,
then build screen by screen, verifying each with screenshots.
