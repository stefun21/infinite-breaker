"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BreakerGame } from "./breaker-game";

export type GameMode = "campaign" | "casual";
export type RouteKind = "safe" | "normal" | "risky";
export type CasualStyle = "chill" | "classic" | "chaos";
export type RunVariant = "classic" | "zen" | "time-attack" | "one-ball" | "boss-rush" | "chaos" | "endless" | "mirror" | "daily" | "custom";
export type UpgradeId =
  | "wide-start" | "safety-net" | "lucky-bricks" | "strong-start"
  | "power-duration" | "curse-resistance" | "heart-hunter" | "ball-insurance"
  | "combo-keeper" | "overdrive-core" | "precision-engine" | "drop-magnet"
  | "blast-radius" | "phoenix-protocol" | "score-bank" | "cursed-power";

export interface RunSession {
  mode: GameMode;
  level: number;
  score: number;
  lives: number;
  route: RouteKind;
  upgrades: UpgradeId[];
  upgradeLevels?: Partial<Record<UpgradeId, number>>;
  casualStyle: CasualStyle;
  badPowerups: boolean;
  variant?: RunVariant;
  timeLimit?: number;
  riskLevel?: number;
  seed?: number;
}

export interface GameSettings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  colorblind: boolean;
  screenShake: number;
  quality: number;
}

export interface Cosmetics {
  ball: string;
  paddle: string;
  trail: string;
}

interface LocalStats {
  gamesPlayed: number; structuresCleared: number; bricksBroken: number; powerupsCaught: number; bestLevel: number;
  highestCombo: number; fastestClear: number; longestRun: number; maxBalls: number; bossesDefeated: number; livesSaved: number;
  recentRuns: Array<{ score: number; level: number; variant: string; date: string }>;
}

interface CollectionData extends Cosmetics { unlocked: string[]; achievements: string[]; }
type View = "menu" | "map" | "modes" | "game" | "results" | "upgrade" | "game-over" | "how-to" | "settings" | "stats" | "collection";

const SAVE_KEY = "infinite-breaker-campaign-v2";
const HIGH_KEY = "infinite-breaker-high-score-v2";
const STATS_KEY = "infinite-breaker-stats-v2";
const SETTINGS_KEY = "infinite-breaker-settings-v2";
const COLLECTION_KEY = "infinite-breaker-collection-v2";
const DEFAULT_SETTINGS: GameSettings = { music: true, sfx: true, reducedMotion: false, highContrast: false, colorblind: false, screenShake: 1, quality: 2 };
const EMPTY_STATS: LocalStats = { gamesPlayed: 0, structuresCleared: 0, bricksBroken: 0, powerupsCaught: 0, bestLevel: 0, highestCombo: 0, fastestClear: 0, longestRun: 0, maxBalls: 1, bossesDefeated: 0, livesSaved: 0, recentRuns: [] };
const DEFAULT_COLLECTION: CollectionData = { ball: "classic", paddle: "sunset", trail: "spark", unlocked: ["classic", "sunset", "spark"], achievements: [] };

