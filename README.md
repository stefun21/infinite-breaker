# Infinite Breaker

Infinite Breaker is a retro pixel-art brick breaker with two ways to play:

- **Campaign:** five lives, branching routes, a full refill and upgrade every ten structures, and a permanent local high score.
- **Casual:** infinite retries with Chill, Classic, and Chaos presets.

The game is entirely client-side. Progress, settings, high scores, and statistics are stored in the browser with `localStorage`. No account, database, API, or third-party service is required while playing.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local address shown in the terminal.

## Production build

For Vercel, `vercel.json` selects the standard Next.js build:

```bash
npx next build
```

## Controls

- Mouse or touch: move the paddle directly.
- Arrow keys or A/D: move the paddle.
- P or Escape: pause; resuming starts a five-second countdown.
- Balls launch automatically in a different random upward direction each time.

## Current milestone

This is the finished `v1.0` archive. It includes Campaign and Casual modes, branching routes, local stats, high-score notification, special bricks, positive and negative drops, synthesized arcade audio, responsive controls, both progress displays, ten procedural geometric layout families, five rotating visual worlds, rare events, a subtle animated playfield, safe local-data reset, auto-pause when the tab is hidden, and a five-second resume countdown.
