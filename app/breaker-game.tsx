"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunSession, UpgradeId } from "./page";

const W = 960;
const H = 620;
const GOOD = ["expand", "double", "triple", "slow", "sticky", "fireball", "bomb", "shield", "laser", "magnet"] as const;
const BAD = ["shrink", "turbo", "gravity", "heavy", "repair", "drain", "curve"] as const;
type PowerKind = (typeof GOOD)[number] | (typeof BAD)[number] | "life";
type BrickType = "normal" | "reinforced" | "power" | "glass" | "explosive" | "moving" | "armored" | "core" | "heart";

interface Ball { x: number; y: number; vx: number; vy: number; r: number; stuckUntil: number; }
interface Brick { id: number; x: number; y: number; w: number; h: number; hp: number; maxHp: number; type: BrickType; vx: number; hiddenPower: boolean; power?: PowerKind; }
interface Drop { x: number; y: number; vy: number; kind: PowerKind; good: boolean; pulse: number; }
interface Bullet { x: number; y: number; }

interface EffectState {
  expand: number; shrink: number; slow: number; sticky: number; fireball: number; bomb: number;
  laser: number; magnet: number; turbo: number; gravity: number; heavy: number; curve: number;
}

interface GameRuntime {
  paddleX: number;
  targetX: number;
  paddleW: number;
  balls: Ball[];
  bricks: Brick[];
  drops: Drop[];
  bullets: Bullet[];
  score: number;
  lives: number;
  shield: number;
  effects: EffectState;
  lastTime: number;
  levelStart: number;
  lastLaser: number;
  announcedHigh: boolean;
  ended: boolean;
  bricksBroken: number;
  powerupsCaught: number;
  combo: number;
  keys: Set<string>;
}

interface Props {
  session: RunSession;
  highScore: number;
  settings: { music: boolean; sfx: boolean; reducedMotion: boolean };
  onHighScore: (score: number) => void;
  onLevelClear: (result: { score: number; lives: number; bricks: number; powerups: number }) => void;
  onGameOver: (result: { score: number; level: number; bricks: number; powerups: number }) => void;
  onExit: (snapshot?: { score: number; lives: number }) => void;
}

interface WorldTheme {
  name: string;
  background: string;
  grid: string;
  haze: [string, string];
  accent: string;
  paddle: string;
  bricks: Record<BrickType, string>;
}

const WORLD_THEMES: WorldTheme[] = [
  { name: "SUNSET GRID", background: "#0e0a20", grid: "rgba(255,93,143,.09)", haze: ["rgba(255,93,143,.13)", "rgba(255,184,77,.08)"], accent: "#ff5d8f", paddle: "#ffb84d", bricks: { normal: "#ff5d8f", reinforced: "#ffb84d", power: "#7cffcb", glass: "#6ee7ff", explosive: "#ff6b35", moving: "#a78bfa", armored: "#49506f", core: "#fff1a6", heart: "#ff3f74" } },
  { name: "LASER DISTRICT", background: "#061528", grid: "rgba(60,217,255,.10)", haze: ["rgba(55,214,255,.14)", "rgba(255,63,116,.07)"], accent: "#38d9ff", paddle: "#ff4f9a", bricks: { normal: "#38d9ff", reinforced: "#6f8cff", power: "#ffe66d", glass: "#b8f5ff", explosive: "#ff4f9a", moving: "#9b6dff", armored: "#344965", core: "#ffffff", heart: "#ff3f74" } },
  { name: "VIOLET VAULT", background: "#170829", grid: "rgba(176,92,255,.11)", haze: ["rgba(176,92,255,.16)", "rgba(124,255,203,.06)"], accent: "#b05cff", paddle: "#7cffcb", bricks: { normal: "#b05cff", reinforced: "#ff73c9", power: "#7cffcb", glass: "#9feaff", explosive: "#ff8a4c", moving: "#7d7cff", armored: "#4e3c65", core: "#fff1a6", heart: "#ff4f8a" } },
  { name: "MINT CIRCUIT", background: "#071c1b", grid: "rgba(124,255,203,.10)", haze: ["rgba(124,255,203,.14)", "rgba(255,184,77,.06)"], accent: "#7cffcb", paddle: "#ffb84d", bricks: { normal: "#7cffcb", reinforced: "#32d9b2", power: "#ffe66d", glass: "#b8fff0", explosive: "#ff7b54", moving: "#45b7d1", armored: "#355b58", core: "#fff1d6", heart: "#ff5d8f" } },
  { name: "GOLDEN CORE", background: "#211405", grid: "rgba(255,209,102,.10)", haze: ["rgba(255,184,77,.16)", "rgba(255,93,143,.07)"], accent: "#ffd166", paddle: "#ff5d8f", bricks: { normal: "#ffd166", reinforced: "#ff9f43", power: "#7cffcb", glass: "#fff1b8", explosive: "#ff5d5d", moving: "#d990ff", armored: "#68573f", core: "#ffffff", heart: "#ff3f74" } },
];