const UPGRADE_INFO: Record<UpgradeId, { title: string; description: string; icon: string; rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" }> = {
  "wide-start": { title: "WIDE START", description: "A wider paddle. Stacks up to level III.", icon: "↔", rarity: "COMMON" },
  "safety-net": { title: "SAFETY NET", description: "Rescue the first missed ball in each structure.", icon: "▰", rarity: "RARE" },
  "lucky-bricks": { title: "LUCKY BRICKS", description: "More positive and rare power drops.", icon: "✦", rarity: "COMMON" },
  "strong-start": { title: "HOT START", description: "Begin each structure with Fireball.", icon: "◆", rarity: "RARE" },
  "power-duration": { title: "LONG POWER", description: "Positive effects last longer.", icon: "+", rarity: "COMMON" },
  "curse-resistance": { title: "CURSE SHIELD", description: "Negative effects expire faster.", icon: "◇", rarity: "COMMON" },
  "heart-hunter": { title: "HEART HUNTER", description: "Extra-life blocks appear more often.", icon: "♥", rarity: "EPIC" },
  "ball-insurance": { title: "BALL INSURANCE", description: "Begin each structure with two balls.", icon: "●●", rarity: "EPIC" },
  "combo-keeper": { title: "COMBO KEEPER", description: "One miss no longer resets the combo.", icon: "×", rarity: "RARE" },
  "overdrive-core": { title: "OVERDRIVE CORE", description: "Charge Overdrive faster and extend it.", icon: "⚡", rarity: "EPIC" },
  "precision-engine": { title: "PRECISION ENGINE", description: "Perfect brick and paddle hits score more.", icon: "◎", rarity: "RARE" },
  "drop-magnet": { title: "DROP MAGNET", description: "Helpful drops bend toward the paddle.", icon: "∩", rarity: "COMMON" },
  "blast-radius": { title: "BLAST RADIUS", description: "Explosions and shockwaves reach farther.", icon: "✹", rarity: "EPIC" },
  "phoenix-protocol": { title: "PHOENIX PROTOCOL", description: "Once per zone, a lost ball returns burning.", icon: "♨", rarity: "LEGENDARY" },
  "score-bank": { title: "SCORE BANK", description: "Protect 20% of score and increase clear rewards.", icon: "▣", rarity: "RARE" },
  "cursed-power": { title: "CURSED POWER", description: "Huge score multiplier, but curses last longer.", icon: "☠", rarity: "LEGENDARY" },
};

const MODES: Array<{ id: RunVariant; icon: string; title: string; copy: string }> = [
  { id: "zen", icon: "○", title: "ZEN", copy: "No negative drops. Gentle speed. No pressure." },
  { id: "time-attack", icon: "◷", title: "TIME ATTACK", copy: "Two minutes. Clear and score as much as possible." },
  { id: "one-ball", icon: "●", title: "ONE BALL", copy: "One miss ends the run. Triple score." },
  { id: "boss-rush", icon: "♛", title: "BOSS RUSH", copy: "Fight a new multi-phase boss every round." },
  { id: "chaos", icon: "✹", title: "CHAOS", copy: "Power storms, multiball, fast action." },
  { id: "endless", icon: "∞", title: "ENDLESS TOWER", copy: "Infinite procedural structures and scaling speed." },
  { id: "mirror", icon: "◫", title: "MIRROR", copy: "The arena and controls periodically reverse." },
  { id: "daily", icon: "◆", title: "DAILY SEED", copy: "A deterministic challenge generated from today." },
  { id: "custom", icon: "⚙", title: "CUSTOM RUN", copy: "Choose danger, speed, and negative drops." },
];

const COLLECTION_ITEMS = [
  { id: "classic", kind: "BALL", unlock: 0 }, { id: "plasma", kind: "BALL", unlock: 5 }, { id: "void", kind: "BALL", unlock: 15 }, { id: "prism", kind: "BALL", unlock: 30 },
  { id: "sunset", kind: "PADDLE", unlock: 0 }, { id: "mint", kind: "PADDLE", unlock: 10 }, { id: "gold", kind: "PADDLE", unlock: 20 }, { id: "boss", kind: "PADDLE", unlock: 40 },
  { id: "spark", kind: "TRAIL", unlock: 0 }, { id: "comet", kind: "TRAIL", unlock: 8 }, { id: "rainbow", kind: "TRAIL", unlock: 25 }, { id: "glitch", kind: "TRAIL", unlock: 50 },
];

