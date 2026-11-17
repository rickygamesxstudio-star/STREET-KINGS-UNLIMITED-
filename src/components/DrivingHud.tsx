import React, { useState } from 'react';
import {
  Bot,
  Building2,
  Camera,
  Car,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Flag,
  Fuel,
  Gamepad2,
  Map as MapIcon,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shield,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Smartphone,
  Sun,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  X,
} from 'lucide-react';
import {
  CarSpec,
  HudTelemetry,
  InputState,
  MultiplayerRoomInfo,
  OwnedCar,
  PlayerEconomyState,
  RadioStation,
  RadioTrack,
} from '../types/game';
import { MinimapCanvas } from './MinimapCanvas';

interface DrivingHudProps {
  telemetry: HudTelemetry;
  economy: PlayerEconomyState;
  activeSpec: CarSpec;
  activeCar: OwnedCar;
  station: RadioStation;
  track: RadioTrack | undefined;
  radioPlaying: boolean;
  playingOnPhone: boolean;
  sfxMuted: boolean;
  adminUnlocked: boolean;
  roomInfo: MultiplayerRoomInfo | null;
  remotePlayerCount: number;
  onToggleRadioPlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onStopPhoneMusic: () => void;
  onToggleSfxMute: () => void;
  onCycleCamera: () => void;
  onToggleEnterExit: () => void;
  onResetVehicle: () => void;
  onInteractPrompt: () => void;
  onTouchInput: (partial: Partial<InputState>) => void;
  onSetGpsToMeet: () => void;
  onOpenModal: (
    modal:
      | 'map'
      | 'dealership'
      | 'garage'
      | 'gas'
      | 'races'
      | 'empire'
      | 'radio'
      | 'controls'
      | 'phone'
      | 'copilot'
      | 'admin'
  ) => void;
  onAbortRace: () => void;
}