function themeFor(level: number) { return WORLD_THEMES[Math.floor((level - 1) / 10) % WORLD_THEMES.length]; }

function eventFor(level: number) {
  if (level % 10 === 0) return "CORE BOSS";
  if (level % 11 === 0) return "POWER SURGE";
  if (level % 9 === 0) return "GLASS GARDEN";
  if (level % 8 === 0) return "BOMB GRID";
  if (level % 7 === 0) return "MOVING LINES";
  return null;
}

const POWER_LABEL: Record<PowerKind, string> = {
  expand: "WIDE", double: "×2", triple: "×3", slow: "SLOW", sticky: "STICK", fireball: "FIRE",
  bomb: "BOMB", shield: "SHIELD", laser: "LASER", magnet: "MAG", life: "LIFE",
  shrink: "SMALL", turbo: "FAST", gravity: "GRAV", heavy: "HEAVY", repair: "REPAIR", drain: "DRAIN", curve: "CURVE",
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasUpgrade(upgrades: UpgradeId[], id: UpgradeId) { return upgrades.includes(id); }

function choosePower(rng: () => number, session: RunSession, forceGood = false): PowerKind {
  if (session.mode === "campaign" && rng() < (hasUpgrade(session.upgrades, "heart-hunter") ? 0.11 : 0.035)) return "life";
  const goodChance = forceGood || !session.badPowerups ? 1 : session.route === "safe" ? 0.82 : session.route === "risky" ? 0.58 : 0.7;
  if (rng() < goodChance) return GOOD[Math.floor(rng() * GOOD.length)];
  return BAD[Math.floor(rng() * BAD.length)];
}

function generateBricks(session: RunSession): Brick[] {
  const seed = session.level * 7919 + (session.route === "safe" ? 17 : session.route === "risky" ? 71 : 43);
  const rng = mulberry32(seed);
  const cols = 11 + Math.min(3, Math.floor(session.level / 12));
  const rows = 7 + Math.min(3, Math.floor(session.level / 15));
  const gap = 6;
  const bw = Math.floor((820 - gap * (cols - 1)) / cols);
  const bh = 24;
  const startX = (W - (bw * cols + gap * (cols - 1))) / 2;
  const startY = 74;
  const layout = session.level % 10;
  const event = eventFor(session.level);
  const bricks: Brick[] = [];
  let id = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const nx = Math.abs(col - (cols - 1) / 2) / (cols / 2);
      const ny = row / rows;
      let present = true;
      if (layout === 0) present = (row + col) % 2 === 0 || row > rows - 3;
      if (layout === 1) present = nx < 0.2 + ny * 0.9 || row === 0;
      if (layout === 2) present = nx + Math.abs(ny - 0.45) < 0.94;
      if (layout === 3) present = row % 2 === 0 || col === 0 || col === cols - 1;
      if (layout === 4) present = nx < 0.82 && !(row > 1 && row < rows - 2 && nx < 0.28);
      if (layout === 5) present = Math.abs(nx + Math.abs(ny - 0.48) - 0.64) < 0.28 || row === rows - 1;
      if (layout === 6) present = Math.abs(col - row * (cols / rows)) < 1.4 || Math.abs((cols - 1 - col) - row * (cols / rows)) < 1.4;
      if (layout === 7) present = row >= Math.floor((col % Math.ceil(cols / 3)) / Math.ceil(cols / 3) * rows) || row === 0;
      if (layout === 8) present = Math.abs(row - (rows * 0.48 + Math.sin(col * 0.85) * rows * 0.28)) < 1.8;
      if (layout === 9) present = (col < cols * 0.34 || col > cols * 0.66) && !(row === 1 && col % 2 === 0);
      if (!present || rng() < 0.04) continue;

      const roll = rng();
      let type: BrickType = "normal";
      if (roll < 0.055) type = "power";
      else if (roll < 0.10) type = "reinforced";
      else if (roll < 0.135) type = "explosive";
      else if (roll < 0.17) type = "glass";
      else if (roll < 0.20 && session.level > 2) type = "moving";
      else if (roll < 0.225 && session.level > 4) type = "armored";
      else if (roll < 0.24 && session.mode === "campaign") type = "heart";

      if (event === "POWER SURGE" && rng() < 0.28) type = "power";
      if (event === "GLASS GARDEN" && type === "normal" && rng() < 0.56) type = "glass";
      if (event === "BOMB GRID" && type === "normal" && rng() < 0.42) type = "explosive";
      if (event === "MOVING LINES" && type === "normal" && rng() < 0.44) type = "moving";

      const tougher = session.route === "risky" && rng() < 0.16;
      if (tougher && type === "normal") type = "reinforced";
      const hp = type === "armored" ? 999 : type === "reinforced" ? (session.level > 20 ? 3 : 2) : 1;
      bricks.push({
        id: id++, x: startX + col * (bw + gap), y: startY + row * (bh + gap), w: bw, h: bh,
        hp, maxHp: hp, type, vx: type === "moving" ? (rng() > 0.5 ? 26 : -26) : 0,
        hiddenPower: type === "normal" && rng() < (hasUpgrade(session.upgrades, "lucky-bricks") ? 0.095 : 0.05),
        power: type === "power" || type === "heart" ? (type === "heart" ? "life" : choosePower(rng, session, event === "POWER SURGE")) : undefined,
      });
    }
  }

  if (session.level % 10 === 0) {
    const center = bricks.reduce((best, brick) => Math.abs(brick.x + brick.w / 2 - W / 2) < Math.abs(best.x + best.w / 2 - W / 2) ? brick : best, bricks[0]);
    if (center) { center.type = "core"; center.hp = 4 + Math.floor(session.level / 20); center.maxHp = center.hp; center.power = "shield"; }
  }
  return bricks;
}

