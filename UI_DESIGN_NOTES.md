# Champion Showdown Arena — UI design notes

Visual layer written from scratch for the existing server-authoritative game: `public/index.html`,
eleven new stylesheets, one small i18n module. Game logic, networking, damage maths and the server
are untouched.

## 1. Direction: "Obsidian & Ember Codex"

A mythic arena. Near-black obsidian surfaces, brass trim as the chrome colour, ember orange for the
one thing that must be pressed (End Turn, ultimates). The champions' own element/class colours
(`applyIdentityPaletteCssVariables`) are the only saturated hues on the field, so the art leads.

Pillars:

1. **Combat state readable at a glance.** Side colour is by position, never by player identity:
   the local player is azure, the opponent crimson (plates, lineup panels, avatar rings). HP is
   green → amber → red, momentum is ember, shields are ice-blue, and status indicators sit on the oval portrait.
2. **Chrome recedes.** Panels are glass over the arena; brass is used for edges and primary actions only.
3. **Motion with purpose.** Entrances, the turn banner, dialog bubble, floating numbers (tiered by
   damage), game-over band. `prefers-reduced-motion` keeps every state change and drops the sweeping motion.
4. **Every state is designed:** hover, `:focus-visible`, active, disabled, hidden-until-ready
   (End Turn appears only once every slot is queued), empty (`?` tiles for the hidden opponent lineup).
5. **One token system** (`tokens.css`); no raw colours in components beyond effect glows.

Nothing on screen reveals hidden information early: the opponent lineup shows `?` tiles until the game
reveals them, and no element is styled from opponent-only data.

The lobby (hub), team card and Team Manager keep their own mint-on-black look. My neutrals share the
black base and the same Chakra Petch + Montserrat pairing, so moving between screens doesn't feel foreign.

## 2. Tokens (`public/styles/tokens.css`)

| Group | Tokens |
| --- | --- |
| Surfaces | `--ink-0 … --ink-5` |
| Brass / ember | `--brass-100 … 800`, `--ember-300 … 600`, `--brass-gradient`, `--ember-gradient`, `--panel-gradient`, `--chrome-border` |
| Sides | `--ally`, `--enemy` (+ `-deep`, `-glow`) |
| Semantic | `--positive`, `--negative`, `--warning`, `--neutral`, `--mint` |
| Text / lines | `--text-hi/mid/lo/on-brass`, `--line-soft/mid/hard`, `--glass-1/2`, `--scrim` |
| Type | `--font-display` / `--font-numeric` (Chakra Petch), `--font-body` (Montserrat), `--fs-2xs … 3xl` |
| Space / shape | `--sp-1 … 7` (4–48px), `--r-sm/md/lg/pill` |
| Elevation | `--shadow-1…3`, `--glow-brass`, `--glow-ember`, `--inset-bevel` |
| Motion | `--ease-out/in-out/spring`, `--dur-fast/med/slow` (120/220/420ms), `--focus-ring` |
| Layers | `--z-*`, consistent with the JS-owned layers: hub 1000, effect canvases 998/999/1300, `#webgl-container` 9999, quick-stats 13000, skill overlay + glossary 15000, emblem tooltip 20000 |

## 3. Component inventory

Stylesheets (link order in `index.html`): `base, shared, teamCard, hub` (pre-existing, unmodified), then
`tokens, ui-base, login, settings, match-stage, match-hud, lineup, champion, combat-fx, endgame, responsive`.

