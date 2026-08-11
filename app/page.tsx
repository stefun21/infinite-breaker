"use client";

import { useEffect, useMemo, useState } from "react";
import { BreakerGame } from "./breaker-game";

export type GameMode = "campaign" | "casual";
export type RouteKind = "safe" | "normal" | "risky";
export type CasualStyle = "chill" | "classic" | "chaos";
export type UpgradeId =
  | "wide-start"
  | "safety-net"
  | "lucky-bricks"
  | "strong-start"
  | "power-duration"
  | "curse-resistance"
  | "heart-hunter"
  | "ball-insurance";

export interface RunSession {
  mode: GameMode;
  level: number;
  score: number;
  lives: number;
  route: RouteKind;
  upgrades: UpgradeId[];
  casualStyle: CasualStyle;
  badPowerups: boolean;
}

interface LocalStats {
  gamesPlayed: number;
  structuresCleared: number;
  bricksBroken: number;
  powerupsCaught: number;
  bestLevel: number;
}

type View =
  | "menu"
  | "map"
  | "casual-setup"
  | "game"
  | "results"
  | "upgrade"
  | "game-over"
  | "how-to"
  | "settings"
  | "stats";

interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
}

const SAVE_KEY = "infinite-breaker-campaign-v1";
const HIGH_KEY = "infinite-breaker-high-score-v1";
const STATS_KEY = "infinite-breaker-stats-v1";
const SETTINGS_KEY = "infinite-breaker-settings-v1";
const DEFAULT_SETTINGS: Settings = { music: true, sfx: true, reducedMotion: false };

const EMPTY_STATS: LocalStats = {
  gamesPlayed: 0,
  structuresCleared: 0,
  bricksBroken: 0,
  powerupsCaught: 0,
  bestLevel: 0,
};

const UPGRADE_INFO: Record<UpgradeId, { title: string; description: string; icon: string }> = {
  "wide-start": { title: "WIDE START", description: "Begin every structure with a wider paddle.", icon: "↔" },
  "safety-net": { title: "SAFETY NET", description: "The first missed ball in each level is rescued.", icon: "▰" },
  "lucky-bricks": { title: "LUCKY BRICKS", description: "Good drops appear more often.", icon: "✦" },
  "strong-start": { title: "HOT START", description: "Start every level with a temporary fireball.", icon: "◆" },
  "power-duration": { title: "LONG POWER", description: "Positive effects last 35% longer.", icon: "+" },
  "curse-resistance": { title: "CURSE SHIELD", description: "Negative effects expire 40% sooner.", icon: "◇" },
  "heart-hunter": { title: "HEART HUNTER", description: "Extra-life blocks appear more often.", icon: "♥" },
  "ball-insurance": { title: "BALL INSURANCE", description: "Begin every structure with two balls.", icon: "●●" },
};

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function zoneFor(level: number) {
  const zones = ["SUNSET GRID", "LASER DISTRICT", "VIOLET VAULT", "MINT CIRCUIT", "GOLDEN CORE"];
  return zones[Math.floor((level - 1) / 10) % zones.length];
}

function eventFor(level: number) {
  if (level % 10 === 0) return "CORE BOSS";
  if (level % 11 === 0) return "POWER SURGE";
  if (level % 9 === 0) return "GLASS GARDEN";
  if (level % 8 === 0) return "BOMB GRID";
  if (level % 7 === 0) return "MOVING LINES";
  return null;
}