function initialRuntime(session: RunSession): GameRuntime {
  const baseW = hasUpgrade(session.upgrades, "wide-start") || session.casualStyle === "chill" ? 168 : 132;
  const speed = session.route === "safe" ? 330 : session.route === "risky" ? 430 : 375;
  const angle = -Math.PI * 0.36;
  const first: Ball = { x: W / 2, y: H - 70, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 7, stuckUntil: performance.now() + 650 };
  const balls = [first];
  if (hasUpgrade(session.upgrades, "ball-insurance")) balls.push({ ...first, vx: -first.vx });
  const now = performance.now();
  return {
    paddleX: W / 2, targetX: W / 2, paddleW: baseW, balls, bricks: generateBricks(session), drops: [], bullets: [],
    score: session.score, lives: session.lives, shield: hasUpgrade(session.upgrades, "safety-net") ? 1 : 0,
    effects: { expand: 0, shrink: 0, slow: 0, sticky: 0, fireball: hasUpgrade(session.upgrades, "strong-start") ? now + 8000 : 0, bomb: 0, laser: 0, magnet: 0, turbo: 0, gravity: 0, heavy: 0, curve: 0 },
    lastTime: now, levelStart: now, lastLaser: 0, announcedHigh: false, ended: false, bricksBroken: 0, powerupsCaught: 0, combo: 0, keys: new Set(),
  };
}