| File | Contents |
| --- | --- |
| `ui-base.css` | `.hidden` override, `.sr-only`, `.ui-btn` (+ `--primary/--brass/--danger/--ghost`), `.ui-icon-btn`, `.ui-panel`, `.ui-eyebrow`, `.ui-title`, `.ui-rule`, `.ui-input`, `.ui-select`, `.ui-switch`, `.ui-range`, `.ui-check`, `.ui-modal`, `.ui-modal-card`, scrollbars, focus ring |
| `login.css` | Login screen, crest, Google button, display-name step, disconnection message |
| `settings.css` | Cog button, settings modal (music/SFX toggles + sliders, language select) |
| `match-stage.css` | 1920×1080 design stage scaled by `--match-scale`, arena backdrop, field layout, halfway line |
| `match-hud.css` | Player plates, score + progress + stars + penalty, turn display, action bar, Skip/Undo/End Turn, surrender and log toggle, combat-log drawer + scrim |
| `lineup.css` | Lineup panels, `.lineup-chip`s, emblem rows, first-choice overlay, summon reminder |
| `champion.css` | Field champions (frameless oval glass portrait, no card), HP/momentum bars, status indicators, targeting states, skill overlay, quick-stats, glossary, ledger |
| `combat-fx.css` | Dialog bubble (+ ultimate), turn-transition banner, floating numbers (damage tiers 1–6, shield, heal, lifesteal, buff, taunt, resource), skill-affect glows, VFX canvas layering, finishing crack/flash, bleached |
| `endgame.css` | Surrender confirm, game-over band (win/lose/draw), post-match timer overlay and the five-tab stats panel |
| `responsive.css` | Portrait rotate prompt, phone-landscape tuning, reduced motion |

Stage model: `matchViewport.js` sets only `--match-scale`. `match-stage.css` supplies the fixed
1920×1080 size, centring and `transform: scale(var(--match-scale))`. A transformed stage becomes the
containing block for `position:fixed` descendants, so every window-spanning overlay (first choice,
summon reminder, surrender, game over, timer, rotate prompt, turn banner) is a **sibling** of
`#match-stage`, not a child. At phone-landscape sizes the stage renders at ~0.36×; `responsive.css`
raises design-px type and touch targets in `@media (max-height:560px)`.

## 4. Contract table

Source of truth: `node scripts/domContract.mjs` (634 lines of references). `--missing` now reports
only the following, none of which are defects:

| Reference | Status |
| --- | --- |
| `lineupBanner`, `lineupChips` (`main.js`) | Optional fallback ids. The markup defines `playerLineup*` and `opponentLineup*`, which the code uses. Left undefined on purpose; the lookup is guarded. |
| `tm-*` (`teamsManager.js`) | Belong to `teamsManager.html`, a read-only page. Not part of `index.html`. |

Everything else resolves in `index.html`. Ids defined, by area:

| Area | Ids |
| --- | --- |
| Login | `login-screen`, `login-message`, `google-login-btn`, `display-name-step`, `display-name-input`, `display-name-save-btn`, `disconnection-message` |
| Hub | `hub-*` from `preserved/hub-screen.fragment.html`, spliced in byte-for-byte (see §6) |
| Settings | `settings-btn`, `settings-overlay`, `settings-close`, `music-toggle`, `music-volume`, `sfx-toggle`, `sfx-volume`, `locale-select` |
| Match shell | `main-content`, `arena-backdrop`, `match-stage`, `surrender-btn`, `log-toggle-btn` |
| Plates | `player{1,2}-name-display`, `-score-display`, `-score-penalty`, `-progress-fill`, `-stars` |
| Lineups | `playerLineup{Banner,Chips,Emblems}`, `opponentLineup{Banner,Chips,Emblems}` |
| Actions | `skip-slot-btn`, `undo-actions-btn`, `end-turn-btn` |
| Feedback | `combat-dialog`, `combat-dialog-text`, `turnTransitionOverlay`, `turnTransitionNumber` |
| Log | `combat-log`, `combat-log-drawer`, `combat-log-close`, `combat-log-scrim` |
| Overlays | `firstChoice{Overlay,Chips,Cancel}`, `summonReminder{Overlay,Chips,DontShow,Dismiss}`, `surrender-{overlay,cancel,confirm}` |
| End of match | `gameOverOverlay`, `gameOverMessage`, `timerOverlay`, `matchStatsPanel` + five `matchStats*Body`, `returnToLoginCountdown`, `returnToLoginBtn` |
| Misc | `rotate-overlay`, `rotate-overlay-text`, `webgl-container` |

Classes the JS toggles that are styled: `.hidden`, `.active`, `.leaving`, `.ultimate`, `.is-visible`,
`.is-changing`, `.is-leaving`, `.win/.lose/.draw` (+ `-background`), `.materializing`, `.arriving`,
`.dying`, `.unmaking`, `.evasion`, `.lifesteal`, `.lifesteal-drained`, `.taunt`, `.buff`, `.heal`,
`.damage`, `.skill-affect-glow*`, `.match-view`, `.log-open`, `.match-portrait`, `.is-bleached`,
`.finishing-*`, `.vfx-canvas` / `.vfx-<type>`. Canvas VFX hosts follow the sizing each effect module
measures: the shield, fire stance, molted, crimson frenzy and bleached canvases bleed 20px past the
portrait wrapper; the frozen, concealed, invisible, water-bubble and mark canvases fit it exactly.