function loadJson<T>(key: string, fallback: T): T { try { const value = typeof window === "undefined" ? null : localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function zoneFor(level: number) { return ["SUNSET GRID", "LASER DISTRICT", "VIOLET VAULT", "MINT CIRCUIT", "GOLDEN CORE"][Math.floor((level - 1) / 10) % 5]; }
function eventFor(level: number) { if (level % 10 === 0) return "BOSS ENCOUNTER"; if (level % 13 === 0) return "MYSTERY VAULT"; if (level % 11 === 0) return "POWER SURGE"; if (level % 9 === 0) return "GLASS GARDEN"; if (level % 8 === 0) return "BOMB GRID"; if (level % 7 === 0) return "MOVING LINES"; return null; }
function dailySeed() { const d = new Date(); return Number(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`); }

export default function Home() {
  const [view, setView] = useState<View>("menu");
  const [session, setSession] = useState<RunSession | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [stats, setStats] = useState<LocalStats>(EMPTY_STATS);
  const [savedRun, setSavedRun] = useState<RunSession | null>(null);
  const [lastClear, setLastClear] = useState({ score: 0, level: 1, lives: 5, combo: 0, clearMs: 0 });
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [collection, setCollection] = useState<CollectionData>(DEFAULT_COLLECTION);
  const [confirmReset, setConfirmReset] = useState(false);
  const [rerolls, setRerolls] = useState(1);
  const [choiceSalt, setChoiceSalt] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHighScore(Number(localStorage.getItem(HIGH_KEY) || 0));
      setStats(loadJson(STATS_KEY, EMPTY_STATS)); setSavedRun(loadJson<RunSession | null>(SAVE_KEY, null));
      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
      const autoSettings = deviceMemory <= 4 ? { ...DEFAULT_SETTINGS, quality: 1, screenShake: 0 } : DEFAULT_SETTINGS;
      setSettings(loadJson(SETTINGS_KEY, autoSettings)); setCollection(loadJson(COLLECTION_KEY, DEFAULT_COLLECTION));
      if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const persistStats = (next: LocalStats) => { setStats(next); localStorage.setItem(STATS_KEY, JSON.stringify(next)); };
  const persistCollection = (next: CollectionData) => { setCollection(next); localStorage.setItem(COLLECTION_KEY, JSON.stringify(next)); };
  const persistCampaign = (next: RunSession | null) => { setSavedRun(next); if (next) localStorage.setItem(SAVE_KEY, JSON.stringify(next)); else localStorage.removeItem(SAVE_KEY); };
  const baseSession = (mode: GameMode, variant: RunVariant = "classic"): RunSession => ({ mode, level: variant === "boss-rush" ? 10 : 1, score: 0, lives: mode === "campaign" ? 5 : 999, route: variant === "zen" ? "safe" : variant === "chaos" ? "risky" : "normal", upgrades: [], upgradeLevels: {}, casualStyle: variant === "zen" ? "chill" : variant === "chaos" ? "chaos" : "classic", badPowerups: variant !== "zen", variant, timeLimit: variant === "time-attack" ? 120 : undefined, riskLevel: variant === "chaos" ? 3 : 1, seed: variant === "daily" ? dailySeed() : undefined });
  const beginCampaign = () => { const next = baseSession("campaign"); setSession(next); persistCampaign(next); setView("map"); };
  const continueCampaign = () => { if (savedRun) { setSession({ ...baseSession("campaign"), ...savedRun }); setView("map"); } };
  const startRoute = (route: RouteKind) => { if (!session) return; const next = { ...session, route }; setSession(next); persistCampaign(next); setView("game"); };
  const startVariant = (variant: RunVariant, custom?: { risk: number; bad: boolean }) => { const next = baseSession("casual", variant); if (custom) { next.riskLevel = custom.risk; next.badPowerups = custom.bad; next.route = custom.risk >= 3 ? "risky" : custom.risk === 1 ? "safe" : "normal"; } setSession(next); setView("game"); };
  const handleHighScore = (score: number) => { setHighScore(score); localStorage.setItem(HIGH_KEY, String(score)); };

  const unlockProgress = (bestLevel: number, bosses: number) => {
    const unlocked = new Set(collection.unlocked);
    COLLECTION_ITEMS.filter((item) => bestLevel >= item.unlock).forEach((item) => unlocked.add(item.id));
    const achievements = new Set(collection.achievements);
    if (bestLevel >= 10) achievements.add("FIRST BOSS"); if (bestLevel >= 25) achievements.add("NEON VETERAN"); if (bosses >= 5) achievements.add("BOSS BREAKER");
    persistCollection({ ...collection, unlocked: [...unlocked], achievements: [...achievements] });
  };

  const handleLevelClear = (result: { score: number; lives: number; bricks: number; powerups: number; combo?: number; maxBalls?: number; clearMs?: number; boss?: boolean; livesSaved?: number }) => {
    if (!session) return;
    const completedLevel = session.level; const checkpoint = session.mode === "campaign" && completedLevel % 10 === 0;
    const step = session.variant === "boss-rush" ? 10 : 1;
    const next = { ...session, level: completedLevel + step, score: result.score, lives: checkpoint ? 5 : result.lives };
    setSession(next); setLastClear({ score: result.score, level: completedLevel, lives: next.lives, combo: result.combo || 0, clearMs: result.clearMs || 0 });
    const nextStats: LocalStats = { ...stats, structuresCleared: stats.structuresCleared + 1, bricksBroken: stats.bricksBroken + result.bricks, powerupsCaught: stats.powerupsCaught + result.powerups, bestLevel: Math.max(stats.bestLevel, completedLevel), highestCombo: Math.max(stats.highestCombo, result.combo || 0), fastestClear: !stats.fastestClear ? result.clearMs || 0 : Math.min(stats.fastestClear, result.clearMs || stats.fastestClear), longestRun: Math.max(stats.longestRun, completedLevel), maxBalls: Math.max(stats.maxBalls, result.maxBalls || 1), bossesDefeated: stats.bossesDefeated + (result.boss ? 1 : 0), livesSaved: stats.livesSaved + (result.livesSaved || 0) };
    persistStats(nextStats); unlockProgress(nextStats.bestLevel, nextStats.bossesDefeated); if (session.mode === "campaign") persistCampaign(next);
    setRerolls(1); setChoiceSalt(0); setView(checkpoint ? "upgrade" : "results");
  };

  const handleGameOver = (result: { score: number; level: number; bricks: number; powerups: number; combo?: number; maxBalls?: number }) => {
    const run = { score: result.score, level: result.level, variant: session?.variant || "campaign", date: new Date().toISOString().slice(0, 10) };
    persistStats({ ...stats, gamesPlayed: stats.gamesPlayed + 1, bricksBroken: stats.bricksBroken + result.bricks, powerupsCaught: stats.powerupsCaught + result.powerups, bestLevel: Math.max(stats.bestLevel, result.level), highestCombo: Math.max(stats.highestCombo, result.combo || 0), longestRun: Math.max(stats.longestRun, result.level), maxBalls: Math.max(stats.maxBalls, result.maxBalls || 1), recentRuns: [run, ...stats.recentRuns].slice(0, 10) });
    setLastClear({ score: result.score, level: result.level, lives: 0, combo: result.combo || 0, clearMs: 0 }); if (session?.mode === "campaign") persistCampaign(null); setView("game-over");
  };

  const exitGame = (snapshot?: { score: number; lives: number }) => { if (session?.mode === "campaign") { const next = snapshot ? { ...session, ...snapshot } : session; setSession(next); persistCampaign(next); } setView("menu"); };
  const nextAfterResults = () => { if (session) setView(session.mode === "campaign" ? "map" : "game"); };
  const upgradeChoices = useMemo(() => { const all = Object.keys(UPGRADE_INFO) as UpgradeId[]; const offset = ((session?.level || 0) + choiceSalt * 5) % all.length; return [all[offset], all[(offset + 5) % all.length], all[(offset + 9) % all.length]]; }, [session, choiceSalt]);
  const chooseUpgrade = (id: UpgradeId) => { if (!session) return; const level = Math.min(3, (session.upgradeLevels?.[id] || 0) + 1); const levels = { ...session.upgradeLevels, [id]: level }; const next = { ...session, upgrades: Array.from(new Set([...session.upgrades, id])), upgradeLevels: levels }; setSession(next); persistCampaign(next); setView("map"); };
  const skipUpgrade = () => { if (!session) return; const next = { ...session, score: session.score + 750, lives: Math.min(7, session.lives + 1) }; setSession(next); persistCampaign(next); setView("map"); };
  const updateSettings = (patch: Partial<GameSettings>) => { const next = { ...settings, ...patch }; setSettings(next); localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); };
  const resetAllData = () => { [SAVE_KEY, HIGH_KEY, STATS_KEY, SETTINGS_KEY, COLLECTION_KEY, "infinite-breaker-tutorial-v2"].forEach((key) => localStorage.removeItem(key)); setHighScore(0); setStats(EMPTY_STATS); setSavedRun(null); setSession(null); setSettings(DEFAULT_SETTINGS); setCollection(DEFAULT_COLLECTION); setConfirmReset(false); setView("menu"); };
  const exportSave = () => { const blob = new Blob([JSON.stringify({ version: 2, highScore, stats, savedRun, settings, collection }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "infinite-breaker-save.json"; a.click(); URL.revokeObjectURL(url); };
  const importSave = (file?: File) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(String(reader.result)); if (data.highScore >= 0 && data.stats && data.settings) { setHighScore(data.highScore); setStats(data.stats); setSavedRun(data.savedRun || null); setSettings({ ...DEFAULT_SETTINGS, ...data.settings }); setCollection({ ...DEFAULT_COLLECTION, ...data.collection }); localStorage.setItem(HIGH_KEY, String(data.highScore)); localStorage.setItem(STATS_KEY, JSON.stringify(data.stats)); localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...data.settings })); localStorage.setItem(COLLECTION_KEY, JSON.stringify({ ...DEFAULT_COLLECTION, ...data.collection })); if (data.savedRun) localStorage.setItem(SAVE_KEY, JSON.stringify(data.savedRun)); alert("SAVE IMPORTED"); } } catch { alert("INVALID SAVE FILE"); } }; reader.readAsText(file); };

  return (
    <main className={`app-shell ${view === "game" ? "game-view" : "menu-view"} ${settings.reducedMotion ? "reduced-motion" : ""} ${settings.highContrast ? "high-contrast" : ""}`}>
      <div className="scanlines" aria-hidden="true" /><div className="pixel-stars" aria-hidden="true" />
      {view === "game" && session ? (
        <BreakerGame key={`${session.mode}-${session.level}-${session.route}-${session.score}-${session.variant}`} session={session} highScore={highScore} settings={settings} cosmetics={collection} onHighScore={handleHighScore} onLevelClear={handleLevelClear} onGameOver={handleGameOver} onExit={exitGame} />
      ) : (
        <div className="cabinet-wrap">
          <header className="brand-lockup"><p className="eyebrow">SUPREME ARCADE EDITION</p><h1>INFINITE<br /><span>BREAKER</span></h1><div className="brand-rule"><i /><b>∞</b><i /></div></header>
          <section className="arcade-panel">
            {view === "menu" && <div className="screen menu-screen"><div className="score-strip"><span>LOCAL HIGH SCORE</span><strong>{highScore.toLocaleString("en-US").padStart(8, "0")}</strong></div><nav className="menu-list" aria-label="Main menu">
              <button className="menu-button primary" onClick={continueCampaign} disabled={!savedRun}><span>▶</span> CONTINUE CAMPAIGN</button>
              <button className="menu-button" onClick={beginCampaign}><span>◆</span> NEW CAMPAIGN</button>
              <button className="menu-button supreme" onClick={() => setView("modes")}><span>♛</span> SUPREME MODES</button>
              <button className="menu-button" onClick={() => savedRun ? continueCampaign() : beginCampaign()}><span>▦</span> WORLD MAP</button>
              <button className="menu-button small" onClick={() => setView("collection")}><span>✦</span> COLLECTION</button><button className="menu-button small" onClick={() => setView("stats")}><span>▥</span> STATS</button>
              <button className="menu-button small" onClick={() => setView("how-to")}><span>?</span> HOW TO</button><button className="menu-button small" onClick={() => setView("settings")}><span>⚙</span> SETTINGS</button>
            </nav><p className="screen-hint">MOUSE · KEYS · TOUCH ZONE · SPACE OVERDRIVE</p></div>}

            {view === "modes" && <ModesScreen onBack={() => setView("menu")} onStart={startVariant} />}
            {view === "map" && session && <div className="screen sub-screen"><ScreenHeader title="SELECT ROUTE" onBack={() => setView("menu")} /><div className="zone-banner"><span>ZONE {Math.floor((session.level - 1) / 10) + 1}</span><strong>{zoneFor(session.level)}</strong><em>STRUCTURE {session.level}</em></div>{eventFor(session.level) && <div className="map-event">SPECIAL EVENT · <b>{eventFor(session.level)}</b></div>}<ZoneTrack level={session.level} /><div className="route-grid"><ChoiceCard icon="○" title="SAFE" tone="mint" onClick={() => startRoute("safe")}>More help · score ×0.85</ChoiceCard><ChoiceCard icon="◇" title="NORMAL" tone="gold" onClick={() => startRoute("normal")}>Balanced · score ×1</ChoiceCard><ChoiceCard icon="▲" title="RISKY" tone="pink" onClick={() => startRoute("risky")}>Harder · score ×1.5</ChoiceCard></div><div className="run-readout"><span>LIVES <b>{"♥".repeat(Math.min(session.lives, 7))}</b></span><span>SCORE <b>{session.score.toLocaleString("en-US")}</b></span><span>BUILD <b>{session.upgrades.length}</b></span></div>{session.upgrades.length > 0 && <div className="active-upgrades">{session.upgrades.map((id) => <span key={id}>{UPGRADE_INFO[id].icon} {UPGRADE_INFO[id].title} · LV{session.upgradeLevels?.[id] || 1}</span>)}</div>}</div>}

            {view === "results" && session && <div className="screen sub-screen center-screen"><p className="success-kicker">PERFECT CLEAR MOMENT</p><h2 className="giant-number">{String(lastClear.level).padStart(2, "0")}</h2><div className="result-grid"><span>SCORE<strong>{lastClear.score.toLocaleString("en-US")}</strong></span><span>BEST COMBO<strong>×{lastClear.combo}</strong></span><span>CLEAR TIME<strong>{(lastClear.clearMs / 1000).toFixed(1)}s</strong></span></div>{session.mode === "campaign" && <CheckpointProgress completed={lastClear.level % 10} />}<button className="big-action" onClick={nextAfterResults}>{session.mode === "campaign" ? "CHOOSE NEXT ROUTE" : "NEXT STRUCTURE"} ▶</button><button className="text-button" onClick={() => setView("menu")}>RETURN TO MENU</button></div>}

            {view === "upgrade" && session && <div className="screen sub-screen"><ScreenHeader title="CHECKPOINT VAULT" /><p className="checkpoint-copy">LIVES REFILLED · BUILD SYNERGIES · STACK TO LEVEL III</p><div className="upgrade-grid">{upgradeChoices.map((id) => <ChoiceCard key={id} icon={UPGRADE_INFO[id].icon} title={UPGRADE_INFO[id].title} tone={UPGRADE_INFO[id].rarity === "LEGENDARY" ? "pink" : "gold"} onClick={() => chooseUpgrade(id)}><b>{UPGRADE_INFO[id].rarity}</b> · {UPGRADE_INFO[id].description}</ChoiceCard>)}</div><div className="upgrade-actions"><button disabled={!rerolls} onClick={() => { setChoiceSalt((v) => v + 1); setRerolls(0); }}>REROLL {rerolls ? "×1" : "USED"}</button><button onClick={skipUpgrade}>SKIP · +1 LIFE +750 SCORE</button></div></div>}

            {view === "game-over" && <div className="screen sub-screen center-screen"><p className="danger-kicker">RUN TERMINATED</p><h2>GAME OVER</h2><div className="final-score"><span>FINAL SCORE</span><strong>{lastClear.score.toLocaleString("en-US")}</strong><small>HIGH SCORE · {highScore.toLocaleString("en-US")}</small></div><div className="result-grid compact"><span>STRUCTURE<strong>{lastClear.level}</strong></span><span>COMBO<strong>×{lastClear.combo}</strong></span><span>MODE<strong>{session?.variant?.toUpperCase() || "CAMPAIGN"}</strong></span></div><button className="big-action" onClick={() => session?.mode === "campaign" ? beginCampaign() : setView("modes")}>PLAY AGAIN</button><button className="text-button" onClick={() => setView("menu")}>RETURN TO MENU</button></div>}

            {view === "how-to" && <div className="screen sub-screen scroll-screen"><ScreenHeader title="HOW TO PLAY" onBack={() => setView("menu")} /><div className="instruction-grid"><InfoBlock n="01" title="MOVE">Move anywhere across the canvas or the large touch zone below it. Mouse, touch and A/D work.</InfoBlock><InfoBlock n="02" title="STYLE">Perfect hits, saves and uninterrupted destruction build Combo and the SSS Style Rank.</InfoBlock><InfoBlock n="03" title="OVERDRIVE">Fill the cyan meter, then press Space or the on-screen button to unleash Overdrive.</InfoBlock><InfoBlock n="04" title="BUILD">Fuse power-ups, stack checkpoint upgrades, discover blocks and defeat multi-phase bosses.</InfoBlock></div><div className="legend-row"><span className="legend good">GOOD</span><span className="legend bad">CURSE</span><span className="legend heart">LEGENDARY</span></div></div>}

            {view === "collection" && <div className="screen sub-screen scroll-screen"><ScreenHeader title="COLLECTION" onBack={() => setView("menu")} /><p className="checkpoint-copy">UNLOCKED BY PLAYING · NO SHOP · NO ACCOUNT</p><div className="collection-grid">{COLLECTION_ITEMS.map((item) => { const open = collection.unlocked.includes(item.id); const selected = collection[item.kind === "BALL" ? "ball" : item.kind === "PADDLE" ? "paddle" : "trail"] === item.id; return <button key={item.id} disabled={!open} className={selected ? "selected" : ""} onClick={() => { const key = item.kind === "BALL" ? "ball" : item.kind === "PADDLE" ? "paddle" : "trail"; persistCollection({ ...collection, [key]: item.id }); }}><i className={`cosmetic-preview ${item.id}`} /><strong>{item.id.toUpperCase()}</strong><small>{open ? item.kind : `REACH ${item.unlock}`}</small></button>; })}</div><div className="achievement-row">{collection.achievements.length ? collection.achievements.map((a) => <span key={a}>★ {a}</span>) : <span>ACHIEVEMENTS APPEAR HERE</span>}</div></div>}

            {view === "stats" && <div className="screen sub-screen scroll-screen"><ScreenHeader title="LOCAL RECORDS" onBack={() => setView("menu")} /><div className="stats-grid supreme-stats"><Stat label="HIGH SCORE" value={highScore} /><Stat label="BEST STRUCTURE" value={stats.bestLevel} /><Stat label="HIGHEST COMBO" value={stats.highestCombo} /><Stat label="FASTEST CLEAR" value={stats.fastestClear ? `${(stats.fastestClear / 1000).toFixed(1)}s` : "—"} /><Stat label="MAX BALLS" value={stats.maxBalls} /><Stat label="BOSSES DEFEATED" value={stats.bossesDefeated} /><Stat label="BRICKS BROKEN" value={stats.bricksBroken} /><Stat label="POWER-UPS" value={stats.powerupsCaught} /></div><div className="history-list"><b>RECENT RUNS</b>{stats.recentRuns.length ? stats.recentRuns.map((run, i) => <span key={`${run.date}-${i}`}><em>{run.variant.toUpperCase()}</em><strong>{run.score.toLocaleString("en-US")}</strong><small>LV {run.level} · {run.date}</small></span>) : <p>NO FINISHED RUNS YET</p>}</div></div>}

            {view === "settings" && <div className="screen sub-screen scroll-screen"><ScreenHeader title="SETTINGS" onBack={() => setView("menu")} /><div className="settings-list"><Toggle label="SYNTHWAVE MUSIC" value={settings.music} onChange={(music) => updateSettings({ music })} /><Toggle label="ARCADE SFX" value={settings.sfx} onChange={(sfx) => updateSettings({ sfx })} /><Toggle label="REDUCED MOTION" value={settings.reducedMotion} onChange={(reducedMotion) => updateSettings({ reducedMotion })} /><Toggle label="HIGH CONTRAST" value={settings.highContrast} onChange={(highContrast) => updateSettings({ highContrast })} /><Toggle label="COLORBLIND SYMBOLS" value={settings.colorblind} onChange={(colorblind) => updateSettings({ colorblind })} /><Range label="SCREEN SHAKE" value={settings.screenShake} max={2} onChange={(screenShake) => updateSettings({ screenShake })} /><Range label="EFFECT QUALITY" value={settings.quality} max={2} onChange={(quality) => updateSettings({ quality })} /></div><div className="utility-actions"><button onClick={() => document.documentElement.requestFullscreen?.()}>FULLSCREEN</button><button onClick={exportSave}>EXPORT SAVE</button><button onClick={() => importRef.current?.click()}>IMPORT SAVE</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => importSave(e.target.files?.[0])} /></div><div className="danger-zone">{!confirmReset ? <button className="reset-button" onClick={() => setConfirmReset(true)}>RESET ALL LOCAL DATA</button> : <div className="confirm-reset" role="alert"><strong>RESET EVERYTHING?</strong><p>This deletes all progress, unlocks, records and settings. This cannot be undone.</p><div className="confirm-actions"><button onClick={() => setConfirmReset(false)}>CANCEL</button><button className="danger-confirm" onClick={resetAllData}>YES, RESET</button></div></div>}</div></div>}
          </section>
          <footer className="cabinet-footer"><span>© 2026 INFINITE BREAKER</span><b>SUPREME SYSTEM ONLINE</b><span>V2.1</span></footer>
        </div>
      )}
    </main>
  );
}

function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) { return <div className="screen-header">{onBack ? <button onClick={onBack} aria-label="Back">◀</button> : <i />}<h2>{title}</h2><i /></div>; }
function ChoiceCard({ icon, title, tone, onClick, children }: { icon: string; title: string; tone: string; onClick: () => void; children: React.ReactNode }) { return <button className={`choice-card ${tone}`} onClick={onClick}><span className="choice-icon">{icon}</span><strong>{title}</strong><small>{children}</small></button>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <button className="toggle-row" onClick={() => onChange(!value)}><span>{label}</span><b className={value ? "on" : ""}><i /></b><em>{value ? "ON" : "OFF"}</em></button>; }
function Range({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) { return <label className="range-row"><span>{label}</span><input type="range" min="0" max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /><em>{["OFF", "LOW", "HIGH"][value]}</em></label>; }
function InfoBlock({ n, title, children }: { n: string; title: string; children: React.ReactNode }) { return <article className="info-block"><span>{n}</span><h3>{title}</h3><p>{children}</p></article>; }
function Stat({ label, value }: { label: string; value: number | string }) { return <div className="stat-card"><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString("en-US") : value}</strong></div>; }

function ZoneTrack({ level }: { level: number }) { const current = ((level - 1) % 10) + 1; return <div className="zone-track-wrap"><div className="zone-track-line"><i style={{ width: `${((current - 1) / 9) * 100}%` }} /></div><div className="zone-nodes">{Array.from({ length: 10 }, (_, index) => { const step = index + 1; const state = step < current ? "done" : step === current ? "current" : "upcoming"; return <span key={step} className={`${state} ${step === 10 ? "boss" : ""}`}><b>{step === 10 ? "B" : step}</b><em>{step < current ? "✓" : step === current ? "YOU" : ""}</em></span>; })}</div><div className="zone-track-caption"><span>ZONE START</span><strong>{10 - current} UNTIL BOSS</strong><span>CHECKPOINT + REFILL</span></div></div>; }
function CheckpointProgress({ completed }: { completed: number }) { return <div className="checkpoint-progress"><div><span>ZONE PROGRESS</span><b>{completed}/10</b></div><i><em style={{ width: `${completed * 10}%` }} /></i><small>{10 - completed} STRUCTURES UNTIL CHECKPOINT</small></div>; }

function ModesScreen({ onBack, onStart }: { onBack: () => void; onStart: (variant: RunVariant, custom?: { risk: number; bad: boolean }) => void }) {
  const [custom, setCustom] = useState(false); const [risk, setRisk] = useState(1); const [bad, setBad] = useState(true);
  return <div className="screen sub-screen scroll-screen"><ScreenHeader title="SUPREME MODES" onBack={onBack} /><div className="mode-grid">{MODES.map((mode) => <button key={mode.id} onClick={() => mode.id === "custom" ? setCustom(true) : onStart(mode.id)}><span>{mode.icon}</span><strong>{mode.title}</strong><small>{mode.copy}</small></button>)}</div>{custom && <div className="custom-panel"><Range label="DANGER LEVEL" value={risk} max={2} onChange={setRisk} /><Toggle label="NEGATIVE POWER-UPS" value={bad} onChange={setBad} /><button className="big-action" onClick={() => onStart("custom", { risk: risk + 1, bad })}>START CUSTOM RUN</button></div>}</div>;
}