class MiniSynth {
  ctx: AudioContext | null = null;
  musicTimer: number | null = null;
  step = 0;
  ensure() { if (!this.ctx) this.ctx = new AudioContext(); if (this.ctx.state === "suspended") void this.ctx.resume(); }
  tone(freq: number, duration: number, volume = 0.025, type: OscillatorType = "square") {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
  startMusic() {
    if (this.musicTimer) return;
    const notes = [110, 110, 164.8, 146.8, 110, 220, 164.8, 146.8];
    this.musicTimer = window.setInterval(() => { this.tone(notes[this.step++ % notes.length], 0.24, 0.012, "triangle"); }, 280);
  }
  stop() { if (this.musicTimer) window.clearInterval(this.musicTimer); this.musicTimer = null; }
}

export function BreakerGame({ session, highScore, settings, onHighScore, onLevelClear, onGameOver, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<GameRuntime | null>(null);
  const synth = useRef(new MiniSynth());
  const [hud, setHud] = useState({ score: session.score, lives: session.lives, balls: 1, combo: 0, bricksLeft: 0, totalBricks: 0 });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [toast, setToast] = useState("");
  const callbacks = useRef({ onHighScore, onLevelClear, onGameOver });
  const initialHigh = useRef(highScore);
  const worldTheme = themeFor(session.level);
  const levelEvent = eventFor(session.level);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { callbacks.current = { onHighScore, onLevelClear, onGameOver }; }, [onHighScore, onLevelClear, onGameOver]);

  const audioReady = useCallback(() => {
    synth.current.ensure();
    if (settings.music) synth.current.startMusic();
  }, [settings.music]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const synthEngine = synth.current;
    const g = initialRuntime(session);
    const theme = themeFor(session.level);
    runtime.current = g;
    let record = initialHigh.current;
    let frame = 0;
    let hudTimer = 0;

    const duration = (good: boolean) => (good && hasUpgrade(session.upgrades, "power-duration") ? 1.35 : !good && hasUpgrade(session.upgrades, "curse-resistance") ? 0.6 : 1);
    const isGood = (kind: PowerKind) => (GOOD as readonly string[]).includes(kind) || kind === "life";
    const active = (kind: keyof EffectState, now: number) => g.effects[kind] > now;

    const spawnBall = (delay = 650) => {
      const speed = session.route === "safe" ? 330 : session.route === "risky" ? 430 : 375;
      g.balls.push({ x: g.paddleX, y: H - 70, vx: speed * 0.62, vy: -speed * 0.78, r: 7, stuckUntil: performance.now() + delay });
    };

    const addScore = (amount: number) => {
      const routeMultiplier = session.route === "safe" ? 0.85 : session.route === "risky" ? 1.5 : 1;
      g.score += Math.round(amount * routeMultiplier * Math.max(1, 1 + Math.floor(g.combo / 8) * 0.25));
      if (g.score > record && !g.announcedHigh) {
        g.announcedHigh = true; setToast("NEW HIGH SCORE!");
        window.setTimeout(() => setToast(""), 2300);
      }
      if (g.score > record) { record = g.score; callbacks.current.onHighScore(g.score); }
    };

    const dropPower = (brick: Brick, forced?: PowerKind) => {
      const rng = mulberry32(brick.id * 97 + session.level * 1031 + Math.round(g.score));
      const kind = forced ?? choosePower(rng, session);
      g.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: 125, kind, good: isGood(kind), pulse: rng() * 6 });
    };

    const destroyBrick = (brick: Brick, chain = false) => {
      if (brick.hp <= 0 || brick.type === "armored") return;
      brick.hp = 0; g.bricksBroken++; g.combo++; addScore(brick.type === "core" ? 600 : brick.type === "reinforced" ? 180 : 100);
      if (settings.sfx) synth.current.tone(brick.type === "explosive" ? 90 : 240 + (brick.id % 5) * 45, 0.08, 0.02);
      if (brick.power) dropPower(brick, brick.power);
      else if (brick.hiddenPower) dropPower(brick);
      if ((brick.type === "explosive" || brick.type === "glass" || active("bomb", performance.now())) && !chain) {
        const radius = brick.type === "glass" ? 75 : 105;
        for (const other of g.bricks) {
          const dx = other.x + other.w / 2 - (brick.x + brick.w / 2);
          const dy = other.y + other.h / 2 - (brick.y + brick.h / 2);
          if (other.hp > 0 && Math.hypot(dx, dy) < radius) destroyBrick(other, true);
        }
      }
    };