### Field champion (revised after design feedback)

A champion that is "taking the field" (summoned this turn, cannot act yet) has its art fully greyscale
(`.champion.is-taking-the-field .portrait img`) plus the brass pulsing rim and the lock tag, so "can't act" reads at a glance.

A champion has a body on the field, so it is **not drawn as a card**: no rectangular frame, only a frameless
oval glass portrait (`.portrait`, 4:5, `border-radius:50%`) with a conic idle shimmer that travels along the
rim (`@property --sweep`, per-champion `animation-delay`s) and a specular crescent (`::after`). The art fills
the oval, so it is ~40% larger than in the first card version. Markup is unchanged (`championUI.js` untouched).

- Size: `.champion` is `12em` wide (summons `9em`), `font-size: calc(16px * --card-scale)`. A second team row sets
  `--card-scale: 0.49` and gives the numbers extra size back (`1.85em`), so 8 champions per team still fit and read.
- HP and momentum numbers are `1.35em` (bars `1em` / `.75em`); 8-champion fields use larger relative text.
- Animation contract kept: damage/heal/lifesteal/evasion/buff/taunt/dying still animate the `.champion` element
  (`waitForAnimation` listens for `animationend`). Static glows (damage, taunt, shield) are on `.portrait` via
  `--portrait-shadow`; animated glows use `drop-shadow` inside the keyframes. `.skill-affect-glow` is an oval hugging the portrait.
- Layout: arena rows `minmax(0,1.32fr) 92px minmax(0,1fr)` because the local (top) band also carries the action bar.
  The action bar is taller (header 18px, skill buttons 62px / 19px) and Skip/Undo text is 15% larger.
  On phone-landscape the skill buttons drop their min-width so all five stay on one line.
- **Action bar is always one row.** It spans the full field width; skill buttons share the free space
  (`flex: 1 1 auto`) and a name that still doesn't fit (e.g. Tharox's "Apotheosis of the Monolith") is cut with "…"
  (`overflow:hidden; text-overflow:ellipsis`). A wrapped second row used to push the top champion under the turn banner.
- **Portrait inspection overlay**: centred with `inset:0; margin:auto` (never `transform`, which would shrink the fixed
  `::before` scrim to the card and make outside clicks unable to close it). The ✕ is a CSS `::after`; JS treats a click on
  the overlay element itself as "close", so ✕, outside click and Esc all work.
- **Phone landscape (mobile-first caveats)**: the 1920x1080 stage renders at ~0.36x on 844x390, so `responsive.css`
  raises design-px sizes (champion font 16.5px base, stat numbers 1.6em; 8-champion fields use `--card-scale: 0.4` and
  2.9em numbers), compacts the action bar, and shrinks the inspection card to fit a ~360-430px tall window.
  Known limits: 8-champion fields are small on phones, the 16:9 stage is letterboxed on ~19.5:9 screens (fixing it needs
  `matchViewport.js`, JS), and only Playwright emulation (844x390, 667x375) was tested, no real device.
- **Action bar is always one row.** It spans the full field width; skill buttons share the free space
  (`flex: 1 1 auto`) and a name that still doesn't fit (e.g. Tharox's "Apotheosis of the Monolith") is cut with "…"
  (`overflow:hidden; text-overflow:ellipsis`). A wrapped second row used to push the top champion under the turn banner.
- **Portrait inspection overlay**: centred with `inset:0; margin:auto` (never `transform`, which would shrink the fixed
  `::before` scrim to the card and make outside clicks unable to close it). The ✕ is a CSS `::after`; JS treats a click on
  the overlay element itself as "close", so ✕, outside click and Esc all work.
