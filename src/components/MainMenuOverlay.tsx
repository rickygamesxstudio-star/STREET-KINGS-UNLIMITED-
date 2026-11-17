import React, { useEffect, useState } from 'react';
import { Car, Globe, Play, SlidersHorizontal, Sparkles } from 'lucide-react';
import { CAR_CATALOG, LOADING_TIPS } from '../data/worldData';

interface MainMenuOverlayProps {
  playerName: string;
  cash: number;
  bank: number;
  reputation: number;
  ownedCarCount: number;
  onDriveNow: () => void;
  onOpenMultiplayer: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

export const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
  playerName,
  cash,
  bank,
  reputation,
  ownedCarCount,
  onDriveNow,
  onOpenMultiplayer,
  onOpenGarage,
  onOpenSettings,
}) => {
  const [progress, setProgress] = useState(12);
  const [ready, setReady] = useState(false);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round(12 + (elapsed / 1200) * 88));
      setProgress(pct);
      if (pct >= 100) {
        setReady(true);
        window.clearInterval(timer);
      }
    }, 45);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const rot = window.setInterval(() => {
      setFeaturedIdx((i) => (i + 1) % CAR_CATALOG.length);
      setTipIdx((i) => (i + 1) % LOADING_TIPS.length);
    }, 3600);
    return () => window.clearInterval(rot);
  }, []);

  const featured = CAR_CATALOG[featuredIdx];

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between bg-zinc-950/94 p-6 sm:p-10">
      {/* Top Brand Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-xs font-telemetry uppercase tracking-[0.22em] text-amber-400">
            Jamaica Open-World 3D Driving &amp; Online Multiplayer
          </div>
          <h1 className="mt-1 font-display text-3xl sm:text-5xl font-bold italic tracking-tight text-white">
            STREET KINGS: JAMAICA
          </h1>
        </div>

        <div className="flex items-center gap-5 rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-2.5 text-xs font-telemetry">
          <div>
            <span className="text-zinc-400 mr-1.5">DRIVER</span>
            <span className="text-white font-bold">{playerName}</span>
          </div>
          <div>
            <span className="text-zinc-400 mr-1.5">FUNDS</span>
            <span className="text-emerald-400 font-bold">
              ${(cash + bank).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 mr-1.5">REP</span>
            <span className="text-amber-300 font-bold">{reputation}</span>
          </div>
          <div>
            <span className="text-zinc-400 mr-1.5">GARAGE</span>
            <span className="text-cyan-400 font-bold">{ownedCarCount}</span>
          </div>
        </div>
      </div>

      {/* Center Split: Featured Car Showcase + Actions */}
      <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto w-full py-6">
        <div className="lg:col-span-7 rounded-2xl border border-white/12 bg-zinc-900/75 p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-telemetry uppercase tracking-wider text-amber-400">
              Featured Vehicle · {featured.brand}
            </span>
            <span className="text-xs font-telemetry text-zinc-400">
              {featured.category}
            </span>
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold text-white">
            {featured.name}
          </h2>
          <p className="mt-2 text-sm text-zinc-300 leading-relaxed max-w-xl">
            {featured.description}
          </p>

          <div className="mt-5 grid grid-cols-4 gap-3 text-center font-telemetry">
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
              <div className="text-[10px] text-zinc-400">TOP SPEED</div>
              <div className="mt-1 text-base font-bold text-white">
                {featured.baseSpeedKmh} km/h
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
              <div className="text-[10px] text-zinc-400">ACCEL</div>
              <div className="mt-1 text-base font-bold text-emerald-400">
                {featured.baseAccel}/10
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
              <div className="text-[10px] text-zinc-400">DRIFT</div>
              <div className="mt-1 text-base font-bold text-cyan-400">
                {featured.baseDrift}/10
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3">
              <div className="text-[10px] text-zinc-400">OFF-ROAD</div>
              <div className="mt-1 text-base font-bold text-amber-300">
                {featured.offroadRating}/10
              </div>
            </div>
          </div>
        </div>

        {/* Main Menu Controls */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <button
            type="button"
            disabled={!ready}
            onClick={onDriveNow}
            className="flex items-center justify-between rounded-xl bg-amber-500 px-6 py-4 text-left text-zinc-950 shadow-lg hover:bg-amber-400 disabled:opacity-60 cursor-pointer transition-colors"
          >
            <div>
              <div className="font-display text-xl font-bold uppercase">
                {ready ? 'Drive Now' : 'Preparing Jamaica World...'}
              </div>
              <div className="text-xs font-medium text-zinc-900">
                Drop straight into Kingston &amp; island free roam
              </div>
            </div>
            <Play className="h-6 w-6 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => {
              onDriveNow();
              onOpenMultiplayer();
            }}
            className="flex items-center justify-between rounded-xl border border-cyan-500/40 bg-zinc-900 px-6 py-3.5 text-left text-white hover:bg-zinc-800 cursor-pointer"
          >
            <div>
              <div className="font-display text-base font-bold">Online Multiplayer</div>
              <div className="text-xs text-zinc-400">
                Public lobbies, 6-char room codes & car meets
              </div>
            </div>
            <Globe className="h-5 w-5 text-cyan-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              onDriveNow();
              onOpenGarage();
            }}
            className="flex items-center justify-between rounded-xl border border-white/12 bg-zinc-900 px-6 py-3.5 text-left text-white hover:bg-zinc-800 cursor-pointer"
          >
            <div>
              <div className="font-display text-base font-bold">Garage & Tuning</div>
              <div className="text-xs text-zinc-400">
                Upgrades, paint finishes, underglow & maintenance
              </div>
            </div>
            <Car className="h-5 w-5 text-amber-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              onDriveNow();
              onOpenSettings();
            }}
            className="flex items-center justify-between rounded-xl border border-white/12 bg-zinc-900 px-6 py-3.5 text-left text-white hover:bg-zinc-800 cursor-pointer"
          >
            <div>
              <div className="font-display text-base font-bold">Graphics & Weather</div>
              <div className="text-xs text-zinc-400">
                Shadows, bloom, rain, day/night cycle & controls
              </div>
            </div>
            <SlidersHorizontal className="h-5 w-5 text-violet-400" />
          </button>
        </div>
      </div>

      {/* Bottom Progress Bar & Rotating Tip */}
      <div className="space-y-2.5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>{LOADING_TIPS[tipIdx]}</span>
          </div>
          <span className="font-telemetry text-amber-400">{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
