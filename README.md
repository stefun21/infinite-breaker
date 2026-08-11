# Infinite Breaker · Supreme Edition

A premium, offline-ready brick-breaker roguelite built entirely with Next.js, React, TypeScript and Canvas. It needs no database, account, API key, paid asset or third-party runtime service.

## Supreme systems

- Campaign with lives, routes, checkpoints, refills, rarity-based upgrades, stacking, rerolls, cursed upgrades and build synergies.
- Zen, Time Attack, One Ball, Boss Rush, Chaos, Endless Tower, Mirror, Daily Seed and Custom modes.
- Combo meter, D-to-SSS Style Rank, precision hits, edge saves, Risk Drive and manual Overdrive.
- 15 advanced block families, multi-phase moving bosses, chain reactions and procedural events.
- 25 positive and 17 negative power-ups, power evolution and fusion combinations.
- Destruction particles, trails, damage states, depth motion, weather, screen shake, reactive borders and Perfect Clear presentation.
- Local collection, cosmetics, achievements, expanded records and last-ten-run history.
- Fullscreen, reduced motion, high contrast, colorblind symbols, automatic effect quality, interactive tutorial and anti-loop ball correction.
- Export/import for local saves and installable offline PWA support.
- Viewport-fit desktop and mobile UI. The mobile control surface below the arena moves the paddle without covering the action.

## Controls

- Mouse/finger anywhere on the arena: move paddle.
- Mobile touch zone below the arena: drag anywhere to move paddle.
- Arrow keys or A/D: move paddle.
- Space: activate a full Overdrive meter.
- R: toggle Risk Drive for higher speed and score.
- P or Escape: pause; Resume has a five-second countdown.

## Local development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

All progress is stored locally in the browser. The Settings screen can export it to a JSON file, import it on another device, or reset it after a confirmation step.
