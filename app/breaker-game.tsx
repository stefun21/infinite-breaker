"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cosmetics, GameSettings, RunSession, UpgradeId } from "./page";

const W = 960;
const H = 620;
const GOOD = ["expand", "double", "triple", "slow", "sticky", "fireball", "bomb", "shield", "laser", "magnet", "orbit", "ghost", "lightning", "blackhole", "timestop", "ricochet", "clone", "bottomwall", "drone", "shockwave", "lucky", "phoenix", "mega", "rainbow", "scorebank"] as const;
const BAD = ["shrink", "turbo", "gravity", "heavy", "repair", "drain", "curve", "invert", "fake", "drift", "fog", "glitch", "leak", "storm", "tiny", "bumper", "roulette"] as const;
type PowerKind = (typeof GOOD)[number] | (typeof BAD)[number] | "life";
type BrickType = "normal" | "reinforced" | "power" | "glass" | "explosive" | "moving" | "armored" | "core" | "heart" | "electric" | "ice" | "prism" | "gravityBlock" | "mirror" | "phantom" | "regenerator" | "parasite" | "switch" | "comboBlock" | "vault" | "corrupted" | "titan" | "mimic" | "golden";

interface Ball { x: number; y: number; vx: number; vy: number; r: number; stuckUntil: number; awaitingLaunch: boolean; autoLaunchAt: number; trail: Array<{ x: number; y: number; life: number }>; }
interface Brick { id: number; x: number; y: number; w: number; h: number; hp: number; maxHp: number; type: BrickType; vx: number; hiddenPower: boolean; power?: PowerKind; born: number; lastAction: number; }
interface Drop { x: number; y: number; vy: number; kind: PowerKind; good: boolean; pulse: number; }
interface Bullet { x: number; y: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface PowerHistoryItem { id: number; kind: PowerKind; good: boolean; expiresAt: number; instant: boolean; }

interface EffectState {
  expand: number; shrink: number; slow: number; sticky: number; fireball: number; bomb: number;
  laser: number; magnet: number; turbo: number; gravity: number; heavy: number; curve: number;
  orbit: number; ghost: number; lightning: number; blackhole: number; timestop: number; ricochet: number; clone: number;
  bottomwall: number; drone: number; shockwave: number; lucky: number; phoenix: number; mega: number; rainbow: number; scorebank: number;
  invert: number; fake: number; drift: number; fog: number; glitch: number; leak: number; storm: number; tiny: number; bumper: number; roulette: number;
}

interface GameRuntime {
  paddleX: number;
  targetX: number;
  paddleW: number;
  balls: Ball[];
  bricks: Brick[];
  drops: Drop[];
  bullets: Bullet[];
  particles: Particle[];
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
  maxCombo: number;
  maxBalls: number;
  livesSaved: number;
  overdrive: number;
  overdriveUntil: number;
  phoenixUsed: boolean;
  shake: number;
  timeLeft: number;
  powerCounts: Partial<Record<PowerKind, number>>;
  powerHistory: PowerHistoryItem[];
  nextPowerHistoryId: number;
  riskBoost: boolean;
  singleBrickSince: number;
  lightningAssist: { x: number; y: number; until: number } | null;
  keys: Set<string>;
}

interface Props {
  session: RunSession;
  highScore: number;
  settings: GameSettings;
  cosmetics: Cosmetics;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onHighScore: (score: number) => void;
  onLevelClear: (result: { score: number; lives: number; bricks: number; powerups: number; combo?: number; maxBalls?: number; clearMs?: number; boss?: boolean; livesSaved?: number }) => void;
  onGameOver: (result: { score: number; level: number; bricks: number; powerups: number; combo?: number; maxBalls?: number }) => void;
  onExit: (snapshot?: { score: number; lives: number }) => void;
}

interface WorldTheme {
  name: string;
  background: string;
  grid: string;
  haze: [string, string];
  accent: string;
  paddle: string;
  bricks: Partial<Record<BrickType, string>>;
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
  if (level % 10 === 0) return ["THE CORE", "THE SERPENT", "THE MIRROR", "THE FORGE", "THE VOID", "THE CLOCK", "THE COLLECTOR", "THE ARCHITECT"][Math.floor(level / 10 - 1) % 8];
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
  orbit: "ORBIT", ghost: "GHOST", lightning: "BOLT", blackhole: "VOID", timestop: "TIME", ricochet: "AIM", clone: "CLONE", bottomwall: "WALL", drone: "DRONE", shockwave: "WAVE", lucky: "LUCK", phoenix: "REBIRTH", mega: "MEGA", rainbow: "RAINBOW", scorebank: "BANK",
  invert: "INVERT", fake: "DECOY", drift: "DRIFT", fog: "FOG", glitch: "GLITCH", leak: "LEAK", storm: "STORM", tiny: "TINY", bumper: "BUMPER", roulette: "CURSE",
};

const INSTANT_POWERS = new Set<PowerKind>(["double", "triple", "shield", "life", "repair", "drain", "shockwave", "lightning", "lucky", "blackhole"]);

const SPECIAL_BRICKS: BrickType[] = ["electric", "ice", "prism", "gravityBlock", "mirror", "phantom", "regenerator", "parasite", "switch", "comboBlock", "vault", "corrupted", "titan", "mimic", "golden"];
const BRICK_SYMBOL: Partial<Record<BrickType, string>> = { electric: "ϟ", ice: "❄", prism: "△", gravityBlock: "◎", mirror: "↔", phantom: "◌", regenerator: "+", parasite: "÷", switch: "⇄", comboBlock: "×", vault: "▣", corrupted: "!", titan: "T", mimic: "?", golden: "★", core: "◆" };

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasUpgrade(upgrades: UpgradeId[], id: UpgradeId) { return upgrades.includes(id); }

function randomLaunchBall(x: number, speed: number, delay: number): Ball {
  const angleFromVertical = 0.34 + Math.random() * 0.48;
  const direction = Math.random() < 0.5 ? -1 : 1;
  return {
    x,
    y: H - 70,
    vx: Math.sin(angleFromVertical) * speed * direction,
    vy: -Math.cos(angleFromVertical) * speed,
    r: 7,
    stuckUntil: 0,
    awaitingLaunch: true,
    autoLaunchAt: performance.now() + Math.max(7000, delay),
    trail: [],
  };
}

function choosePower(rng: () => number, session: RunSession, forceGood = false): PowerKind {
  if (session.mode === "campaign" && rng() < (hasUpgrade(session.upgrades, "heart-hunter") ? 0.11 : 0.035)) return "life";
  const goodChance = forceGood || !session.badPowerups ? 1 : session.route === "safe" ? 0.82 : session.route === "risky" ? 0.58 : 0.7;
  if (rng() < goodChance) return GOOD[Math.floor(rng() * GOOD.length)];
  return BAD[Math.floor(rng() * BAD.length)];
}

function generateBricks(session: RunSession): Brick[] {
  const seed = (session.seed || 0) + session.level * 7919 + (session.route === "safe" ? 17 : session.route === "risky" ? 71 : 43);
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
      else if (roll < 0.36 && session.level > 2) type = SPECIAL_BRICKS[Math.floor(rng() * Math.min(SPECIAL_BRICKS.length, 4 + Math.floor(session.level / 4)))];

      if (event === "POWER SURGE" && rng() < 0.28) type = "power";
      if (event === "GLASS GARDEN" && type === "normal" && rng() < 0.56) type = "glass";
      if (event === "BOMB GRID" && type === "normal" && rng() < 0.42) type = "explosive";
      if (event === "MOVING LINES" && type === "normal" && rng() < 0.44) type = "moving";

      const tougher = session.route === "risky" && rng() < 0.16;
      if (tougher && type === "normal") type = "reinforced";
      const hp = type === "armored" ? 999 : type === "titan" ? 5 : type === "reinforced" || type === "regenerator" ? (session.level > 20 ? 3 : 2) : 1;
      bricks.push({
        id: id++, x: startX + col * (bw + gap), y: startY + row * (bh + gap), w: bw, h: bh,
        hp, maxHp: hp, type, vx: type === "moving" ? (rng() > 0.5 ? 26 : -26) : 0,
        hiddenPower: type === "normal" && rng() < (hasUpgrade(session.upgrades, "lucky-bricks") ? 0.095 : 0.05),
        power: type === "power" || type === "heart" || type === "golden" || type === "vault" ? (type === "heart" ? "life" : type === "golden" ? "rainbow" : type === "vault" ? "lucky" : choosePower(rng, session, event === "POWER SURGE")) : undefined,
        born: performance.now(), lastAction: 0,
      });
    }
  }

  if (session.level % 10 === 0) {
    const center = bricks.reduce((best, brick) => Math.abs(brick.x + brick.w / 2 - W / 2) < Math.abs(best.x + best.w / 2 - W / 2) ? brick : best, bricks[0]);
    if (center) { center.type = "core"; center.hp = 9 + Math.floor(session.level / 10) * 2; center.maxHp = center.hp; center.power = "rainbow"; center.w *= 1.45; center.x -= center.w * .15; center.vx = 48; }
  }
  return bricks;
}