- **Phone landscape (mobile-first caveats)**: the 1920x1080 stage renders at ~0.36x on 844x390, so `responsive.css`
  raises design-px sizes (champion font 16.5px base, stat numbers 1.6em; 8-champion fields use `--card-scale: 0.4` and
  2.9em numbers), compacts the action bar, and shrinks the inspection card to fit a ~360-430px tall window.
  Known limits: 8-champion fields are small on phones, the 16:9 stage is letterboxed on ~19.5:9 screens (fixing it needs
  `matchViewport.js`, JS), and only Playwright emulation (844x390, 667x375) was tested, no real device.

## 5. Interaction details worth knowing

- `showOverlay` removes `.hidden` and adds `.active` in the same frame, so entrances are keyframes,
  not transitions. `base.css` `.hidden` has no `!important`, so `ui-base.css` restates it.
- `#main-content` is never flex/grid (its visibility is toggled by the JS).
- `html { font-size: clamp(11px,1.4vw,14px) }` in `base.css` would shrink in-stage `rem`s, so the stage sets its own `font-size: 16px`.
- Global `i { pointer-events: none }` (from `base.css`) means icons never swallow clicks; icon buttons rely on it.
- The log drawer is operable by button, scrim, `L` and Escape (handled by `matchViewport.js`). While it is open the settings cog hides so the two controls don't share a corner.
- Language: static markup is translated by `i18n-static.js` (`data-i18n`, `data-i18n-aria`, a dictionary, and id/selector maps for the hub fragment), re-applied on `localechange`.

## 6. JS edits

| File | Change |
| --- | --- |
| `public/js/i18n-static.js` | **New** module (≈215 lines). Translates static markup EN/PT through the existing `getLocale()` / `localechange`. No game logic. |
| `public/index.html` | Loads it as `<script type="module" src="/js/i18n-static.js">` before `main.js`. |
| `src/analytics/supabaseAnalytics.js` | **New**, see §7: the import in `server.js` pointed at a missing file. Copied from the project owner's sibling checkout. Not a visual change. |
| Any other existing JS file | **None edited.** No class, `data-*`, `aria-*` or template changes were needed. |

Other new files: `scripts/index.template.html` is the template for `public/index.html` with a
`<!--HUB_FRAGMENT-->` marker. The page is produced by replacing the marker with
`preserved/hub-screen.fragment.html`, trimmed of trailing whitespace and otherwise unchanged. If you
edit the template, regenerate `index.html` the same way; if you edit `index.html` directly, apply the same change to the template.

Pre-existing files not modified: `base.css`, `shared.css`, `hub.css`, `teamCard.css`, all Team Manager
files, `teamCard.js`, `preserved/hub-screen.fragment.html`, the hub section of `main.js`, and everything under `src/` and `shared/`.

## 7. Verification

Run with Playwright (chromium) against a local instance. The flow was driven end to end:
hub → vs-AI → first choice → several turns (skills, targeting, queue, end turn, summon reminder) →
log drawer → settings → surrender confirm → game over → stats tabs.

| Check | Result |
| --- | --- |
| Console + page errors | None through the whole flow at 1920×1080, 1366×768, 844×390, 667×375 |
| Portrait | Rotate prompt shown, match input blocked as intended |
| Phone-landscape log drawer | Opens/closes, close button clear of the cog |
| EN → PT switch | Settings, hub, first choice, match HUD and surrender translated |
| Hub + `/teamsManager.html` | Unchanged; render and work |
| `node scripts/botSmoke.js` | Passes |
| `node scripts/domContract.mjs --missing` | Only the items in §4 |

### Environment disclosure

- Port 3000 was already held by a different server that is not this repository's. I left it alone and
  ran this repo's server on port **3517**.
- `src/server.js:58` imports `./analytics/supabaseAnalytics.js`, but `src/analytics/` does not exist in
  this checkout, so `npm start` / `npm run dev` crashed with `ERR_MODULE_NOT_FOUND`. During testing I
  worked around it with a Node loader shim kept outside the repository. Afterwards, because the game could
  not be started otherwise, I first added a no-op placeholder, then replaced it with the real module. The
  project owner (who wrote `CHALLENGE_PROMPT.md`) explicitly waived its "other copies" rule for exactly this
  one file, so `src/analytics/supabaseAnalytics.js` was copied verbatim from their sibling folder
  `Champion Showdown Arena`. Nothing else was read from that folder, and its UI was not looked at or used.
  `src/server.js` is not edited. The module only uploads results if `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise it logs one warning and skips the upload.
- `src/server.js:17` starts `livereload.createServer()` on the fixed port 35729, so only one copy of the
  server can run at a time: a second instance dies with `EADDRINUSE 35729`, whatever `PORT` is set to. I
  did not change it (the server is out of scope).
- `teamsManager.html:83` (read-only) injects `http://localhost:35729/livereload.js`. In this environment
  it produces one `ERR_CONNECTION_REFUSED` console error on that page only. It is not caused by the new layer.