function formatClock(hourVal: number): string {
  const norm = ((hourVal % 24) + 24) % 24;
  const hh = Math.floor(norm);
  const mm = Math.floor((norm - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const DrivingHud: React.FC<DrivingHudProps> = ({
  telemetry,
  economy,
  activeSpec,
  activeCar,
  station,
  track,
  radioPlaying,
  playingOnPhone,
  sfxMuted,
  adminUnlocked,
  roomInfo,
  remotePlayerCount,
  onToggleRadioPlay,
  onPrevTrack,
  onNextTrack,
  onStopPhoneMusic,
  onToggleSfxMute,
  onCycleCamera,
  onToggleEnterExit,
  onResetVehicle,
  onInteractPrompt,
  onTouchInput,
  onSetGpsToMeet,
  onOpenModal,
  onAbortRace,
}) => {
  const [dockExpanded, setDockExpanded] = useState(true);
  const [touchVisible, setTouchVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  const rpmPct = Math.min(100, Math.round((telemetry.rpm / telemetry.maxRpm) * 100));
  const repRank =
    economy.reputation >= 2000
      ? 'Street King'
      : economy.reputation >= 1000
      ? 'Apex Legend'
      : economy.reputation >= 450
      ? 'Pro Racer'
      : economy.reputation >= 150
      ? 'Street Contender'
      : 'Rookie';

  const makeTouchHold = (key: keyof InputState) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInput({ [key]: true });
    },
    onPointerUp: () => onTouchInput({ [key]: false }),
    onPointerLeave: () => onTouchInput({ [key]: false }),
    onPointerCancel: () => onTouchInput({ [key]: false }),
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
      {/* TOP BAR */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-4 rounded-xl border border-white/12 bg-zinc-950/90 px-4 py-2.5 shadow-lg">
          <div>
            <div className="font-display text-sm font-bold tracking-wider text-amber-400">
              STREET KINGS: JAMAICA
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center gap-2">
              <span>
                {activeSpec.brand} {activeSpec.name} · {repRank}
              </span>
              <span className="text-zinc-500">·</span>
              <span className="inline-flex items-center gap-1 font-telemetry text-zinc-300">
                {telemetry.weather === 'rain' ? (
                  <CloudRain className="h-3 w-3 text-sky-400" />
                ) : (
                  <Sun className="h-3 w-3 text-amber-300" />
                )}
                {formatClock(telemetry.clockHour)} · {telemetry.weather.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-4 text-xs font-telemetry">
            <div>
              <span className="text-zinc-400 mr-1.5">CASH</span>
              <span className="text-emerald-400 font-bold">
                ${economy.cash.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 mr-1.5">BANK</span>
              <span className="text-sky-400 font-bold">
                ${economy.bank.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 mr-1.5">REP</span>
              <span className="text-amber-300 font-bold">
                {economy.reputation.toLocaleString()}
              </span>
            </div>
          </div>

          {roomInfo && (
            <>
              <div className="h-6 w-px bg-white/10 hidden md:block" />
              <button
                type="button"
                onClick={() => onOpenModal('phone')}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1 text-[11px] font-telemetry text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
              >
                <Users className="h-3.5 w-3.5" />
                <span>
                  {roomInfo.code} · {remotePlayerCount + 1} ONLINE
                </span>
              </button>
            </>
          )}
        </div>

        {/* Right Top Badges: Wanted / Active Race / Job / Random Event / Car Meet */}
        <div className="flex flex-col items-end gap-2">
          {telemetry.wantedLevel > 0 && (
            <div className="pointer-events-auto rounded-xl border border-red-500/40 bg-zinc-950/92 px-4 py-2 text-right shadow-lg">
              <div className="flex items-center justify-end gap-1.5 text-sm font-display font-bold text-red-400">
                <span>POLICE PURSUIT</span>
                <span className="text-amber-400">
                  {'★'.repeat(telemetry.wantedLevel)}
                  {'☆'.repeat(5 - telemetry.wantedLevel)}
                </span>
              </div>
              {telemetry.bustProgressPct > 5 ? (
                <div className="mt-1 w-44">
                  <div className="text-[10px] font-telemetry text-red-300 mb-0.5">
                    OFFICERS CLOSING IN — ACCELERATE!
                  </div>
                  <div className="h-1.5 w-full rounded bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${telemetry.bustProgressPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-[10px] font-telemetry text-zinc-300">
                  Evade distance cooldown: {telemetry.wantedCooldownPct}%
                </div>
              )}
            </div>
          )}

          {roomInfo?.carMeet && (
            <button
              type="button"
              onClick={onSetGpsToMeet}
              className="pointer-events-auto rounded-xl border border-violet-500/40 bg-zinc-950/92 px-3.5 py-2 text-right shadow-lg hover:border-violet-400 cursor-pointer"
            >
              <div className="text-[10px] font-telemetry uppercase text-violet-400">
                CAR MEET ACTIVE · CLICK FOR GPS
              </div>
              <div className="text-xs font-semibold text-white">
                {roomInfo.carMeet.label} ({roomInfo.carMeet.hostName})
              </div>
            </button>
          )}

          {telemetry.activeRandomEvent && (
            <div className="pointer-events-auto rounded-xl border border-emerald-500/40 bg-zinc-950/92 px-3.5 py-2 text-right shadow-lg max-w-[260px]">
              <div className="flex items-center justify-between gap-3 text-[10px] font-telemetry text-emerald-400">
                <span>WORLD EVENT</span>
                <span>{Math.ceil(telemetry.activeRandomEvent.remainingSec)}s</span>
              </div>
              <div className="text-xs font-bold text-white">
                {telemetry.activeRandomEvent.title}
              </div>
              <div className="text-[11px] text-zinc-300">
                Reward: ${telemetry.activeRandomEvent.rewardCash.toLocaleString()}
              </div>
            </div>
          )}

          {telemetry.activeRace && telemetry.activeRace.active && (
            <div className="pointer-events-auto rounded-xl border border-amber-500/40 bg-zinc-950/92 px-4 py-2.5 shadow-lg min-w-[230px]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-xs font-bold uppercase tracking-wider text-amber-400">
                  {telemetry.activeRace.raceName}
                </span>
                <button
                  type="button"
                  onClick={onAbortRace}
                  className="text-[11px] text-zinc-400 hover:text-red-400 underline cursor-pointer"
                >
                  Quit
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs font-telemetry">
                <span>
                  POS{' '}
                  <strong className="text-white text-sm">
                    {telemetry.activeRace.position}/{telemetry.activeRace.totalRacers}
                  </strong>
                </span>
                <span>
                  LAP{' '}
                  <strong className="text-white">
                    {telemetry.activeRace.lap}/{telemetry.activeRace.totalLaps}
                  </strong>
                </span>
                <span>
                  CP{' '}
                  <strong className="text-amber-300">
                    {telemetry.activeRace.checkpointIndex + 1}/
                    {telemetry.activeRace.totalCheckpoints}
                  </strong>
                </span>
              </div>
              {telemetry.activeRace.type === 'drift' && (
                <div className="mt-1 text-xs font-telemetry text-cyan-300">
                  Drift Score: {telemetry.activeRace.driftScore.toLocaleString()} /{' '}
                  {telemetry.activeRace.targetDriftScore?.toLocaleString()}
                </div>
              )}
            </div>
          )}

          {telemetry.activeJob && (
            <div className="pointer-events-auto rounded-xl border border-cyan-500/40 bg-zinc-950/92 px-4 py-2.5 shadow-lg min-w-[230px]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-xs font-bold uppercase text-cyan-400">
                  {telemetry.activeJob.title}
                </span>
                <span className="font-telemetry text-xs text-amber-300">
                  {Math.ceil(telemetry.activeJob.remainingSec)}s
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-200">
                {telemetry.activeJob.stage === 'pickup' ? 'Pickup' : 'Dropoff'}:{' '}
                <span className="text-white font-medium">
                  {telemetry.activeJob.targetLabel}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CENTER OVERLAYS */}
      <div className="flex flex-col items-center justify-center gap-3 my-auto">
        {telemetry.activeRace && telemetry.activeRace.countdown > 0 && (
          <div className="font-display text-7xl font-bold italic text-amber-400 drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)]">
            {Math.ceil(telemetry.activeRace.countdown)}
          </div>
        )}

        {telemetry.isDrifting && telemetry.currentDriftPoints > 25 && (
          <div className="rounded-lg border border-amber-400/40 bg-zinc-950/90 px-4 py-1.5 text-center shadow-lg">
            <div className="text-[10px] font-display uppercase tracking-widest text-amber-400">
              Drifting
            </div>
            <div className="font-telemetry text-xl font-bold text-white">
              +{telemetry.currentDriftPoints.toLocaleString()} PTS
            </div>
          </div>
        )}

        {telemetry.toastMessage && (
          <div className="rounded-lg border border-white/15 bg-zinc-950/92 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-100 shadow-lg">
            {telemetry.toastMessage}
          </div>
        )}

        {telemetry.nearbyPrompt && (
          <button
            type="button"
            onClick={onInteractPrompt}
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-amber-400/50 bg-zinc-950/94 px-4 py-2 text-sm font-semibold text-white shadow-xl hover:bg-zinc-900 cursor-pointer"
          >
            <span className="rounded bg-amber-500 px-2 py-0.5 font-telemetry text-xs font-bold text-zinc-950">
              E
            </span>
            <span>{telemetry.nearbyPrompt.label}</span>
          </button>
        )}
      </div>

      {/* MOBILE TOUCH CONTROLS */}
      {touchVisible && (
        <div className="pointer-events-none flex items-end justify-between gap-4 pb-2 px-1">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              {...makeTouchHold('left')}
              className="h-14 w-16 rounded-xl border border-white/20 bg-zinc-950/85 font-display text-xl font-bold text-white active:bg-amber-500 active:text-zinc-950"
            >
              ◄
            </button>
            <button
              type="button"
              {...makeTouchHold('right')}
              className="h-14 w-16 rounded-xl border border-white/20 bg-zinc-950/85 font-display text-xl font-bold text-white active:bg-amber-500 active:text-zinc-950"
            >
              ►
            </button>
          </div>

          <div className="pointer-events-auto flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                {...makeTouchHold('nitro')}
                className="h-10 px-3 rounded-lg border border-cyan-400/40 bg-zinc-950/85 text-[11px] font-display font-bold text-cyan-300 active:bg-cyan-500 active:text-zinc-950"
              >
                NITRO
              </button>
              <button
                type="button"
                {...makeTouchHold('handbrake')}
                className="h-10 px-3 rounded-lg border border-amber-400/40 bg-zinc-950/85 text-[11px] font-display font-bold text-amber-300 active:bg-amber-500 active:text-zinc-950"
              >
                DRIFT
              </button>
            </div>
            <button
              type="button"
              {...makeTouchHold('backward')}
              className="h-16 w-14 rounded-xl border border-red-400/40 bg-zinc-950/85 font-display text-xs font-bold text-red-300 active:bg-red-500 active:text-white"
            >
              BRK
            </button>
            <button
              type="button"
              {...makeTouchHold('forward')}
              className="h-20 w-16 rounded-xl border border-emerald-400/40 bg-zinc-950/85 font-display text-sm font-bold text-emerald-300 active:bg-emerald-500 active:text-zinc-950"
            >
              GAS
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM HUD ROW */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* Bottom-Left: Minimap + Radio Mini Deck */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="hidden sm:block">
            <MinimapCanvas
              telemetry={telemetry}
              onOpenFullMap={() => onOpenModal('map')}
            />
          </div>

          {(telemetry.playerMode === 'driving' || playingOnPhone) && (
            <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-zinc-950/92 px-3 py-2 shadow-lg max-w-[310px]">
              <button
                type="button"
                onClick={() => onOpenModal('radio')}
                title="Open Radio & Music Search Deck"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-white/10 hover:border-amber-400/50 cursor-pointer"
                style={{ color: station.accentColor }}
              >
                <Radio className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[10px] font-telemetry uppercase tracking-wider"
                  style={{ color: station.accentColor }}
                >
                  {telemetry.playerMode !== 'driving' ? 'PHONE · ' : ''}
                  {station.frequency} · {station.name}
                </div>
                <div className="truncate text-xs font-medium text-zinc-100">
                  {track ? `${track.title} — ${track.artist}` : 'No Track Selected'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onPrevTrack}
                  className="p-1.5 rounded hover:bg-white/10 text-zinc-300 cursor-pointer"
                  title="Previous Track"
                >
                  <SkipBack className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onToggleRadioPlay}
                  className="p-1.5 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer"
                  title={radioPlaying ? 'Pause' : 'Play'}
                >
                  {radioPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onNextTrack}
                  className="p-1.5 rounded hover:bg-white/10 text-zinc-300 cursor-pointer"
                  title="Next Track"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
                {telemetry.playerMode !== 'driving' && (
                  <button
                    type="button"
                    onClick={onStopPhoneMusic}
                    className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-300 cursor-pointer"
                    title="Stop Phone Music & Hide Bar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom-Center: Collapsible Dock */}
        <div className="pointer-events-auto flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockExpanded((v) => !v)}
            className="mb-1 flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/12 bg-zinc-950/90 px-3 py-1 text-[11px] font-medium text-zinc-300 hover:text-white cursor-pointer"
          >
            {dockExpanded ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> Hide Dock
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Show Controls & Menus
              </>
            )}
          </button>

          {dockExpanded && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-zinc-950/92 p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => onOpenModal('phone')}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 cursor-pointer whitespace-nowrap"
              >
                <Smartphone className="h-3.5 w-3.5" /> Phone [P]
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('copilot')}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 cursor-pointer whitespace-nowrap"
              >
                <Bot className="h-3.5 w-3.5" /> Co-Pilot [G]
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('map')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <MapIcon className="h-3.5 w-3.5 text-cyan-400" /> Map [M]
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('races')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Flag className="h-3.5 w-3.5 text-red-400" /> Races
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('garage')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Wrench className="h-3.5 w-3.5 text-cyan-400" /> Garage
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('dealership')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Car className="h-3.5 w-3.5 text-amber-400" /> Dealer
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('empire')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Building2 className="h-3.5 w-3.5 text-violet-400" /> Empire
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('gas')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Fuel className="h-3.5 w-3.5 text-emerald-400" /> Fuel
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('radio')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Radio className="h-3.5 w-3.5 text-rose-400" /> Music
              </button>

              <div className="h-4 w-px bg-white/12 mx-0.5" />

              <button
                type="button"
                onClick={onCycleCamera}
                title="Cycle Camera (C)"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-300 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <Camera className="h-3.5 w-3.5" /> {telemetry.cameraMode}
              </button>
              <button
                type="button"
                onClick={onToggleEnterExit}
                title="Enter / Exit Vehicle (E)"
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                {telemetry.playerMode === 'driving' ? 'Exit [E]' : 'Enter [E]'}
              </button>
              <button
                type="button"
                onClick={onResetVehicle}
                title="Reset Car to Road (R)"
                className="p-1.5 rounded-lg text-zinc-300 hover:bg-white/10 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTouchVisible((v) => !v)}
                title="Toggle Touch Pedals"
                className={`p-1.5 rounded-lg cursor-pointer ${
                  touchVisible ? 'bg-amber-500 text-zinc-950' : 'text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Gamepad2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleSfxMute}
                title="Mute/Unmute Engine SFX"
                className="p-1.5 rounded-lg text-zinc-300 hover:bg-white/10 cursor-pointer"
              >
                {sfxMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('controls')}
                className="rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                Keys
              </button>
              <button
                type="button"
                onClick={() => onOpenModal('admin')}
                title="Open Admin Code Console [~ / F9]"
                className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  adminUnlocked
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    : 'border-white/15 bg-zinc-900 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {adminUnlocked ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                )}
                Admin [~]
              </button>
            </div>
          )}
        </div>

        {/* Bottom-Right: Tachometer / Speedometer */}
        <div className="pointer-events-auto rounded-xl border border-white/12 bg-zinc-950/92 px-4 py-3 shadow-xl min-w-[235px]">
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-bold italic tracking-tight text-white tabular-nums">
                {telemetry.speedKmh}
              </span>
              <span className="text-[11px] font-telemetry text-zinc-400">KM/H</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-telemetry uppercase text-zinc-400">
                GEAR
              </span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg font-display text-lg font-bold ${
                  telemetry.gear === 'R'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                {telemetry.gear}
              </span>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex justify-between text-[10px] font-telemetry text-zinc-400 mb-1">
              <span>RPM {telemetry.rpm}</span>
              <span className={rpmPct > 84 ? 'text-red-400 font-bold' : ''}>
                REDLINE 8.5K
              </span>
            </div>
            <div className="h-2 w-full rounded bg-zinc-800 overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  rpmPct > 85
                    ? 'bg-red-500'
                    : rpmPct > 65
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${rpmPct}%` }}
              />
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2 text-[10px] font-telemetry">
            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>NITRO</span>
                <span className="text-cyan-400">{telemetry.nitro}%</span>
              </div>
              <div className="h-1.5 rounded bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400"
                  style={{ width: `${telemetry.nitro}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>FUEL</span>
                <span className={activeCar.fuel < 20 ? 'text-red-400' : 'text-emerald-400'}>
                  {Math.round(activeCar.fuel)}%
                </span>
              </div>
              <div className="h-1.5 rounded bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full ${
                    activeCar.fuel < 20 ? 'bg-red-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.round(activeCar.fuel)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-zinc-400 mb-0.5">
                <span>COND</span>
                <span
                  className={
                    activeCar.condition < 40 ? 'text-red-400' : 'text-amber-300'
                  }
                >
                  {Math.round(activeCar.condition)}%
                </span>
              </div>
              <div className="h-1.5 rounded bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full ${
                    activeCar.condition < 40 ? 'bg-red-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.round(activeCar.condition)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
