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
- Escape: pause.
- Balls launch automatically.

## Current milestone

This is the first playable archive (`v0.1`). It includes the selected visual direction, procedural geometric structures, Campaign and Casual modes, branching routes, local stats, high-score notification, special bricks, positive and negative drops, synthesized arcade audio, and responsive controls.