- Test auth: the server's `editMode` (`enabled`, `autoLogin`) puts a Playwright session in the hub without
  Google sign-in, so the Google button and the display-name step were styled and checked statically but
  not driven through a real OAuth round trip.
- `.env` was never read or printed.

## 8. Not done / known gaps

- **Runtime strings are mostly English only.** Text written by JS (combat log lines, dialog text, skill
  overlays, stats labels written at runtime, `alert`/`confirm`) goes through the existing
  `resolveText(text, getLocale())` where the game already did that; I didn't touch that logic.
- **Native `alert` / `confirm`** calls in the JS are unstyled.
- **Two-row fields (5–8 champions)** shrink the portraits to ~94px wide at 1920×1080; the vertical band is the limit, so they are smaller than single-row champions by design. The Skip/Undo row sits on the arena's halfway line.
- **Eight-champion rows, stacked status indicators and floating-number clamping** were only exercised with the bot's default teams; a crowded field may need tuning.
- **Glossary, portrait overlay and quick-stats** placement were checked at the main sizes, not exhaustively on phones.
- **Return to login after the stats countdown** was not exercised end to end.
- **One unexplained ~100px stage shift** was seen once in a screenshot sequence (probably the log drawer or a screen shake) and did not reproduce.
- `perspective-team2` body class is unstyled (optional).
- `combat-fx.css` has a no-op `.resource-float-momentum.resource-float-gain::before { content: "" }`, kept as a hook.
- `.arena-backdrop-fallback` is a static CSS backdrop element in `index.html` that fades out when `arenaBackdrop.js` adds `arena-backdrop--live` (it does, once its canvas is running). If that canvas fails to start, the fallback stays visible, which is the intent.
- The mandated three.js 0.160.0 `<script>` tag logs a deprecation warning from three itself.
- No WebGL context is added for UI chrome and no shaders were written, so the `precision highp float` rule has nothing to apply to.

### Match stars
The star SVG is solid black and used as a CSS mask: empty stars are a soft slate fill (`#5b6072`, distinct from the blue/red score), earned stars are fully gold-filled with a glow. Phone landscape draws them at 48 design px.

### Status indicator stack counter
The stack/tier number is a coin pinned to the icon's lower-right: brass rim, dark outer ring, red (debuff) or green (`.is-positive`) glossy fill, white numeral with a heavy dark outline so it stays crisp at phone scale. The icon sits on a dark disc and is larger than before; phone landscape scales it 1.5x.

Sizing rule: `shared/ui/statusIndicator.js` sets an inline `font-size: 1.75em` on emoji-type indicators (Bleeding, Burning, Frozen...), so any em-based size inflated them. Every indicator dimension (disc, glyph, badge) now hangs off `--ind-unit`, a `@property`-registered `<length>` set on `.portrait` (1em, 1.5em on phone landscape) that resolves once and is inherited as pixels. The disc's `font-size` is `!important` to beat the inline value, so emoji, image and arrow indicators all render identically (46px disc at 1920x1080, 26px at 844x390).

Layering: `.status-indicator` is `z-index: 11`, above every per-champion VFX canvas (`vfxManager.js` sets those to inline `z-index: 10`: shield bubble, frozen, etc.), so a shield never covers a status icon.

Colour semantics: gold/yellow/ember is reserved for ultimates and Momentum. The Claim action uses violet instead (`#8b5cf6` family; the claim values in the skill overlay and the enemy-claim line on the portrait overlay use `#c3a4ff`).

Claim button: `.action-bar-skill-btn.claim` is a faceted hexagon with pointed left/right ends (`clip-path` polygon, tip size `--claim-tip`: 22px, 18px on phones). `clip-path` would cut a border or box-shadow, so the rim is the button's own gradient and an inset `::before` draws the slightly smaller face. Ultimate keeps its ember gradient.