function initialRuntime(session: RunSession): GameRuntime {
  const wideLevel = session.upgradeLevels?.["wide-start"] || (hasUpgrade(session.upgrades, "wide-start") ? 1 : 0);
  const baseW = session.casualStyle === "chill" ? 168 : 132 + wideLevel * 14;
  const speed = (session.route === "safe" ? 330 : session.route === "risky" ? 430 : 375) + Math.max(0, (session.riskLevel || 1) - 1) * 24;
  const first = randomLaunchBall(W / 2, speed, 650);
  const balls = [first];
  if (hasUpgrade(session.upgrades, "ball-insurance")) balls.push(randomLaunchBall(W / 2, speed, 650));
  const now = performance.now();
  return {
    paddleX: W / 2, targetX: W / 2, paddleW: baseW, balls, bricks: generateBricks(session), drops: [], bullets: [], particles: [],
    score: session.score, lives: session.lives, shield: hasUpgrade(session.upgrades, "safety-net") ? 1 : 0,
    effects: { expand: 0, shrink: 0, slow: 0, sticky: 0, fireball: hasUpgrade(session.upgrades, "strong-start") ? now + 8000 : 0, bomb: 0, laser: 0, magnet: 0, turbo: 0, gravity: 0, heavy: 0, curve: 0, orbit: 0, ghost: 0, lightning: 0, blackhole: 0, timestop: 0, ricochet: 0, clone: 0, bottomwall: 0, drone: 0, shockwave: 0, lucky: 0, phoenix: 0, mega: 0, rainbow: 0, scorebank: 0, invert: 0, fake: 0, drift: 0, fog: 0, glitch: 0, leak: 0, storm: 0, tiny: 0, bumper: 0, roulette: 0 },
    lastTime: now, levelStart: now, lastLaser: 0, announcedHigh: false, ended: false, bricksBroken: 0, powerupsCaught: 0, combo: 0, maxCombo: 0, maxBalls: balls.length, livesSaved: 0, overdrive: 0, overdriveUntil: 0, phoenixUsed: false, shake: 0, timeLeft: session.timeLimit || 0, powerCounts: {}, powerHistory: [], nextPowerHistoryId: 1, riskBoost: false, singleBrickSince: 0, lightningAssist: null, keys: new Set(),
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

export function BreakerGame({ session, highScore, settings, cosmetics, fullscreen, onToggleFullscreen, onHighScore, onLevelClear, onGameOver, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<GameRuntime | null>(null);
  const synth = useRef(new MiniSynth());
  const [hud, setHud] = useState({ score: session.score, lives: session.lives, balls: 1, combo: 0, overdrive: 0, style: "D", timeLeft: session.timeLimit || 0, bossHp: 0, bossMax: 0, awaitingLaunch: true, launchSeconds: 7, powerHistory: [] as Array<PowerHistoryItem & { remaining: number; expired: boolean }> });
  const [paused, setPaused] = useState(() => typeof window !== "undefined" && !localStorage.getItem("infinite-breaker-tutorial-v2"));
  const [countdown, setCountdown] = useState<number | null>(null);
  const pausedRef = useRef(false);
  const [toast, setToast] = useState("");
  const [tutorial, setTutorial] = useState(() => typeof window !== "undefined" && !localStorage.getItem("infinite-breaker-tutorial-v2") ? 1 : 0);
  const controlRef = useRef<HTMLDivElement>(null);
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

  const beginResume = useCallback(() => {
    audioReady();
    setCountdown((value) => value ?? 5);
  }, [audioReady]);

  useEffect(() => {
    const pauseForFullscreenChange = () => {
      setCountdown(null);
      setPaused(true);
    };
    document.addEventListener("fullscreenchange", pauseForFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", pauseForFullscreenChange);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    const timer = window.setTimeout(() => {
      if (countdown <= 1) {
        setCountdown(null);
        setPaused(false);
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) {
        setCountdown(null);
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

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

    const duration = (good: boolean) => good
      ? (hasUpgrade(session.upgrades, "power-duration") ? 1.35 : 1) * (g.effects.leak > performance.now() ? .6 : 1)
      : (hasUpgrade(session.upgrades, "curse-resistance") ? 0.6 : 1) * (hasUpgrade(session.upgrades, "cursed-power") ? 1.35 : 1);
    const isGood = (kind: PowerKind) => (GOOD as readonly string[]).includes(kind) || kind === "life";
    const active = (kind: keyof EffectState, now: number) => g.effects[kind] > now;
    const burst = (x: number, y: number, color: string, count = 9) => {
      if (settings.quality === 0) return;
      for (let i = 0; i < count * settings.quality; i++) {
        const a = Math.random() * Math.PI * 2; const speed = 45 + Math.random() * 150;
        g.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .35 + Math.random() * .45, color, size: 1 + Math.random() * 3 });
      }
    };
    const activateOverdrive = () => {
      if (g.overdrive < 100 || g.ended) return;
      g.overdrive = 0; g.overdriveUntil = performance.now() + (hasUpgrade(session.upgrades, "overdrive-core") ? 10000 : 7000);
      g.effects.fireball = g.overdriveUntil; g.effects.laser = g.overdriveUntil; g.effects.magnet = g.overdriveUntil;
      setToast("OVERDRIVE UNLEASHED"); window.setTimeout(() => setToast(""), 1800); g.shake = 12;
    };

    const spawnBall = (delay = 650) => {
      const speed = session.route === "safe" ? 330 : session.route === "risky" ? 430 : 375;
      g.balls.push(randomLaunchBall(g.paddleX, speed, delay));
    };

    const launchBalls = () => {
      if (pausedRef.current || g.ended) return false;
      const waiting = g.balls.filter((ball) => ball.awaitingLaunch);
      if (!waiting.length) return false;
      for (const ball of waiting) { ball.awaitingLaunch = false; ball.autoLaunchAt = 0; }
      setToast("BALL LAUNCHED"); window.setTimeout(() => setToast(""), 700);
      return true;
    };

    const addScore = (amount: number) => {
      const routeMultiplier = session.route === "safe" ? 0.85 : session.route === "risky" ? 1.5 : 1;
      const variantMultiplier = (session.variant === "one-ball" ? 3 : session.variant === "time-attack" ? 1.35 : 1) * (g.riskBoost ? 1.3 : 1);
      const cursedMultiplier = hasUpgrade(session.upgrades, "cursed-power") ? 1.65 : 1;
      g.score += Math.round(amount * routeMultiplier * variantMultiplier * cursedMultiplier * Math.max(1, 1 + Math.floor(g.combo / 8) * 0.25));
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
      brick.hp = 0; g.bricksBroken++; g.combo++; g.maxCombo = Math.max(g.maxCombo, g.combo); g.overdrive = Math.min(100, g.overdrive + (hasUpgrade(session.upgrades, "overdrive-core") ? 7 : 4)); addScore(brick.type === "core" ? 900 : brick.type === "golden" ? 1200 : brick.type === "corrupted" ? 450 : brick.type === "reinforced" ? 180 : 100);
      burst(brick.x + brick.w / 2, brick.y + brick.h / 2, theme.bricks[brick.type] || theme.accent, brick.type === "core" ? 28 : 8);
      if (settings.screenShake && !settings.reducedMotion) g.shake = Math.max(g.shake, brick.type === "core" || brick.type === "explosive" ? 8 : 2);
      if (settings.sfx) synth.current.tone(brick.type === "explosive" ? 90 : 240 + (brick.id % 5) * 45, 0.08, 0.02);
      if (brick.power) dropPower(brick, brick.power);
      else if (brick.hiddenPower) dropPower(brick);
      if ((brick.type === "explosive" || brick.type === "glass" || brick.type === "electric" || brick.type === "ice" || active("bomb", performance.now())) && !chain) {
        const radius = (brick.type === "glass" ? 75 : brick.type === "electric" ? 130 : 105) * (hasUpgrade(session.upgrades, "blast-radius") ? 1.45 : 1);
        for (const other of g.bricks) {
          const dx = other.x + other.w / 2 - (brick.x + brick.w / 2);
          const dy = other.y + other.h / 2 - (brick.y + brick.h / 2);
          if (other.hp > 0 && Math.hypot(dx, dy) < radius) destroyBrick(other, true);
        }
      }
      if (brick.type === "prism" && g.balls[0]) {
        const source = g.balls[0]; g.balls.push({ ...source, vx: -source.vx, trail: [] }, { ...source, vx: source.vx * .45, vy: source.vy * 1.1, trail: [] });
      }
      if (brick.type === "switch") for (const other of g.bricks) if (other.hp > 0 && other.type === "moving") other.vx *= -1;
      if (brick.type === "parasite" && g.bricks.length < 150) g.bricks.push({ ...brick, id: Math.max(...g.bricks.map((b) => b.id)) + 1, x: Math.min(W - brick.w - 20, brick.x + brick.w + 7), hp: 1, maxHp: 1, type: "normal", power: undefined, hiddenPower: false, born: performance.now(), lastAction: 0 });
    };

    const hitBrick = (brick: Brick) => {
      if (brick.type === "armored" || brick.hp <= 0) return;
      brick.hp--;
      if (brick.hp <= 0) { brick.hp = 1; destroyBrick(brick); }
      else { g.combo++; g.maxCombo = Math.max(g.maxCombo, g.combo); g.overdrive = Math.min(100, g.overdrive + 2); addScore(35); if (settings.sfx) synth.current.tone(170, 0.05, 0.015); }
    };

    const applyPower = (kind: PowerKind) => {
      const now = performance.now(); const good = isGood(kind); let ms = (good ? 11000 : 9000) * duration(good);
      g.powerCounts[kind] = (g.powerCounts[kind] || 0) + 1;
      if ((g.powerCounts[kind] || 0) % 3 === 0) { ms *= 1.75; setToast(`EVOLVED · ${POWER_LABEL[kind]} II`); }
      const instant = INSTANT_POWERS.has(kind);
      g.powerHistory.push({ id: g.nextPowerHistoryId++, kind, good, expiresAt: instant ? now : now + ms, instant });
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
      if (kind in g.effects) g.effects[kind as keyof EffectState] = now + ms;
      if (kind === "shield") g.shield = Math.min(2, g.shield + 1);
      if (kind === "life") { if (session.mode === "campaign") g.lives = Math.min(7, g.lives + 1); else addScore(500); }
      if (kind === "drain") {
        g.effects.expand = g.effects.slow = g.effects.sticky = g.effects.fireball = g.effects.bomb = g.effects.laser = g.effects.magnet = 0;
      }
      if (kind === "repair") {
        const broken = g.bricks.filter((b) => b.hp === 0 && b.type !== "armored").slice(-4);
        for (const b of broken) b.hp = Math.min(b.maxHp, 1);
      }
      if (kind === "shockwave") for (const brick of g.bricks.filter((b) => b.hp > 0 && b.type !== "armored").slice(-8)) hitBrick(brick);
      if (kind === "lightning") for (const brick of g.bricks.filter((b) => b.hp > 0 && b.type !== "armored").slice(0, 5)) hitBrick(brick);
      if (kind === "lucky") g.drops.filter((d) => !d.good).forEach((d) => { d.kind = GOOD[Math.floor(Math.random() * GOOD.length)]; d.good = true; });
      if (kind === "storm") for (let i = 0; i < 8; i++) { const stormKind = choosePower(Math.random, session); g.drops.push({ x: 80 + Math.random() * 800, y: 90 + Math.random() * 160, vy: 150, kind: stormKind, good: isGood(stormKind), pulse: i }); }
      if (kind === "blackhole") for (const drop of g.drops) { drop.x += (g.paddleX - drop.x) * .25; }
      if (kind === "rainbow") { g.effects.fireball = g.effects.lightning = g.effects.magnet = now + ms; }
      if (kind === "double" || kind === "triple") {
        const source = [...g.balls]; const copies = kind === "double" ? 1 : 2;
        for (const ball of source) for (let i = 0; i < copies && g.balls.length < 16; i++) {
          const angle = (i + 1) * (kind === "double" ? 0.32 : 0.27) * (i % 2 ? -1 : 1);
          const cos = Math.cos(angle), sin = Math.sin(angle);
          g.balls.push({ ...ball, vx: ball.vx * cos - ball.vy * sin, vy: ball.vx * sin + ball.vy * cos, stuckUntil: 0, trail: [] });
        }
      }
      g.maxBalls = Math.max(g.maxBalls, g.balls.length);
      if ((kind === "double" || kind === "triple") && active("fireball", now)) { g.overdrive = 100; setToast("FUSION · INFERNO SWARM"); }
    };

    const miss = () => {
      if (active("bottomwall", performance.now())) { g.livesSaved++; spawnBall(250); return; }
      if (g.shield > 0) { g.shield--; g.livesSaved++; spawnBall(300); return; }
      if ((active("phoenix", performance.now()) || hasUpgrade(session.upgrades, "phoenix-protocol")) && !g.phoenixUsed) { g.phoenixUsed = true; g.livesSaved++; spawnBall(250); g.effects.fireball = performance.now() + 8000; setToast("PHOENIX REBIRTH"); return; }
      if (!hasUpgrade(session.upgrades, "combo-keeper")) g.combo = 0;
      if (session.mode === "campaign" || session.variant === "one-ball") {
        g.lives--;
        if (g.lives <= 0 || session.variant === "one-ball") {
          g.ended = true;
          window.setTimeout(() => callbacks.current.onGameOver({ score: g.score, level: session.level, bricks: g.bricksBroken, powerups: g.powerupsCaught, combo: g.maxCombo, maxBalls: g.maxBalls }), 350);
          return;
        }
      }
      spawnBall(650);
    };

    const update = (now: number, dt: number) => {
      const heavy = active("heavy", now);
      const inverted = active("invert", now) || (session.variant === "mirror" && Math.floor((now - g.levelStart) / 9000) % 2 === 1);
      if (g.keys.has("ArrowLeft") || g.keys.has("KeyA")) g.targetX += (inverted ? 1 : -1) * 520 * dt;
      if (g.keys.has("ArrowRight") || g.keys.has("KeyD")) g.targetX += (inverted ? -1 : 1) * 520 * dt;
      const wideLevel = session.upgradeLevels?.["wide-start"] || (hasUpgrade(session.upgrades, "wide-start") ? 1 : 0);
      const baseW = session.casualStyle === "chill" ? 168 : 132 + wideLevel * 14;
      g.paddleW = active("expand", now) ? baseW * 1.55 : active("shrink", now) ? baseW * 0.62 : baseW;
      if (active("drift", now)) g.targetX += Math.sin(now / 350) * 1.8;
      g.targetX = Math.max(g.paddleW / 2 + 14, Math.min(W - g.paddleW / 2 - 14, g.targetX));
      g.paddleX += (g.targetX - g.paddleX) * Math.min(1, dt * (heavy ? 4 : 20));

      const speedFactor = active("timestop", now) ? .18 : active("slow", now) ? 0.66 : active("turbo", now) ? 1.42 : g.overdriveUntil > now ? 1.18 : 1;
      for (const brick of g.bricks) if (brick.hp > 0 && brick.type === "moving") {
        brick.x += brick.vx * dt; if (brick.x < 35 || brick.x + brick.w > W - 35) brick.vx *= -1;
      }
      for (const brick of g.bricks) {
        if (brick.hp <= 0) continue;
        if (brick.type === "regenerator" && now - brick.lastAction > 4500) { const broken = g.bricks.find((b) => b.hp <= 0 && b.type !== "armored"); if (broken) broken.hp = 1; brick.lastAction = now; }
        if (brick.type === "gravityBlock") for (const ball of g.balls) { const dx = brick.x + brick.w / 2 - ball.x; const dy = brick.y + brick.h / 2 - ball.y; const d = Math.max(80, Math.hypot(dx, dy)); if (d < 210) { ball.vx += dx / d * 24 * dt; ball.vy += dy / d * 24 * dt; } }
        if (brick.type === "core") {
          brick.x += brick.vx * dt; if (brick.x < 90 || brick.x + brick.w > W - 90) brick.vx *= -1;
          const phase = 1 + Math.floor((1 - brick.hp / brick.maxHp) * 3);
          if (now - brick.lastAction > Math.max(1800, 4300 - phase * 650)) {
            brick.lastAction = now;
            const curse = BAD[(phase * 3 + session.level) % BAD.length];
            g.drops.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h, vy: 135 + phase * 18, kind: curse, good: false, pulse: phase });
            if (phase >= 3) for (const moving of g.bricks.filter((b) => b.hp > 0 && b.type === "normal").slice(0, 3)) moving.type = "moving";
          }
        }
      }

      if (g.timeLeft > 0) {
        g.timeLeft = Math.max(0, (session.timeLimit || 0) - (now - g.levelStart) / 1000);
        if (g.timeLeft <= 0 && !g.ended) { g.ended = true; callbacks.current.onGameOver({ score: g.score, level: session.level, bricks: g.bricksBroken, powerups: g.powerupsCaught, combo: g.maxCombo, maxBalls: g.maxBalls }); return; }
      }

      for (const ball of g.balls) {
        if (ball.awaitingLaunch) {
          ball.x = g.paddleX; ball.y = H - 64;
          if (now >= ball.autoLaunchAt) { ball.awaitingLaunch = false; ball.autoLaunchAt = 0; setToast("AUTO LAUNCH"); window.setTimeout(() => setToast(""), 700); }
          else continue;
        }
        if (ball.stuckUntil > now) { ball.x = g.paddleX; ball.y = H - 64; continue; }
        if (ball.stuckUntil !== 0) ball.stuckUntil = 0;
        if (Math.abs(ball.vx) < 58) ball.vx = (ball.vx < 0 ? -1 : 1) * 58;
        ball.trail.push({ x: ball.x, y: ball.y, life: 1 }); if (ball.trail.length > (settings.quality === 2 ? 18 : 9)) ball.trail.shift();
        ball.trail.forEach((point) => { point.life -= dt * 3.2; }); ball.trail = ball.trail.filter((point) => point.life > 0);
        if (active("gravity", now)) ball.vy += 75 * dt;
        if (active("curve", now)) {
          const a = Math.sin(now / 300) * 0.5 * dt, c = Math.cos(a), s = Math.sin(a);
          const vx = ball.vx; ball.vx = vx * c - ball.vy * s; ball.vy = vx * s + ball.vy * c;
        }
        if (active("glitch", now) && Math.random() < dt * .7) ball.x = 30 + Math.random() * (W - 60);
        ball.x += ball.vx * dt * speedFactor; ball.y += ball.vy * dt * speedFactor;
        if (ball.x - ball.r < 10) { ball.x = 10 + ball.r; ball.vx = Math.abs(ball.vx); }
        if (ball.x + ball.r > W - 10) { ball.x = W - 10 - ball.r; ball.vx = -Math.abs(ball.vx); }
        if (ball.y - ball.r < 10) { ball.y = 10 + ball.r; ball.vy = Math.abs(ball.vy); }

        const safetyY = H - 14;
        if (ball.vy > 0 && ball.y + ball.r >= safetyY && (g.shield > 0 || active("bottomwall", now))) {
          ball.y = safetyY - ball.r;
          ball.vy = -Math.max(280, Math.abs(ball.vy));
          ball.vx += (Math.random() - .5) * 70;
          if (g.shield > 0) g.shield--;
          g.livesSaved++;
          burst(ball.x, safetyY, "#7cffcb", 22);
          g.shake = Math.max(g.shake, 11);
          setToast("SHIELD SAVE!"); window.setTimeout(() => setToast(""), 900);
        }

        const py = H - 52;
        const cloneX = W - g.paddleX;
        const onMain = ball.x >= g.paddleX - g.paddleW / 2 && ball.x <= g.paddleX + g.paddleW / 2;
        const onClone = active("clone", now) && ball.x >= cloneX - g.paddleW / 2 && ball.x <= cloneX + g.paddleW / 2;
        if (ball.vy > 0 && ball.y + ball.r >= py && ball.y - ball.r <= py + 18 && (onMain || onClone)) {
          const paddleCenter = onMain ? g.paddleX : cloneX;
          const ratio = (ball.x - paddleCenter) / (g.paddleW / 2); const speed = Math.max(340, Math.hypot(ball.vx, ball.vy));
          ball.vx = speed * ratio * 0.88; ball.vy = -Math.sqrt(Math.max(9000, speed * speed - ball.vx * ball.vx)); ball.y = py - ball.r;
          if (Math.abs(ratio) < .16) { g.combo += 2; g.overdrive = Math.min(100, g.overdrive + 7); addScore(hasUpgrade(session.upgrades, "precision-engine") ? 180 : 90); setToast("PERFECT HIT"); }
          else if (Math.abs(ratio) > .86) { g.overdrive = Math.min(100, g.overdrive + 5); addScore(70); setToast("EDGE SAVE"); }
          if (active("bumper", now)) ball.vx *= 1.35;
          if (active("sticky", now)) ball.stuckUntil = now + 850;
          if (settings.sfx) synth.current.tone(135, 0.05, 0.015);
        }

        for (const brick of g.bricks) {
          if (brick.hp <= 0 || (brick.type === "phantom" && Math.sin(now / 600 + brick.id) < 0)) continue;
          const nearestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
          const nearestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
          const dx = ball.x - nearestX, dy = ball.y - nearestY;
          if (dx * dx + dy * dy <= ball.r * ball.r) {
            if (brick.type === "mimic") brick.type = SPECIAL_BRICKS[(brick.id + session.level) % SPECIAL_BRICKS.length];
            if (brick.type !== "armored") hitBrick(brick);
            const precision = Math.abs(ball.x - (brick.x + brick.w / 2)) < brick.w * .16;
            if (precision) { addScore(hasUpgrade(session.upgrades, "precision-engine") ? 140 : 60); g.overdrive = Math.min(100, g.overdrive + 4); }
            if (brick.type === "mirror") ball.vx *= -1;
            if (!active("fireball", now) && !active("ghost", now) || brick.type === "armored") {
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
      if (active("drone", now) && now - g.lastLaser > 280) { g.lastLaser = now; g.bullets.push({ x: 30 + Math.random() * (W - 60), y: H - 90 }); }
      for (const bullet of g.bullets) {
        bullet.y -= 560 * dt;
        for (const brick of g.bricks) if (brick.hp > 0 && bullet.x >= brick.x && bullet.x <= brick.x + brick.w && bullet.y >= brick.y && bullet.y <= brick.y + brick.h) {
          hitBrick(brick); bullet.y = -30; break;
        }
      }
      g.bullets = g.bullets.filter((b) => b.y > 0);

      for (const drop of g.drops) {
        drop.y += drop.vy * dt;
        if ((active("magnet", now) || hasUpgrade(session.upgrades, "drop-magnet")) && drop.good) drop.x += Math.sign(g.paddleX - drop.x) * 110 * dt;
        if (drop.y > H - 60 && drop.y < H - 28 && drop.x > g.paddleX - g.paddleW / 2 && drop.x < g.paddleX + g.paddleW / 2) { applyPower(drop.kind); drop.y = H + 50; }
      }
      g.drops = g.drops.filter((drop) => drop.y < H + 20);

      const remainingBreakable = g.bricks.filter((brick) => brick.hp > 0 && brick.type !== "armored");
      if (remainingBreakable.length === 1) {
        if (!g.singleBrickSince) g.singleBrickSince = now;
        if (now - g.singleBrickSince >= 20000) {
          const target = remainingBreakable[0];
          const strikeX = target.x + target.w / 2; const strikeY = target.y + target.h / 2;
          g.lightningAssist = { x: strikeX, y: strikeY, until: now + 850 };
          g.shake = Math.max(g.shake, 20);
          burst(strikeX, strikeY, "#dffcff", 42);
          setToast("⚡ LAST BRICK ASSIST");
          destroyBrick(target);
          g.singleBrickSince = 0;
        }
      } else {
        g.singleBrickSince = 0;
      }
      const breakableLeft = remainingBreakable.some((brick) => brick.hp > 0);
      if (!breakableLeft && !g.ended) {
        g.ended = true; addScore(1000 + session.level * 50);
        window.setTimeout(() => callbacks.current.onLevelClear({ score: g.score, lives: g.lives, bricks: g.bricksBroken, powerups: g.powerupsCaught, combo: g.maxCombo, maxBalls: g.maxBalls, clearMs: performance.now() - g.levelStart, boss: session.level % 10 === 0, livesSaved: g.livesSaved }), 500);
      }

      for (const particle of g.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 120 * dt; particle.life -= dt; }
      g.particles = g.particles.filter((particle) => particle.life > 0);
      g.shake *= Math.pow(.08, dt);
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (g.shake > .2 && settings.screenShake && !settings.reducedMotion) ctx.translate((Math.random() - .5) * g.shake * settings.screenShake, (Math.random() - .5) * g.shake * settings.screenShake);
      ctx.fillStyle = theme.background; ctx.fillRect(0, 0, W, H);
      const motionTime = settings.reducedMotion ? 0 : now;
      for (let i = 0; i < 30; i++) {
        const depth = (i % 3) + 1;
        const x = (i * 137 + motionTime * 0.006 * depth) % W;
        const y = (i * 83 + motionTime * 0.0025 * depth) % H;
        ctx.fillStyle = depth === 3 ? "rgba(255,255,255,.18)" : depth === 2 ? theme.haze[1] : theme.haze[0];
        ctx.fillRect(x, y, depth === 3 ? 2 : 1, depth === 3 ? 2 : 1);
      }
      ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
      const gridOffset = (motionTime * 0.008) % 32;
      for (let x = -32 + gridOffset; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = -32 + gridOffset; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const horizon = ctx.createLinearGradient(0, 0, 0, H); horizon.addColorStop(0, theme.haze[0]); horizon.addColorStop(.45, "rgba(255,255,255,.015)"); horizon.addColorStop(1, theme.haze[1]);
      ctx.fillStyle = horizon; ctx.fillRect(0, 0, W, H);

      for (const brick of g.bricks) {
        if (brick.hp <= 0) continue;
        if (brick.type === "phantom") ctx.globalAlpha = .28 + Math.abs(Math.sin(now / 600 + brick.id)) * .7;
        const color = theme.bricks[brick.type] || ({ electric: "#ffe66d", ice: "#8ff5ff", prism: "#d6a4ff", gravityBlock: "#6f8cff", mirror: "#e8f4ff", phantom: "#a28bbb", regenerator: "#77ff9d", parasite: "#ff7a9f", switch: "#ffb84d", comboBlock: "#ff5d8f", vault: "#ffd166", corrupted: "#8f35ba", titan: "#ff6b35", mimic: "#b7a2c7", golden: "#fff1a6" } as Partial<Record<BrickType, string>>)[brick.type] || theme.accent;
        ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(brick.x + 4, brick.y + 5, brick.w, brick.h);
        ctx.fillStyle = color; ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
        ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 3);
        ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(brick.x + 3, brick.y + brick.h - 5, brick.w - 6, 3);
        if (brick.hp < brick.maxHp && brick.maxHp < 100) { ctx.strokeStyle = "rgba(14,10,32,.75)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(brick.x + brick.w * .25, brick.y + 2); ctx.lineTo(brick.x + brick.w * .48, brick.y + brick.h - 2); ctx.lineTo(brick.x + brick.w * .7, brick.y + 5); ctx.stroke(); }
        if (brick.type === "power") { ctx.fillStyle = "#0e0a20"; ctx.font = "bold 14px monospace"; ctx.textAlign = "center"; ctx.fillText("?", brick.x + brick.w / 2, brick.y + 17); }
        if (brick.type === "heart") { ctx.fillStyle = "#fff"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.fillText("♥", brick.x + brick.w / 2, brick.y + 17); }
        if (brick.type === "reinforced" || brick.type === "core") {
          ctx.fillStyle = "#0e0a20"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.fillText(String(brick.hp), brick.x + brick.w / 2, brick.y + 16);
        }
        if (brick.type === "armored") { ctx.strokeStyle = "#8991b2"; ctx.lineWidth = 2; ctx.strokeRect(brick.x + 4, brick.y + 4, brick.w - 8, brick.h - 8); }
        if (brick.type === "explosive") { ctx.fillStyle = "#fff1a6"; ctx.fillRect(brick.x + brick.w / 2 - 3, brick.y + 6, 6, 12); ctx.fillRect(brick.x + brick.w / 2 - 7, brick.y + 10, 14, 4); }
        if (BRICK_SYMBOL[brick.type]) { ctx.fillStyle = "#0e0a20"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.fillText(BRICK_SYMBOL[brick.type] || "", brick.x + brick.w / 2, brick.y + 17); }
        ctx.globalAlpha = 1;
      }

      for (const drop of g.drops) {
        const pulse = Math.sin(now / 120 + drop.pulse) * 2;
        ctx.fillStyle = drop.kind === "life" ? "#ff3f74" : drop.good ? "#7cffcb" : "#b05cff";
        ctx.fillRect(drop.x - 24 - pulse, drop.y - 10 - pulse / 2, 48 + pulse * 2, 20 + pulse);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(drop.x - 24 - pulse, drop.y - 10 - pulse / 2, 48 + pulse * 2, 20 + pulse);
        ctx.fillStyle = "#0e0a20"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText(POWER_LABEL[drop.kind], drop.x, drop.y + 4);
      }

      for (const bullet of g.bullets) { ctx.fillStyle = "#7cffcb"; ctx.fillRect(bullet.x - 2, bullet.y - 9, 4, 12); }
      for (const particle of g.particles) { ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); } ctx.globalAlpha = 1;

      const py = H - 52;
      ctx.fillStyle = "#05030c"; ctx.fillRect(g.paddleX - g.paddleW / 2 + 5, py + 7, g.paddleW, 18);
      const paddleColor = cosmetics.paddle === "mint" ? "#7cffcb" : cosmetics.paddle === "gold" ? "#ffd166" : cosmetics.paddle === "boss" ? "#fff1a6" : theme.paddle;
      ctx.fillStyle = active("shrink", now) ? "#b05cff" : paddleColor; ctx.fillRect(g.paddleX - g.paddleW / 2, py, g.paddleW, 18);
      ctx.fillStyle = "#fff1a6"; ctx.fillRect(g.paddleX - g.paddleW / 2 + 7, py + 3, g.paddleW - 14, 4);
      if (g.shield > 0) { ctx.strokeStyle = "#7cffcb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, H - 14); ctx.lineTo(W - 20, H - 14); ctx.stroke(); }
      if (active("bottomwall", now)) { ctx.strokeStyle = "#fff1a6"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(10, H - 8); ctx.lineTo(W - 10, H - 8); ctx.stroke(); }
      if (active("clone", now)) { ctx.globalAlpha = .65; ctx.fillStyle = paddleColor; ctx.fillRect(W - g.paddleX - g.paddleW / 2, py, g.paddleW, 18); ctx.globalAlpha = 1; }

      for (const ball of g.balls) {
        const trailColor = cosmetics.trail === "rainbow" ? `hsl(${(now / 8 + ball.x) % 360} 90% 70%)` : cosmetics.trail === "glitch" ? "#b05cff" : cosmetics.trail === "comet" ? "#ffb84d" : theme.accent;
        for (const point of ball.trail) { ctx.globalAlpha = point.life * .5; ctx.fillStyle = trailColor; ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(1, ball.r * point.life * .7), 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
        ctx.shadowBlur = 16; ctx.shadowColor = active("fireball", now) ? "#ff6b35" : theme.accent;
        const ballColor = cosmetics.ball === "plasma" ? "#7cffcb" : cosmetics.ball === "void" ? "#b05cff" : cosmetics.ball === "prism" ? `hsl(${now / 5 % 360} 95% 75%)` : "#fff";
        ctx.fillStyle = active("fireball", now) ? "#fff1a6" : ballColor; ctx.beginPath(); ctx.arc(ball.x, ball.y, active("mega", now) ? ball.r * 1.7 : active("tiny", now) ? ball.r * .65 : ball.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        if (ball.awaitingLaunch) {
          const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
          ctx.save(); ctx.setLineDash([7, 7]); ctx.strokeStyle = "rgba(255,241,214,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + ball.vx / speed * 95, ball.y + ball.vy / speed * 95); ctx.stroke(); ctx.restore();
        }
      }
      if (active("fake", now)) { ctx.globalAlpha = .32; for (let i = 0; i < 5; i++) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc((now * .09 + i * 183) % W, 150 + ((i * 97 + now * .04) % 330), 7, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
      if (active("fog", now)) { const fog = ctx.createRadialGradient(g.paddleX, H - 80, 70, g.paddleX, H - 80, 370); fog.addColorStop(0, "rgba(14,10,32,0)"); fog.addColorStop(1, "rgba(4,2,10,.82)"); ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H); }
      if (g.overdriveUntil > now) { ctx.strokeStyle = `rgba(124,255,203,${.25 + Math.sin(now / 80) * .15})`; ctx.lineWidth = 8; ctx.strokeRect(8, 8, W - 16, H - 16); }
      if (g.lightningAssist && now < g.lightningAssist.until) {
        const strike = g.lightningAssist;
        ctx.fillStyle = `rgba(220,250,255,${.08 + Math.random() * .15})`; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (let pass = 0; pass < 3; pass++) {
          ctx.strokeStyle = pass === 0 ? "rgba(255,255,255,.95)" : pass === 1 ? "rgba(124,255,235,.8)" : "rgba(100,170,255,.55)";
          ctx.lineWidth = pass === 0 ? 3 : 7 + pass * 4; ctx.beginPath(); ctx.moveTo(strike.x + (Math.random() - .5) * 30, 0);
          const segments = 11;
          for (let i = 1; i <= segments; i++) { const t = i / segments; ctx.lineTo(strike.x + (Math.random() - .5) * (42 - t * 20), strike.y * t); }
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.textAlign = "left";
      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.025, Math.max(0, (now - g.lastTime) / 1000)); g.lastTime = now;
      if (!pausedRef.current && !g.ended) update(now, dt);
      else if (pausedRef.current) {
        for (const ball of g.balls) if (ball.awaitingLaunch) ball.autoLaunchAt += dt * 1000;
        if (g.singleBrickSince) g.singleBrickSince += dt * 1000;
        g.levelStart += dt * 1000;
      }
      draw(now);
      if (now - hudTimer > 100) {
        hudTimer = now;
        const boss = g.bricks.find((brick) => brick.type === "core" && brick.hp > 0);
        const waitingBall = g.balls.find((ball) => ball.awaitingLaunch);
        const style = g.combo >= 50 ? "SSS" : g.combo >= 35 ? "SS" : g.combo >= 24 ? "S" : g.combo >= 15 ? "A" : g.combo >= 8 ? "B" : g.combo >= 3 ? "C" : "D";
        setHud({
          score: g.score,
          lives: g.lives,
          balls: g.balls.length,
          combo: g.combo,
          overdrive: g.overdrive,
          style,
          timeLeft: g.timeLeft,
          bossHp: boss?.hp || 0,
          bossMax: boss?.maxHp || 0,
          awaitingLaunch: Boolean(waitingBall),
          launchSeconds: waitingBall ? Math.max(0, Math.ceil((waitingBall.autoLaunchAt - now) / 1000)) : 0,
          powerHistory: g.powerHistory.map((item) => ({ ...item, remaining: item.instant ? 0 : Math.max(0, Math.ceil((item.expiresAt - now) / 1000)), expired: item.instant || item.expiresAt <= now })),
        });
      }
      frame = requestAnimationFrame(loop);
    };

    const pointFrom = (clientX: number, element: Element) => { const rect = element.getBoundingClientRect(); let x = ((clientX - rect.left) / rect.width) * W; if (active("invert", performance.now())) x = W - x; g.targetX = x; };
    const move = (e: PointerEvent) => pointFrom(e.clientX, canvas);
    const down = (e: PointerEvent) => { audioReady(); pointFrom(e.clientX, canvas); launchBalls(); canvas.setPointerCapture?.(e.pointerId); };
    const control = controlRef.current;
    const controlMove = (e: PointerEvent) => { e.preventDefault(); pointFrom(e.clientX, control || canvas); };
    const controlDown = (e: PointerEvent) => { audioReady(); controlMove(e); launchBalls(); control?.setPointerCapture?.(e.pointerId); };
    const keyDown = (e: KeyboardEvent) => {
      g.keys.add(e.code);
      if ((e.code === "Escape" || e.code === "KeyP") && !e.repeat) {
        e.preventDefault();
        if (pausedRef.current) beginResume();
        else {
          setCountdown(null);
          setPaused(true);
        }
      }
      if (e.code === "Space" && !e.repeat) { e.preventDefault(); if (!launchBalls()) activateOverdrive(); }
      if (e.code === "KeyR" && !e.repeat) { g.riskBoost = !g.riskBoost; setToast(g.riskBoost ? "RISK DRIVE · SCORE ×1.3" : "RISK DRIVE OFF"); }
      if (e.code === "KeyF" && !e.repeat) { e.preventDefault(); onToggleFullscreen(); }
    };
    const keyUp = (e: KeyboardEvent) => g.keys.delete(e.code);
    canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerdown", down);
    control?.addEventListener("pointermove", controlMove); control?.addEventListener("pointerdown", controlDown);
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerdown", down);
      control?.removeEventListener("pointermove", controlMove); control?.removeEventListener("pointerdown", controlDown);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); synthEngine.stop();
    };
  }, [audioReady, beginResume, cosmetics, onToggleFullscreen, session, settings.quality, settings.reducedMotion, settings.screenShake, settings.sfx]);

  return (
    <div className="game-page">
      <header className="game-hud">
        <button className="hud-exit" aria-label="Pause game" onClick={() => { setCountdown(null); setPaused(true); }}>Ⅱ</button>
        <div><span>MODE</span><strong>{(session.variant || session.mode).toUpperCase()}</strong></div>
        <div><span>STRUCTURE</span><strong>{String(session.level).padStart(2, "0")}</strong></div>
        <div className="hud-score"><span>SCORE</span><strong>{hud.score.toLocaleString("en-US").padStart(8, "0")}</strong></div>
        <div><span>HIGH</span><strong>{Math.max(highScore, hud.score).toLocaleString("en-US")}</strong></div>
        <div><span>{session.timeLimit ? "TIME" : session.mode === "campaign" ? "LIVES" : "BALLS"}</span><strong>{session.timeLimit ? Math.ceil(hud.timeLeft) : session.mode === "campaign" ? "♥".repeat(Math.max(0, Math.min(7, hud.lives))) : hud.balls}</strong></div>
      </header>
      <section className="game-status-panel">
        <div className="supreme-meters"><span className={`style-rank rank-${hud.style.toLowerCase()}`}>STYLE <b>{hud.style}</b></span><div className="overdrive-meter"><i style={{ width: `${hud.overdrive}%` }} /><b>OVERDRIVE {Math.round(hud.overdrive)}%</b></div><button disabled={hud.overdrive < 100} onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }))}>⚡ ACTIVATE</button></div>
        {hud.bossMax > 0 && <div className="boss-meter"><span>BOSS PHASE {Math.max(1, 4 - Math.ceil(hud.bossHp / Math.max(1, hud.bossMax / 3)))}</span><i><b style={{ width: `${hud.bossHp / hud.bossMax * 100}%` }} /></i><em>{hud.bossHp}/{hud.bossMax}</em></div>}
        <div className="power-history" aria-label="Power-ups collected in this structure">
          <b className="power-history-title">POWER LOG</b>
          <div className="power-history-items">{hud.powerHistory.length ? hud.powerHistory.map((item) => <span key={item.id} className={`${item.good ? "good" : "bad"} ${item.expired ? "expired" : "active"}`} title={item.instant ? "Used" : item.expired ? "Effect ended" : `${item.remaining} seconds remaining`}><i>{item.good ? "+" : "!"}</i>{POWER_LABEL[item.kind]}<small>{item.instant ? "USED" : item.expired ? "ENDED" : `${item.remaining}s`}</small></span>) : <em>NO POWER-UPS YET</em>}</div>
        </div>
      </section>
      <div className="game-frame">
        <canvas ref={canvasRef} width={W} height={H} aria-label="Infinite Breaker game area" />
        <button className={`frame-fullscreen ${fullscreen ? "active" : ""}`} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} onPointerDown={(e) => e.stopPropagation()} onClick={onToggleFullscreen}>⛶<span>{fullscreen ? "EXIT" : "FULL"}</span></button>
        <div className="corner-label top-left">{session.route.toUpperCase()} ROUTE</div>
        <div className="corner-label top-right">COMBO {hud.combo}</div>
        <div className="world-label" style={{ borderColor: worldTheme.accent, color: worldTheme.accent }}>{worldTheme.name}</div>
        {levelEvent && <div className="event-label">EVENT · {levelEvent}</div>}
        {toast && <div className={`game-toast ${toast.includes("HIGH") ? "record" : ""}`}>{toast}</div>}
        {hud.awaitingLaunch && !paused && <div className="launch-prompt"><strong>READY?</strong><span>CLICK · TAP · SPACE</span><small>AUTO-LAUNCH IN {hud.launchSeconds}</small></div>}
        {tutorial > 0 && <div className="pause-overlay tutorial-overlay"><div className="pause-card tutorial-card"><p>QUICK START · {tutorial}/3</p><h2>{tutorial === 1 ? "MOVE" : tutorial === 2 ? "BUILD STYLE" : "OVERDRIVE"}</h2><span>{tutorial === 1 ? "Move your pointer anywhere on the arena—or drag inside the touch zone below it." : tutorial === 2 ? "Precise hits and uninterrupted destruction raise Combo and your Style Rank." : "Fill the cyan meter. Press Space or ACTIVATE to unleash Fireball, Laser and Magnet together."}</span><button className="big-action" onClick={() => { if (tutorial < 3) setTutorial(tutorial + 1); else { localStorage.setItem("infinite-breaker-tutorial-v2", "done"); setTutorial(0); beginResume(); } }}>{tutorial < 3 ? "NEXT" : "START RUN"}</button><button className="text-button" onClick={() => { localStorage.setItem("infinite-breaker-tutorial-v2", "done"); setTutorial(0); beginResume(); }}>SKIP TUTORIAL</button></div></div>}
        {paused && tutorial === 0 && (
          <div className={`pause-overlay ${countdown !== null ? "counting" : ""}`}>
            {countdown === null ? (
              <div className="pause-card">
                <p>GAME PAUSED</p><h2>TAKE FIVE</h2>
                <button className="big-action" onClick={beginResume}>RESUME</button>
                <button className="text-button" onClick={() => onExit({ score: hud.score, lives: hud.lives })}>SAVE & EXIT</button>
                <small>P / ESC · RESUME WITH COUNTDOWN</small>
              </div>
            ) : (
              <div className="countdown-card" aria-live="assertive">
                <p>GET READY</p>
                <strong className="countdown-number">{countdown}</strong>
                <span>LOCATE THE BALL AND PADDLE</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div ref={controlRef} className="mobile-control-zone" aria-label="Touch paddle control area"><span>{hud.awaitingLaunch ? "TAP HERE TO LAUNCH · DRAG TO MOVE" : "DRAG ANYWHERE HERE TO MOVE"}</span><i /><button onPointerDown={(e) => e.stopPropagation()} disabled={hud.overdrive < 100 || hud.awaitingLaunch} onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }))}>⚡</button></div>
      <footer className="game-footer"><span>F · FULLSCREEN</span><b>{session.mode === "campaign" ? `NEXT REFILL · ${10 - ((session.level - 1) % 10)} STRUCTURES` : `${hud.style} STYLE · ${hud.combo} COMBO`}</b><span>P / ESC · SPACE LAUNCH/OVERDRIVE</span></footer>
    </div>
  );
}