    const hitBrick = (brick: Brick) => {
      if (brick.type === "armored" || brick.hp <= 0) return;
      brick.hp--;
      if (brick.hp <= 0) { brick.hp = 1; destroyBrick(brick); }
      else { g.combo++; addScore(35); if (settings.sfx) synth.current.tone(170, 0.05, 0.015); }
    };

    const applyPower = (kind: PowerKind) => {
      const now = performance.now(); const good = isGood(kind); const ms = (good ? 11000 : 9000) * duration(good);
      g.powerupsCaught++; setToast(`${good ? "+" : "!"} ${POWER_LABEL[kind]}`); window.setTimeout(() => setToast(""), 1200);
      if (settings.sfx) synth.current.tone(good ? 660 : 115, 0.18, 0.035, good ? "square" : "sawtooth");
      if (kind === "expand") g.effects.expand = now + ms;
      if (kind === "shrink") g.effects.shrink = now + ms;
      if (kind === "slow") g.effects.slow = now + ms;
      if (kind === "turbo") g.effects.turbo = now + ms;
      if (kind === "sticky") g.effects.sticky = now + ms;
      if (kind === "fireball") g.effects.fireball = now + ms;
      if (kind === "bomb") g.effects.bomb = now + ms;
      if (kind === "laser") g.effects.laser = now + ms;
      if (kind === "magnet") g.effects.magnet = now + ms;
      if (kind === "gravity") g.effects.gravity = now + ms;
      if (kind === "heavy") g.effects.heavy = now + ms;
      if (kind === "curve") g.effects.curve = now + ms;
      if (kind === "shield") g.shield = Math.min(2, g.shield + 1);
      if (kind === "life") { if (session.mode === "campaign") g.lives = Math.min(7, g.lives + 1); else addScore(500); }
      if (kind === "drain") {
        g.effects.expand = g.effects.slow = g.effects.sticky = g.effects.fireball = g.effects.bomb = g.effects.laser = g.effects.magnet = 0;
      }
      if (kind === "repair") {
        const broken = g.bricks.filter((b) => b.hp === 0 && b.type !== "armored").slice(-4);
        for (const b of broken) b.hp = Math.min(b.maxHp, 1);
      }
      if (kind === "double" || kind === "triple") {
        const source = [...g.balls]; const copies = kind === "double" ? 1 : 2;
        for (const ball of source) for (let i = 0; i < copies && g.balls.length < 16; i++) {
          const angle = (i + 1) * (kind === "double" ? 0.32 : 0.27) * (i % 2 ? -1 : 1);
          const cos = Math.cos(angle), sin = Math.sin(angle);
          g.balls.push({ ...ball, vx: ball.vx * cos - ball.vy * sin, vy: ball.vx * sin + ball.vy * cos, stuckUntil: 0 });
        }
      }
    };

    const miss = () => {
      if (g.shield > 0) { g.shield--; spawnBall(300); return; }
      g.combo = 0;
      if (session.mode === "campaign") {
        g.lives--;
        if (g.lives <= 0) {
          g.ended = true;
          window.setTimeout(() => callbacks.current.onGameOver({ score: g.score, level: session.level, bricks: g.bricksBroken, powerups: g.powerupsCaught }), 350);
          return;
        }
      }
      spawnBall(650);
    };