JS edit (sync fix): `syncChampionFromSnapshot` in `public/js/animation/animsAndLogManager.js` now drops shields with `amount <= 0` from the snapshot it applies, the same filter `updateUI` already uses. The server leaves a fully absorbed shield in `runtime.shields` at amount 0 until the next turn's decay, so later per-event snapshots (heal, buff...) still listed it and the shield bubble flashed back until the end-of-action sync. Rendering only; no server or game-logic change. Root cause for a server-side cleanup, if wanted: `takeDamage` in `shared/core/championCombat.js` never prunes depleted shields.

Server edit (sync fix, root): `serializeVisualState` in `shared/core/Champion.js` no longer ships shields with `amount <= 0` in the per-event snapshots. The live `runtime.shields` is left untouched on purpose: Rakhana's skills read `shields.length > 0` as "has a shield", so pruning in `takeDamage` would change game rules. The client filter above stays as a second line of defence.

### Round 8 — dead champions in the line-up banner
`lineup.css` only. `.lineup-chip.is-dead` no longer applies the grey/dim `filter` to the whole chip (that filter also dimmed the red `::before` cross). The filter now sits on `.lineup-chip-inner` (art only), and `::before` draws a two-stroke vivid red X (corner to corner, 4px, red glow) above it, plus a red-tinted border. Applies to both the player's and the opponent's banners (same `.is-dead` class). No JS change.

### Round 9 — combat log size, team-coloured names in dialogs
- Combat log: drawer wider, body/turn-header/title fonts raised (stage px; phone variant in `responsive.css`).
- `combat-fx.css`: `span.team-N` (from `formatChampionName`) is bold azure for the local player's champion, bold crimson for the opponent's, inside `.combat-dialog-text` and `.combat-log`; `body.perspective-team2` swaps them so colours follow the viewer.
- JS edit (binding only): in `animsAndLogManager.js` the "X used Skill on Y" dialog now resolves the target through `formatChampionName(activeChampions.get(targetId))` instead of printing the server's raw `targetName`.

## Verified: local player is always on top (team 2 / mirrored arena)
Ran two real clients against each other (the second one is assigned team 2) at 1920×1080 and 844×390. For team 2: `.arena--mirrored` + `body.perspective-team2` are set, `.team-2` field, its plate, the "Your lineup" banner and the action bar are in the top half; the opponent is at the bottom; azure = local, crimson = opponent; no console errors. No CSS or JS changes were needed. Not covered: reconnect/resume mid-match as team 2 (the server re-sends `playerAssigned`, which re-applies the classes).

## Invisible vs Concealed: two readable "reduced visibility" looks
The old effects were a faint canvas shimmer. Each status now changes the portrait itself and has its own canvas, so the two cannot be confused at a glance, even at phone scale (~0.36x).
- **Invisible = glass.** Cold cyan/white. Art drops to ~40% opacity with a cyan glow on the frame and a rare cloak "glitch" (`invisible-ghost`); the canvas adds a glass tint, hologram scan lines, a diagonal glint sweep, rising motes and a marching dashed contour.
- **Concealed = shadow.** Dark violet-black. Art is dimmed and cooled (`concealed-breathe`), the canvas rolls banks of dark smoke across the face, darkens the rim with a vignette and pulses a dark ring with a violet inner ring.
- Files: `shared/vfx/statusCanvasKit.js` (new: fit-to-portrait, clamped-dt rAF loop, oval clip, sprite bakers), `invisibilityCanvas.js` and `concealedCanvas.js` (rewritten), `public/styles/combat-fx.css` (`.champion.is-invisible` / `.is-concealed` portrait rules, `prefers-reduced-motion` turns the CSS animations off).
- Cost: one 2D canvas per affected champion, sized to the portrait; glows/smoke/scan pattern/vignette are baked once and blitted; capped pools (20 motes, 11 smoke banks, 5 wisps); no `shadowBlur`, no per-particle gradients per frame, no WebGL context; the loop stops with the status.
- Verified in Chromium at 1920×1080 and 844×390 by forcing both statuses on the two field champions through `syncChampionVFX`: canvas box == portrait box, no console errors, the two look clearly different. Not covered: a real kit applying the status in a full match, and the duo/summoned-champion layouts.