export default function Home() {
  const [view, setView] = useState<View>("menu");
  const [session, setSession] = useState<RunSession | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [stats, setStats] = useState<LocalStats>(EMPTY_STATS);
  const [savedRun, setSavedRun] = useState<RunSession | null>(null);
  const [lastClear, setLastClear] = useState({ score: 0, level: 1, lives: 5 });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHighScore(Number(window.localStorage.getItem(HIGH_KEY) || 0));
      setStats(loadJson(STATS_KEY, EMPTY_STATS));
      setSavedRun(loadJson<RunSession | null>(SAVE_KEY, null));
      setSettings(loadJson(SETTINGS_KEY, DEFAULT_SETTINGS));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const saveStats = (next: LocalStats) => {
    setStats(next);
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
  };

  const persistCampaign = (next: RunSession | null) => {
    setSavedRun(next);
    if (next) window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(SAVE_KEY);
  };

  const beginCampaign = () => {
    const next: RunSession = {
      mode: "campaign",
      level: 1,
      score: 0,
      lives: 5,
      route: "normal",
      upgrades: [],
      casualStyle: "classic",
      badPowerups: true,
    };
    setSession(next);
    persistCampaign(next);
    setView("map");
  };

  const continueCampaign = () => {
    if (!savedRun) return;
    setSession(savedRun);
    setView("map");
  };

  const startRoute = (route: RouteKind) => {
    if (!session) return;
    const next = { ...session, route };
    setSession(next);
    persistCampaign(next);
    setView("game");
  };

  const startCasual = (style: CasualStyle, badPowerups: boolean) => {
    setSession({
      mode: "casual",
      level: 1,
      score: 0,
      lives: 999,
      route: style === "chill" ? "safe" : style === "chaos" ? "risky" : "normal",
      upgrades: [],
      casualStyle: style,
      badPowerups,
    });
    setView("game");
  };

  const handleHighScore = (score: number) => {
    setHighScore(score);
    window.localStorage.setItem(HIGH_KEY, String(score));
  };

  const handleLevelClear = (result: { score: number; lives: number; bricks: number; powerups: number }) => {
    if (!session) return;
    const completedLevel = session.level;
    const checkpoint = session.mode === "campaign" && completedLevel % 10 === 0;
    const next: RunSession = {
      ...session,
      level: completedLevel + 1,
      score: result.score,
      lives: checkpoint ? 5 : result.lives,
    };
    setSession(next);
    setLastClear({ score: result.score, level: completedLevel, lives: next.lives });
    saveStats({
      ...stats,
      structuresCleared: stats.structuresCleared + 1,
      bricksBroken: stats.bricksBroken + result.bricks,
      powerupsCaught: stats.powerupsCaught + result.powerups,
      bestLevel: Math.max(stats.bestLevel, completedLevel),
    });
    if (session.mode === "campaign") persistCampaign(next);
    setView(checkpoint ? "upgrade" : "results");
  };

  const handleGameOver = (result: { score: number; level: number; bricks: number; powerups: number }) => {
    saveStats({
      ...stats,
      gamesPlayed: stats.gamesPlayed + 1,
      bricksBroken: stats.bricksBroken + result.bricks,
      powerupsCaught: stats.powerupsCaught + result.powerups,
      bestLevel: Math.max(stats.bestLevel, result.level),
    });
    setLastClear({ score: result.score, level: result.level, lives: 0 });
    persistCampaign(null);
    setView("game-over");
  };

  const exitGame = (snapshot?: { score: number; lives: number }) => {
    if (session?.mode === "campaign") {
      const next = snapshot ? { ...session, score: snapshot.score, lives: snapshot.lives } : session;
      setSession(next);
      persistCampaign(next);
    }
    setView("menu");
  };

  const nextAfterResults = () => {
    if (!session) return;
    setView(session.mode === "campaign" ? "map" : "game");
  };

  const upgradeChoices = useMemo(() => {
    const all = Object.keys(UPGRADE_INFO) as UpgradeId[];
    const offset = session ? session.level % all.length : 0;
    return [all[offset], all[(offset + 3) % all.length], all[(offset + 5) % all.length]];
  }, [session]);

  const chooseUpgrade = (id: UpgradeId) => {
    if (!session) return;
    const upgrades = [...session.upgrades.filter((item) => item !== id), id];
    const next = { ...session, upgrades };
    setSession(next);
    persistCampaign(next);
    setView("map");
  };

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const resetAllData = () => {
    [SAVE_KEY, HIGH_KEY, STATS_KEY, SETTINGS_KEY].forEach((key) => window.localStorage.removeItem(key));
    setHighScore(0);
    setStats(EMPTY_STATS);
    setSavedRun(null);
    setSession(null);
    setSettings(DEFAULT_SETTINGS);
    setConfirmReset(false);
    setView("menu");
  };

  return (
    <main className={`app-shell ${settings.reducedMotion ? "reduced-motion" : ""}`}>
      <div className="scanlines" aria-hidden="true" />
      <div className="pixel-stars" aria-hidden="true" />

      {view === "game" && session ? (
        <BreakerGame
          key={`${session.mode}-${session.level}-${session.route}-${session.score}`}
          session={session}
          highScore={highScore}
          settings={settings}
          onHighScore={handleHighScore}
          onLevelClear={handleLevelClear}
          onGameOver={handleGameOver}
          onExit={exitGame}
        />
      ) : (
        <div className="cabinet-wrap">
          <header className="brand-lockup">
            <p className="eyebrow">INSERT FUN · BREAK EVERYTHING</p>
            <h1>INFINITE<br /><span>BREAKER</span></h1>
            <div className="brand-rule"><i /><b>∞</b><i /></div>
          </header>

          <section className="arcade-panel">
            {view === "menu" && (
              <div className="screen menu-screen">
                <div className="score-strip">
                  <span>LOCAL HIGH SCORE</span><strong>{highScore.toLocaleString("en-US").padStart(8, "0")}</strong>
                </div>
                <nav className="menu-list" aria-label="Main menu">
                  <button className="menu-button primary" onClick={continueCampaign} disabled={!savedRun}>
                    <span>▶</span> CONTINUE CAMPAIGN
                  </button>
                  <button className="menu-button" onClick={beginCampaign}><span>◆</span> NEW CAMPAIGN</button>
                  <button className="menu-button" onClick={() => setView("casual-setup")}><span>∞</span> CASUAL PLAY</button>
                  <button className="menu-button" onClick={() => savedRun ? continueCampaign() : beginCampaign()}><span>▦</span> WORLD MAP</button>
                  <button className="menu-button small" onClick={() => setView("how-to")}><span>?</span> HOW TO PLAY</button>
                  <button className="menu-button small" onClick={() => setView("settings")}><span>⚙</span> SETTINGS</button>
                  <button className="menu-button small" onClick={() => setView("stats")}><span>▥</span> LOCAL STATS</button>
                </nav>
                <p className="screen-hint">MOUSE · ARROW KEYS · TOUCH</p>
              </div>
            )}

            {view === "map" && session && (
              <div className="screen sub-screen">
                <ScreenHeader title="SELECT ROUTE" onBack={() => setView("menu")} />
                <div className="zone-banner">
                  <span>ZONE {Math.floor((session.level - 1) / 10) + 1}</span>
                  <strong>{zoneFor(session.level)}</strong>
                  <em>STRUCTURE {session.level}</em>
                </div>
                {eventFor(session.level) && <div className="map-event">SPECIAL EVENT · <b>{eventFor(session.level)}</b></div>}
                <ZoneTrack level={session.level} />
                <div className="route-grid">
                  <ChoiceCard icon="○" title="SAFE" tone="mint" onClick={() => startRoute("safe")}>
                    Slower ball · more good drops<br /><b>Score × 0.85</b>
                  </ChoiceCard>
                  <ChoiceCard icon="◇" title="NORMAL" tone="gold" onClick={() => startRoute("normal")}>
                    Balanced speed and drops<br /><b>Score × 1.00</b>
                  </ChoiceCard>
                  <ChoiceCard icon="▲" title="RISKY" tone="pink" onClick={() => startRoute("risky")}>
                    Faster ball · tougher structure<br /><b>Score × 1.50</b>
                  </ChoiceCard>
                </div>
                <div className="run-readout">
                  <span>LIVES <b>{"♥".repeat(Math.min(session.lives, 7))}</b></span>
                  <span>SCORE <b>{session.score.toLocaleString("en-US")}</b></span>
                  <span>UPGRADES <b>{session.upgrades.length}</b></span>
                </div>
                {session.upgrades.length > 0 && (
                  <div className="active-upgrades" aria-label="Active campaign upgrades">
                    {session.upgrades.map((id) => <span key={id}>{UPGRADE_INFO[id].icon} {UPGRADE_INFO[id].title}</span>)}
                  </div>
                )}
              </div>
            )}

            {view === "casual-setup" && (
              <CasualSetup onBack={() => setView("menu")} onStart={startCasual} />
            )}

            {view === "results" && session && (
              <div className="screen sub-screen center-screen">
                <p className="success-kicker">STRUCTURE CLEARED</p>
                <h2 className="giant-number">{String(lastClear.level).padStart(2, "0")}</h2>
                <div className="result-grid">
                  <span>SCORE<strong>{lastClear.score.toLocaleString("en-US")}</strong></span>
                  <span>{session.mode === "campaign" ? "LIVES" : "MODE"}<strong>{session.mode === "campaign" ? lastClear.lives : "∞"}</strong></span>
                  <span>NEXT<strong>{lastClear.level + 1}</strong></span>
                </div>
                {session.mode === "campaign" && <CheckpointProgress completed={lastClear.level % 10} />}
                <button className="big-action" onClick={nextAfterResults}>{session.mode === "campaign" ? "CHOOSE NEXT ROUTE" : "NEXT STRUCTURE"} ▶</button>
                <button className="text-button" onClick={() => setView("menu")}>RETURN TO MENU</button>
              </div>
            )}

            {view === "upgrade" && session && (
              <div className="screen sub-screen">
                <ScreenHeader title="CHECKPOINT REACHED" />
                <p className="checkpoint-copy">LIVES REFILLED · CHOOSE ONE RUN UPGRADE</p>
                <div className="upgrade-grid">
                  {upgradeChoices.map((id) => (
                    <ChoiceCard key={id} icon={UPGRADE_INFO[id].icon} title={UPGRADE_INFO[id].title} tone="gold" onClick={() => chooseUpgrade(id)}>
                      {UPGRADE_INFO[id].description}
                    </ChoiceCard>
                  ))}
                </div>
              </div>
            )}

            {view === "game-over" && (
              <div className="screen sub-screen center-screen">
                <p className="danger-kicker">RUN TERMINATED</p>
                <h2>GAME OVER</h2>
                <div className="final-score">
                  <span>FINAL SCORE</span>
                  <strong>{lastClear.score.toLocaleString("en-US")}</strong>
                  <small>HIGH SCORE · {highScore.toLocaleString("en-US")}</small>
                </div>
                <p className="level-reached">REACHED STRUCTURE {lastClear.level}</p>
                <button className="big-action" onClick={beginCampaign}>NEW CAMPAIGN</button>
                <button className="text-button" onClick={() => setView("menu")}>RETURN TO MENU</button>
              </div>
            )}

            {view === "how-to" && (
              <div className="screen sub-screen scroll-screen">
                <ScreenHeader title="HOW TO PLAY" onBack={() => setView("menu")} />
                <div className="instruction-grid">
                  <InfoBlock n="01" title="MOVE">Guide the paddle with your mouse, finger, or arrow keys. The ball launches automatically.</InfoBlock>
                  <InfoBlock n="02" title="BREAK">Destroy every breakable block. Armored blocks can remain on the field.</InfoBlock>
                  <InfoBlock n="03" title="CATCH">Drops reveal their color while falling: cool colors help, hot purple drops cause temporary trouble.</InfoBlock>
                  <InfoBlock n="04" title="SURVIVE">Campaign starts with five lives. Lose the final ball and the run ends. Casual never ends. Press P or Escape to pause.</InfoBlock>
                </div>
                <div className="legend-row"><span className="legend good">GOOD</span><span className="legend bad">BAD</span><span className="legend heart">EXTRA LIFE</span></div>
              </div>
            )}

            {view === "settings" && (
              <div className="screen sub-screen">
                <ScreenHeader title="SETTINGS" onBack={() => setView("menu")} />
                <div className="settings-list">
                  <Toggle label="SYNTHWAVE MUSIC" value={settings.music} onChange={(music) => updateSettings({ music })} />
                  <Toggle label="ARCADE SFX" value={settings.sfx} onChange={(sfx) => updateSettings({ sfx })} />
                  <Toggle label="REDUCED MOTION" value={settings.reducedMotion} onChange={(reducedMotion) => updateSettings({ reducedMotion })} />
                </div>
                <p className="settings-note">Progress, settings, scores, and statistics stay on this device.</p>
                <div className="danger-zone">
                  {!confirmReset ? (
                    <button className="reset-button" onClick={() => setConfirmReset(true)}>RESET ALL LOCAL DATA</button>
                  ) : (
                    <div className="confirm-reset" role="alert">
                      <strong>RESET EVERYTHING?</strong>
                      <p>This deletes campaign progress, high score, settings, and local statistics. This cannot be undone.</p>
                      <div className="confirm-actions">
                        <button onClick={() => setConfirmReset(false)}>CANCEL</button>
                        <button className="danger-confirm" onClick={resetAllData}>YES, RESET</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === "stats" && (
              <div className="screen sub-screen">
                <ScreenHeader title="LOCAL STATS" onBack={() => setView("menu")} />
                <div className="stats-grid">
                  <Stat label="HIGH SCORE" value={highScore} />
                  <Stat label="BEST STRUCTURE" value={stats.bestLevel} />
                  <Stat label="STRUCTURES CLEARED" value={stats.structuresCleared} />
                  <Stat label="BRICKS BROKEN" value={stats.bricksBroken} />
                  <Stat label="POWER-UPS CAUGHT" value={stats.powerupsCaught} />
                  <Stat label="CAMPAIGNS PLAYED" value={stats.gamesPlayed} />
                </div>
              </div>
            )}
          </section>

          <footer className="cabinet-footer"><span>© 2026 INFINITE BREAKER</span><b>PLAYER ONE READY</b><span>V1.0</span></footer>
        </div>
      )}
    </main>
  );
}

function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return <div className="screen-header">{onBack ? <button onClick={onBack} aria-label="Back">◀</button> : <i />}<h2>{title}</h2><i /></div>;
}

function ChoiceCard({ icon, title, tone, onClick, children }: { icon: string; title: string; tone: string; onClick: () => void; children: React.ReactNode }) {
  return <button className={`choice-card ${tone}`} onClick={onClick}><span className="choice-icon">{icon}</span><strong>{title}</strong><small>{children}</small></button>;
}

function ZoneTrack({ level }: { level: number }) {
  const current = ((level - 1) % 10) + 1;
  return (
    <div className="zone-track-wrap" aria-label={`Zone progress: structure ${current} of 10`}>
      <div className="zone-track-line" aria-hidden="true">
        <i style={{ width: `${((current - 1) / 9) * 100}%` }} />
      </div>
      <div className="zone-nodes">
        {Array.from({ length: 10 }, (_, index) => {
          const step = index + 1;
          const state = step < current ? "done" : step === current ? "current" : "upcoming";
          return <span key={step} className={`${state} ${step === 10 ? "boss" : ""}`}><b>{step === 10 ? "B" : step}</b><em>{step < current ? "✓" : step === current ? "YOU" : ""}</em></span>;
        })}
      </div>
      <div className="zone-track-caption"><span>ZONE START</span><strong>{10 - current} UNTIL BOSS</strong><span>CHECKPOINT + REFILL</span></div>
    </div>
  );
}

function CheckpointProgress({ completed }: { completed: number }) {
  return (
    <div className="checkpoint-progress" aria-label={`${completed} of 10 structures cleared in this zone`}>
      <div><span>ZONE PROGRESS</span><b>{completed}/10</b></div>
      <i><em style={{ width: `${completed * 10}%` }} /></i>
      <small>{10 - completed} STRUCTURES UNTIL CHECKPOINT</small>
    </div>
  );
}

function CasualSetup({ onBack, onStart }: { onBack: () => void; onStart: (style: CasualStyle, bad: boolean) => void }) {
  const [style, setStyle] = useState<CasualStyle>("chill");
  const [bad, setBad] = useState(true);
  return (
    <div className="screen sub-screen">
      <ScreenHeader title="CASUAL PLAY" onBack={onBack} />
      <p className="checkpoint-copy">INFINITE BALLS · PLAY YOUR WAY</p>
      <div className="segmented">
        {(["chill", "classic", "chaos"] as CasualStyle[]).map((item) => <button key={item} className={style === item ? "active" : ""} onClick={() => setStyle(item)}>{item.toUpperCase()}</button>)}
      </div>
      <div className="mode-description">
        {style === "chill" && "Slow ball, generous drops, and a wide starting paddle."}
        {style === "classic" && "The balanced Infinite Breaker experience."}
        {style === "chaos" && "Fast action, frequent drops, and explosive multiball."}
      </div>
      <Toggle label="NEGATIVE POWER-UPS" value={bad} onChange={setBad} />
      <button className="big-action" onClick={() => onStart(style, bad)}>START INFINITE RUN ▶</button>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <button className="toggle-row" onClick={() => onChange(!value)}><span>{label}</span><b className={value ? "on" : ""}><i /></b><em>{value ? "ON" : "OFF"}</em></button>;
}

function InfoBlock({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return <article className="info-block"><span>{n}</span><h3>{title}</h3><p>{children}</p></article>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat-card"><span>{label}</span><strong>{value.toLocaleString("en-US")}</strong></div>;
}