    const update = (now: number, dt: number) => {
      const heavy = active("heavy", now);
      if (g.keys.has("ArrowLeft") || g.keys.has("KeyA")) g.targetX -= 520 * dt;
      if (g.keys.has("ArrowRight") || g.keys.has("KeyD")) g.targetX += 520 * dt;
      const baseW = hasUpgrade(session.upgrades, "wide-start") || session.casualStyle === "chill" ? 168 : 132;
      g.paddleW = active("expand", now) ? baseW * 1.55 : active("shrink", now) ? baseW * 0.62 : baseW;
      g.targetX = Math.max(g.paddleW / 2 + 14, Math.min(W - g.paddleW / 2 - 14, g.targetX));
      g.paddleX += (g.targetX - g.paddleX) * Math.min(1, dt * (heavy ? 4 : 20));

      const speedFactor = active("slow", now) ? 0.66 : active("turbo", now) ? 1.42 : 1;
      for (const brick of g.bricks) if (brick.hp > 0 && brick.type === "moving") {
        brick.x += brick.vx * dt; if (brick.x < 35 || brick.x + brick.w > W - 35) brick.vx *= -1;
      }

      for (const ball of g.balls) {
        if (ball.stuckUntil > now) { ball.x = g.paddleX; ball.y = H - 64; continue; }
        if (ball.stuckUntil !== 0) ball.stuckUntil = 0;
        if (active("gravity", now)) ball.vy += 75 * dt;
        if (active("curve", now)) {
          const a = Math.sin(now / 300) * 0.5 * dt, c = Math.cos(a), s = Math.sin(a);
          const vx = ball.vx; ball.vx = vx * c - ball.vy * s; ball.vy = vx * s + ball.vy * c;
        }
        ball.x += ball.vx * dt * speedFactor; ball.y += ball.vy * dt * speedFactor;
        if (ball.x - ball.r < 10) { ball.x = 10 + ball.r; ball.vx = Math.abs(ball.vx); }
        if (ball.x + ball.r > W - 10) { ball.x = W - 10 - ball.r; ball.vx = -Math.abs(ball.vx); }
        if (ball.y - ball.r < 10) { ball.y = 10 + ball.r; ball.vy = Math.abs(ball.vy); }

        const py = H - 52;
        if (ball.vy > 0 && ball.y + ball.r >= py && ball.y - ball.r <= py + 18 && ball.x >= g.paddleX - g.paddleW / 2 && ball.x <= g.paddleX + g.paddleW / 2) {
          const ratio = (ball.x - g.paddleX) / (g.paddleW / 2); const speed = Math.max(340, Math.hypot(ball.vx, ball.vy));
          ball.vx = speed * ratio * 0.88; ball.vy = -Math.sqrt(Math.max(9000, speed * speed - ball.vx * ball.vx)); ball.y = py - ball.r;
          if (active("sticky", now)) ball.stuckUntil = now + 850;
          if (settings.sfx) synth.current.tone(135, 0.05, 0.015);
        }

        for (const brick of g.bricks) {
          if (brick.hp <= 0) continue;
          const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
          const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
          const dx = ball.x - nearestX, dy = ball.y - nearestY;
          if (dx * dx + dy * dy <= ball.r * ball.r) {
            if (brick.type !== "armored") hitBrick(brick);
            if (!active("fireball", now) || brick.type === "armored") {
              if (Math.abs(dx) > Math.abs(dy)) ball.vx *= -1; else ball.vy *= -1;
            }
            break;
          }
        }
      }

      g.balls = g.balls.filter((ball) => ball.y - ball.r < H + 20);
      if (!g.balls.length && !g.ended) miss();

      if (active("laser", now) && now - g.lastLaser > 420) {
        g.lastLaser = now; g.bullets.push({ x: g.paddleX - g.paddleW / 2 + 12, y: H - 58 }, { x: g.paddleX + g.paddleW / 2 - 12, y: H - 58 });
      }
      for (const bullet of g.bullets) {
        bullet.y -= 560 * dt;
        for (const brick of g.bricks) if (brick.hp > 0 && bullet.x >= brick.x && bullet.x <= brick.x + brick.w && bullet.y >= brick.y && bullet.y <= brick.y + brick.h) {
          hitBrick(brick); bullet.y = -30; break;
        }
      }
      g.bullets = g.bullets.filter((b) => b.y > 0);

      for (const drop of g.drops) {
        drop.y += drop.vy * dt;
        if (active("magnet", now) && drop.good) drop.x += Math.sign(g.paddleX - drop.x) * 90 * dt;
        if (drop.y > H - 60 && drop.y < H - 28 && drop.x > g.paddleX - g.paddleW / 2 && drop.x < g.paddleX + g.paddleW / 2) { applyPower(drop.kind); drop.y = H + 50; }
      }
      g.drops = g.drops.filter((drop) => drop.y < H + 20);

      const breakableLeft = g.bricks.some((b) => b.hp > 0 && b.type !== "armored");
      if (!breakableLeft && !g.ended) {
        g.ended = true; addScore(1000 + session.level * 50);
        window.setTimeout(() => callbacks.current.onLevelClear({ score: g.score, lives: g.lives, bricks: g.bricksBroken, powerups: g.powerupsCaught }), 500);
      }
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = theme.background; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const horizon = ctx.createLinearGradient(0, 0, 0, H); horizon.addColorStop(0, theme.haze[0]); horizon.addColorStop(.45, "rgba(255,255,255,.015)"); horizon.addColorStop(1, theme.haze[1]);
      ctx.fillStyle = horizon; ctx.fillRect(0, 0, W, H);

      for (const brick of g.bricks) {
        if (brick.hp <= 0) continue;
        const color = theme.bricks[brick.type];
        ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(brick.x + 4, brick.y + 5, brick.w, brick.h);
        ctx.fillStyle = color; ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 3);
        ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(brick.x + 3, brick.y + brick.h - 5, brick.w - 6, 3);
        if (brick.type === "power") { ctx.fillStyle = "#0e0a20"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.fillText("?", brick.x + brick.w / 2, brick.y + 17); }
        if (brick.type === "heart") { ctx.fillStyle = "#fff"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.fillText("♥", brick.x + brick.w / 2, brick.y + 17); }
        if (brick.type === "reinforced" || brick.type === "core") {
          ctx.fillStyle = "#0e0a20"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.fillText(String(brick.hp), brick.x + brick.w / 2, brick.y + 16);
        }
        if (brick.type === "armored") { ctx.strokeStyle = "#8991b2"; ctx.lineWidth = 2; ctx.strokeRect(brick.x + 4, brick.y + 4, brick.w - 8, brick.h - 8); }
        if (brick.type === "explosive") { ctx.fillStyle = "#fff1a6"; ctx.fillRect(brick.x + brick.w / 2 - 3, brick.y + 6, 6, 12); ctx.fillRect(brick.x + brick.w / 2 - 7, brick.y + 10, 14, 4); }
      }

      for (const drop of g.drops) {
        const pulse = Math.sin(now / 120 + drop.pulse) * 2;
        ctx.fillStyle = drop.kind === "life" ? "#ff3f74" : drop.good ? "#7cffcb" : "#b05cff";
        ctx.fillRect(drop.x - 24 - pulse, drop.y - 10 - pulse / 2, 48 + pulse * 2, 20 + pulse);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(drop.x - 24 - pulse, drop.y - 10 - pulse / 2, 48 + pulse * 2, 20 + pulse);
        ctx.fillStyle = "#0e0a20"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText(POWER_LABEL[drop.kind], drop.x, drop.y + 4);
      }

      for (const bullet of g.bullets) { ctx.fillStyle = "#7cffcb"; ctx.fillRect(bullet.x - 2, bullet.y - 9, 4, 12); }

      const py = H - 52;
      ctx.fillStyle = "#05030c"; ctx.fillRect(g.paddleX - g.paddleW / 2 + 5, py + 7, g.paddleW, 18);
      ctx.fillStyle = active("shrink", now) ? "#b05cff" : theme.paddle; ctx.fillRect(g.paddleX - g.paddleW / 2, py, g.paddleW, 18);
      ctx.fillStyle = "#fff1a6"; ctx.fillRect(g.paddleX - g.paddleW / 2 + 7, py + 3, g.paddleW - 14, 4);
      if (g.shield > 0) { ctx.strokeStyle = "#7cffcb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, H - 14); ctx.lineTo(W - 20, H - 14); ctx.stroke(); }

      for (const ball of g.balls) {
        ctx.shadowBlur = 16; ctx.shadowColor = active("fireball", now) ? "#ff6b35" : theme.accent;
        ctx.fillStyle = active("fireball", now) ? "#fff1a6" : "#fff"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.textAlign = "left";
    };

    const loop = (now: number) => {
      const dt = Math.min(0.025, Math.max(0, (now - g.lastTime) / 1000)); g.lastTime = now;
      if (!pausedRef.current && !g.ended) update(now, dt);
      draw(now);
      if (now - hudTimer > 100) {
        hudTimer = now;
        const breakable = g.bricks.filter((brick) => brick.type !== "armored");
        setHud({
          score: g.score,
          lives: g.lives,
          balls: g.balls.length,
          combo: g.combo,
          bricksLeft: breakable.filter((brick) => brick.hp > 0).length,
          totalBricks: breakable.length,
        });
      }
      frame = requestAnimationFrame(loop);
    };

    const point = (clientX: number) => {
      const rect = canvas.getBoundingClientRect(); g.targetX = ((clientX - rect.left) / rect.width) * W;
    };
    const move = (e: PointerEvent) => point(e.clientX);
    const down = (e: PointerEvent) => { audioReady(); point(e.clientX); };
    const keyDown = (e: KeyboardEvent) => { g.keys.add(e.code); if (e.code === "Escape") setPaused((v) => !v); };
    const keyUp = (e: KeyboardEvent) => g.keys.delete(e.code);
    canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerdown", down);
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); synthEngine.stop();
    };
  }, [audioReady, session, settings.sfx]);

  const structureProgress = hud.totalBricks > 0
    ? Math.max(0, Math.min(100, Math.round(((hud.totalBricks - hud.bricksLeft) / hud.totalBricks) * 100)))
    : 0;

  return (
    <div className="game-page">
      <header className="game-hud">
        <button className="hud-exit" onClick={() => setPaused(true)}>Ⅱ</button>
        <div><span>MODE</span><strong>{session.mode.toUpperCase()}</strong></div>
        <div><span>STRUCTURE</span><strong>{String(session.level).padStart(2, "0")}</strong></div>
        <div className="hud-score"><span>SCORE</span><strong>{hud.score.toLocaleString("en-US").padStart(8, "0")}</strong></div>
        <div><span>HIGH</span><strong>{Math.max(highScore, hud.score).toLocaleString("en-US")}</strong></div>
        <div><span>{session.mode === "campaign" ? "LIVES" : "BALLS"}</span><strong>{session.mode === "campaign" ? "♥".repeat(Math.max(0, Math.min(7, hud.lives))) : hud.balls}</strong></div>
      </header>
      <section className="structure-progress" aria-label={`${hud.bricksLeft} destructible blocks remaining`}>
        <div className="progress-copy">
          <span>STRUCTURE PROGRESS</span>
          <strong>{hud.bricksLeft} BLOCKS LEFT</strong>
          <em>{structureProgress}% CLEARED</em>
        </div>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={structureProgress}>
          <i style={{ width: `${structureProgress}%` }} />
          <b>{structureProgress}%</b>
        </div>
      </section>
      <div className="game-frame">
        <canvas ref={canvasRef} width={W} height={H} aria-label="Infinite Breaker game area" />
        <div className="corner-label top-left">{session.route.toUpperCase()} ROUTE</div>
        <div className="corner-label top-right">COMBO {hud.combo}</div>
        <div className="world-label" style={{ borderColor: worldTheme.accent, color: worldTheme.accent }}>{worldTheme.name}</div>
        {levelEvent && <div className="event-label">EVENT · {levelEvent}</div>}
        {toast && <div className={`game-toast ${toast.includes("HIGH") ? "record" : ""}`}>{toast}</div>}
        {paused && (
          <div className="pause-overlay">
            <div className="pause-card"><p>GAME PAUSED</p><h2>TAKE FIVE</h2><button className="big-action" onClick={() => { audioReady(); setPaused(false); }}>RESUME</button><button className="text-button" onClick={() => onExit({ score: hud.score, lives: hud.lives })}>SAVE & EXIT</button></div>
          </div>
        )}
      </div>
      <footer className="game-footer"><span>AUTO-LAUNCH ENABLED</span><b>{session.mode === "campaign" ? `NEXT REFILL · ${10 - ((session.level - 1) % 10)} STRUCTURES` : `${session.casualStyle.toUpperCase()} · INFINITE PLAY`}</b><span>ESC TO PAUSE</span></footer>
    </div>
  );
}
