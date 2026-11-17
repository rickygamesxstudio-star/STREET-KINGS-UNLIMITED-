import React, { useState } from 'react';
import {
  Award,
  Car,
  Check,
  CloudRain,
  Compass,
  DollarSign,
  Eye,
  EyeOff,
  Flame,
  Gauge,
  KeyRound,
  Lock,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Unlock,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { CAR_CATALOG, WORLD_LANDMARKS } from '../data/worldData';
import {
  AdminOverrides,
  CarSpec,
  HudTelemetry,
  MultiplayerRoomInfo,
  PlayerEconomyState,
  RemotePlayerState,
  TimeOfDayMode,
  WeatherMode,
  WorldLandmark,
} from '../types/game';

type AdminTab = 'economy' | 'physics' | 'world' | 'teleport' | 'multiplayer';

interface AdminModalProps {
  unlocked: boolean;
  verifiedCode: string;
  overrides: AdminOverrides;
  economy: PlayerEconomyState;
  telemetry: HudTelemetry;
  roomInfo: MultiplayerRoomInfo | null;
  remotePlayers: RemotePlayerState[];
  playerId: string;
  onUnlock: (code: string) => void;
  onLock: () => void;
  onClose: () => void;
  onUpdateOverrides: (next: AdminOverrides) => void;
  onGrantCash: (amount: number) => void;
  onGrantBank: (amount: number) => void;
  onAddRep: (amount: number) => void;
  onUnlockAllCars: () => void;
  onUnlockAllProperties: () => void;
  onUnlockAllAchievements: () => void;
  onMaxUpgradeActiveCar: () => void;
  onRepairRefuelActiveCar: () => void;
  onClearPoliceRecord: () => void;
  onSpawnAndDriveCar: (spec: CarSpec) => void;
  onSetWeatherAndTime: (weather: WeatherMode, timeOfDay: TimeOfDayMode) => void;
  onSetClockHour: (hour: number) => void;
  onSetWantedLevel: (level: number) => void;
  onTriggerWorldEvent: () => void;
  onTestPoliceStop: () => void;
  onTeleportCoords: (x: number, z: number, label?: string) => void;
  onTeleportLandmark: (lm: WorldLandmark) => void;
  onAdminRoomAnnounce: (text: string) => void;
  onAdminRoomWeatherSync: (weather: WeatherMode, timeOfDay: TimeOfDayMode) => void;
  onAdminKickPlayer: (targetPlayerId: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  unlocked,
  verifiedCode,
  overrides,
  economy,
  telemetry,
  roomInfo,
  remotePlayers,
  playerId,
  onUnlock,
  onLock,
  onClose,
  onUpdateOverrides,
  onGrantCash,
  onGrantBank,
  onAddRep,
  onUnlockAllCars,
  onUnlockAllProperties,
  onUnlockAllAchievements,
  onMaxUpgradeActiveCar,
  onRepairRefuelActiveCar,
  onClearPoliceRecord,
  onSpawnAndDriveCar,
  onSetWeatherAndTime,
  onSetClockHour,
  onSetWantedLevel,
  onTriggerWorldEvent,
  onTestPoliceStop,
  onTeleportCoords,
  onTeleportLandmark,
  onAdminRoomAnnounce,
  onAdminRoomWeatherSync,
  onAdminKickPlayer,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<AdminTab>('economy');
  const [customCashInput, setCustomCashInput] = useState('100000');
  const [tpX, setTpX] = useState('0');
  const [tpZ, setTpZ] = useState('24');
  const [announceText, setAnnounceText] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const flashFeedback = (msg: string) => {
    setActionFeedback(msg);
    window.setTimeout(() => {
      setActionFeedback((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) {
      setAuthError('Enter the Admin Code to unlock controls.');
      return;
    }
    setVerifying(true);
    setAuthError(null);
    try {
      const resp = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !data.ok) {
        setAuthError(data.error || 'Invalid Admin Code.');
        return;
      }
      onUnlock(trimmed);
      setCodeInput('');
    } catch {
      setAuthError('Could not verify Admin Code with server.');
    } finally {
      setVerifying(false);
    }
  };

  const formatHour = (h: number) => {
    const norm = ((h % 24) + 24) % 24;
    const hh = Math.floor(norm);
    const mm = Math.floor((norm - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const otherPlayers = remotePlayers.filter((p) => p.playerId !== playerId);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-emerald-500/35 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900/90 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                unlocked
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-amber-400/40 bg-amber-500/15 text-amber-300'
              }`}
            >
              {unlocked ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <span>ADMIN CONTROL CONSOLE</span>
                {unlocked && (
                  <span className="rounded bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 font-telemetry text-[10px] text-emerald-300">
                    AUTHORIZED
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {unlocked
                  ? `Session Active (${verifiedCode}) · Live Engine, Economy, World & Multiplayer Control`
                  : 'Enter your Master Admin Code to unlock full real-time game controls [~ / F9]'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unlocked && (
              <button
                type="button"
                onClick={() => {
                  onLock();
                  flashFeedback('Admin Mode Locked.');
                }}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/35 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" /> Lock
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {!unlocked ? (
          /* LOCKED GATE SCREEN */
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/35 bg-amber-500/10 text-amber-400">
              <KeyRound className="h-8 w-8" />
            </div>

            <div className="max-w-md space-y-1.5">
              <h3 className="font-display text-xl font-bold text-white">
                Master Admin Passcode Required
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Unlock live vehicle physics overrides, cash/reputation grants, weather &amp; time manipulation, instant car spawning, teleportation, and online room moderation.
              </p>
            </div>

            <form onSubmit={handleVerifySubmit} className="w-full max-w-sm space-y-3">
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Enter Admin Code (default: KING2025)"
                  autoFocus
                  className="w-full rounded-xl border border-white/15 bg-zinc-900 px-4 py-3 pr-11 text-center font-telemetry text-sm tracking-widest text-white uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-500 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCode((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                  title={showCode ? 'Hide code' : 'Show code'}
                >
                  {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {authError && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={verifying}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                <Unlock className="h-4 w-4" />
                {verifying ? 'Verifying...' : 'Unlock Admin Controls'}
              </button>
            </form>

            <div className="text-[11px] text-zinc-500">
              Default Admin Code: <span className="font-telemetry text-amber-300">KING2025</span> (customizable via server <code className="text-zinc-300">ADMIN_CODE</code> env var)
            </div>
          </div>
        ) : (
          /* UNLOCKED MASTER ADMIN CONSOLE */
          <>
            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-zinc-900/50 px-5 py-2.5">
              {(
                [
                  { id: 'economy', label: 'Economy & Profile', icon: <DollarSign className="h-3.5 w-3.5" /> },
                  { id: 'physics', label: 'Vehicle & Physics', icon: <Gauge className="h-3.5 w-3.5" /> },
                  { id: 'world', label: 'World & Police', icon: <Sun className="h-3.5 w-3.5" /> },
                  { id: 'teleport', label: 'Teleport', icon: <Compass className="h-3.5 w-3.5" /> },
                  { id: 'multiplayer', label: 'Online Room', icon: <Users className="h-3.5 w-3.5" /> },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    tab === item.id
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-900 text-zinc-300 border border-white/10 hover:bg-zinc-800'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {actionFeedback && (
              <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-5 py-2 text-xs font-medium text-emerald-300 flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>{actionFeedback}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {tab === 'economy' && (
                <div className="space-y-4">
                  {/* Current Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-telemetry">
                    <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                      <div className="text-[10px] text-zinc-400">WALLET CASH</div>
                      <div className="text-sm font-bold text-emerald-400">
                        ${economy.cash.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                      <div className="text-[10px] text-zinc-400">BANK BALANCE</div>
                      <div className="text-sm font-bold text-sky-400">
                        ${economy.bank.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                      <div className="text-[10px] text-zinc-400">REPUTATION</div>
                      <div className="text-sm font-bold text-amber-300">
                        {economy.reputation.toLocaleString()} REP
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                      <div className="text-[10px] text-zinc-400">GARAGE / PROPS</div>
                      <div className="text-sm font-bold text-white">
                        {economy.ownedCars.length} Cars · {economy.ownedPropertyIds.length} Props
                      </div>
                    </div>
                  </div>

                  {/* Cash & Bank Injectors */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Cash, Bank &amp; Reputation Controls
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: '+$25,000 Cash', fn: () => { onGrantCash(25000); flashFeedback('Added +$25,000 Cash'); } },
                        { label: '+$250,000 Cash', fn: () => { onGrantCash(250000); flashFeedback('Added +$250,000 Cash'); } },
                        { label: '+$1,000,000 Cash', fn: () => { onGrantCash(1000000); flashFeedback('Added +$1,000,000 Cash'); } },
                        { label: '+$500,000 Bank', fn: () => { onGrantBank(500000); flashFeedback('Added +$500,000 to Bank'); } },
                        { label: '+500 REP', fn: () => { onAddRep(500); flashFeedback('Added +500 Reputation'); } },
                        { label: '+2,500 REP', fn: () => { onAddRep(2500); flashFeedback('Added +2,500 Reputation'); } },
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={btn.fn}
                          className="rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        type="number"
                        value={customCashInput}
                        onChange={(e) => setCustomCashInput(e.target.value)}
                        placeholder="Custom cash amount"
                        className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 font-telemetry text-xs text-white focus:border-emerald-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const amt = Math.round(Number(customCashInput) || 0);
                          if (amt !== 0) {
                            onGrantCash(amt);
                            flashFeedback(`Granted $${amt.toLocaleString()} Cash`);
                          }
                        }}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                      >
                        Grant Custom Cash
                      </button>
                    </div>
                  </div>

                  {/* Full Unlocks */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Progression &amp; Unlocks
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onUnlockAllCars();
                          flashFeedback('All vehicles unlocked in Garage!');
                        }}
                        className="flex items-center gap-2 rounded-xl border border-white/12 bg-zinc-950 px-3.5 py-2.5 text-xs font-semibold text-white hover:border-amber-400/50 cursor-pointer"
                      >
                        <Car className="h-4 w-4 text-amber-400" />
                        Unlock Every Car in Catalog
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUnlockAllProperties();
                          flashFeedback('All City Properties & Businesses unlocked!');
                        }}
                        className="flex items-center gap-2 rounded-xl border border-white/12 bg-zinc-950 px-3.5 py-2.5 text-xs font-semibold text-white hover:border-violet-400/50 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4 text-violet-400" />
                        Unlock All Properties &amp; Empire
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onMaxUpgradeActiveCar();
                          flashFeedback('Current car upgraded to Stage 4 Max!');
                        }}
                        className="flex items-center gap-2 rounded-xl border border-white/12 bg-zinc-950 px-3.5 py-2.5 text-xs font-semibold text-white hover:border-cyan-400/50 cursor-pointer"
                      >
                        <Wrench className="h-4 w-4 text-cyan-400" />
                        Max Upgrade Current Car (Stage 4)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUnlockAllAchievements();
                          flashFeedback('All Street Kings Achievements unlocked!');
                        }}
                        className="flex items-center gap-2 rounded-xl border border-white/12 bg-zinc-950 px-3.5 py-2.5 text-xs font-semibold text-white hover:border-amber-400/50 cursor-pointer"
                      >
                        <Award className="h-4 w-4 text-amber-300" />
                        Unlock All Achievements
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClearPoliceRecord();
                          flashFeedback('Police record wiped & all impounded cars released!');
                        }}
                        className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-3.5 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                        Wipe Police Record (0 Busts · 0 Jail · Release All Impounds)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'physics' && (
                <div className="space-y-4">
                  {/* Live Toggle Cheats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          key: 'godMode',
                          label: 'God Mode (Zero Crash Damage)',
                          desc: 'Vehicle condition stays at 100% on impact',
                          icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
                        },
                        {
                          key: 'unlimitedNitroFuel',
                          label: 'Unlimited Nitro & Fuel',
                          desc: 'Infinite boost pressure & zero fuel drain',
                          icon: <Flame className="h-4 w-4 text-cyan-400" />,
                        },
                        {
                          key: 'noPolice',
                          label: 'Police Immunity',
                          desc: 'Officers ignore speeding & collisions',
                          icon: <Shield className="h-4 w-4 text-amber-400" />,
                        },
                        {
                          key: 'trafficDisabled',
                          label: 'Clear All AI Traffic',
                          desc: 'Empty city streets for high-speed runs',
                          icon: <Zap className="h-4 w-4 text-rose-400" />,
                        },
                      ] as const
                    ).map((item) => {
                      const active = overrides[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            onUpdateOverrides({ ...overrides, [item.key]: !active });
                            flashFeedback(`${item.label}: ${!active ? 'ON' : 'OFF'}`);
                          }}
                          className={`flex items-center justify-between rounded-xl border p-3 text-left cursor-pointer transition-colors ${
                            active
                              ? 'border-emerald-400/60 bg-emerald-950/35'
                              : 'border-white/10 bg-zinc-900/60 hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 pr-2">
                            <div className="mt-0.5">{item.icon}</div>
                            <div>
                              <div className="text-xs font-bold text-white">{item.label}</div>
                              <div className="text-[11px] text-zinc-400">{item.desc}</div>
                            </div>
                          </div>
                          <span
                            className={`rounded-lg px-2 py-0.5 font-telemetry text-[10px] font-bold ${
                              active
                                ? 'bg-emerald-500 text-zinc-950'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {active ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Physics Multipliers */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        Live Vehicle Physics Tuning
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onRepairRefuelActiveCar();
                            flashFeedback('Active car repaired & refueled to 100%!');
                          }}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                        >
                          100% Repair &amp; Fuel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateOverrides({
                              ...overrides,
                              speedMultiplier: 1,
                              accelMultiplier: 1,
                              gripMultiplier: 1,
                            });
                            flashFeedback('Physics multipliers reset to 1.0x');
                          }}
                          className="rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                        >
                          Reset 1.0x
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="flex justify-between text-zinc-300 mb-1">
                          <span>Top Speed</span>
                          <span className="font-telemetry font-bold text-amber-400">
                            {overrides.speedMultiplier.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={2.5}
                          step={0.05}
                          value={overrides.speedMultiplier}
                          onChange={(e) =>
                            onUpdateOverrides({
                              ...overrides,
                              speedMultiplier: Number(e.target.value),
                            })
                          }
                          className="w-full accent-amber-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-zinc-300 mb-1">
                          <span>Acceleration</span>
                          <span className="font-telemetry font-bold text-cyan-400">
                            {overrides.accelMultiplier.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={2.5}
                          step={0.05}
                          value={overrides.accelMultiplier}
                          onChange={(e) =>
                            onUpdateOverrides({
                              ...overrides,
                              accelMultiplier: Number(e.target.value),
                            })
                          }
                          className="w-full accent-cyan-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-zinc-300 mb-1">
                          <span>Tire Grip (Drift &lt; 1x)</span>
                          <span className="font-telemetry font-bold text-emerald-400">
                            {overrides.gripMultiplier.toFixed(2)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.4}
                          max={2.2}
                          step={0.05}
                          value={overrides.gripMultiplier}
                          onChange={(e) =>
                            onUpdateOverrides({
                              ...overrides,
                              gripMultiplier: Number(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Any-Car Instant Spawner */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Instant Car Spawner (Spawn &amp; Drive Any Vehicle)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CAR_CATALOG.map((spec) => (
                        <button
                          key={spec.id}
                          type="button"
                          onClick={() => {
                            onSpawnAndDriveCar(spec);
                            flashFeedback(`Spawned ${spec.brand} ${spec.name}!`);
                          }}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-left hover:border-amber-400/50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: spec.defaultColor }}
                            />
                            <div>
                              <div className="text-xs font-bold text-white">
                                {spec.brand} {spec.name}
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                {spec.category} · {spec.baseSpeedKmh} km/h
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-amber-300">SPAWN</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'world' && (
                <div className="space-y-4">
                  {/* Time of Day */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                        <Sun className="h-4 w-4" />
                        Time of Day ({formatHour(telemetry.clockHour)})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateOverrides({ ...overrides, freezeTime: !overrides.freezeTime });
                          flashFeedback(`Freeze Clock: ${!overrides.freezeTime ? 'ON' : 'OFF'}`);
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                          overrides.freezeTime
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                            : 'border-white/15 bg-zinc-950 text-zinc-300'
                        }`}
                      >
                        {overrides.freezeTime ? 'Clock Frozen' : 'Freeze Clock'}
                      </button>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={23.9}
                      step={0.1}
                      value={telemetry.clockHour}
                      onChange={(e) => onSetClockHour(Number(e.target.value))}
                      className="w-full accent-amber-400"
                    />

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'auto', label: 'Auto Cycle' },
                          { id: 'dawn', label: 'Dawn (06:15)' },
                          { id: 'noon', label: 'Noon (13:00)' },
                          { id: 'sunset', label: 'Sunset (18:15)' },
                          { id: 'midnight', label: 'Midnight (23:30)' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onSetWeatherAndTime(economy.graphicsSettings.weather, t.id);
                            flashFeedback(`Time preset set: ${t.label}`);
                          }}
                          className={`rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                            economy.graphicsSettings.timeOfDay === t.id
                              ? 'border-amber-400 bg-amber-500/20 text-amber-300 font-semibold'
                              : 'border-white/10 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weather */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
                      <CloudRain className="h-4 w-4" />
                      Weather Controller
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['clear', 'overcast', 'rain', 'fog'] as WeatherMode[]).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            onSetWeatherAndTime(w, economy.graphicsSettings.timeOfDay);
                            flashFeedback(`Weather changed to ${w.toUpperCase()}`);
                          }}
                          className={`rounded-xl border py-2 text-xs font-semibold uppercase cursor-pointer ${
                            economy.graphicsSettings.weather === w
                              ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                              : 'border-white/10 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Police & World Events */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
                      <ShieldAlert className="h-4 w-4" />
                      Wanted Level &amp; World Event Director
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            onSetWantedLevel(lvl);
                            flashFeedback(lvl === 0 ? 'Wanted level cleared' : `Set Wanted to ${lvl}★`);
                          }}
                          className={`rounded-lg border px-3 py-1.5 font-telemetry text-xs font-bold cursor-pointer ${
                            telemetry.wantedLevel === lvl
                              ? 'border-red-400 bg-red-500/25 text-red-200'
                              : 'border-white/10 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          {lvl === 0 ? '0★ Clear' : `${'★'.repeat(lvl)}`}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onTriggerWorldEvent();
                          flashFeedback('Triggered a Random World Event!');
                        }}
                        className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        Spawn Random World Event Now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onTestPoliceStop();
                          onClose();
                        }}
                        className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                      >
                        Trigger Police Stop Simulation
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'teleport' && (
                <div className="space-y-4">
                  {/* Custom Coordinates */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Teleport to Custom Coordinates (Current: X={Math.round(telemetry.playerX)}, Z={Math.round(telemetry.playerZ)})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="number"
                        value={tpX}
                        onChange={(e) => setTpX(e.target.value)}
                        placeholder="X (-950..950)"
                        className="w-32 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 font-telemetry text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <input
                        type="number"
                        value={tpZ}
                        onChange={(e) => setTpZ(e.target.value)}
                        placeholder="Z (-950..950)"
                        className="w-32 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 font-telemetry text-xs text-white focus:border-cyan-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const x = Number(tpX) || 0;
                          const z = Number(tpZ) || 0;
                          onTeleportCoords(x, z, `Coords (${x}, ${z})`);
                          flashFeedback(`Teleported to (${x}, ${z})`);
                        }}
                        className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-cyan-400 cursor-pointer"
                      >
                        Teleport Now
                      </button>
                    </div>
                  </div>

                  {/* World Landmarks */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Instant Landmark Jump
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                      {WORLD_LANDMARKS.map((lm) => (
                        <button
                          key={lm.id}
                          type="button"
                          onClick={() => {
                            onTeleportLandmark(lm);
                            flashFeedback(`Teleported to ${lm.name}`);
                          }}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-left hover:border-cyan-400/50 cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="truncate text-xs font-semibold text-white">
                              {lm.name}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {lm.district} · ({lm.x}, {lm.z})
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold text-cyan-300">JUMP</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'multiplayer' && (
                <div className="space-y-4">
                  {!roomInfo ? (
                    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-6 text-center text-xs text-zinc-400">
                      Join or create an Online Multiplayer room from your Smartphone [P] → Online to use Server Room Admin controls.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-cyan-500/35 bg-cyan-950/25 p-4 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-telemetry uppercase text-cyan-400">
                            ACTIVE ONLINE ROOM
                          </div>
                          <div className="text-sm font-bold text-white">
                            {roomInfo.name} ({roomInfo.code})
                          </div>
                        </div>
                        <span className="font-telemetry text-xs text-emerald-300">
                          {otherPlayers.length + 1} Connected
                        </span>
                      </div>

                      {/* Room Broadcast */}
                      <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                          <Radio className="h-4 w-4" />
                          Global Room Admin Announcement
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={announceText}
                            onChange={(e) => setAnnounceText(e.target.value)}
                            placeholder="Type broadcast message to all drivers in lobby..."
                            className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!announceText.trim()) return;
                              onAdminRoomAnnounce(announceText.trim());
                              setAnnounceText('');
                              flashFeedback('Broadcasted Admin announcement to room!');
                            }}
                            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                          >
                            Broadcast
                          </button>
                        </div>
                      </div>

                      {/* Room Weather Sync */}
                      <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                          Sync Room Weather &amp; Time Across All Players
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              { label: 'Clear Sunset', w: 'clear', t: 'sunset' },
                              { label: 'Sunny Noon', w: 'clear', t: 'noon' },
                              { label: 'Midnight Rain', w: 'rain', t: 'midnight' },
                              { label: 'Dense Fog Dawn', w: 'fog', t: 'dawn' },
                            ] as Array<{ label: string; w: WeatherMode; t: TimeOfDayMode }>
                          ).map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                onAdminRoomWeatherSync(preset.w, preset.t);
                                flashFeedback(`Synced room environment: ${preset.label}`);
                              }}
                              className="rounded-lg border border-sky-500/35 bg-sky-950/35 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Connected Players Moderation */}
                      <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                          Players in Lobby ({otherPlayers.length} Remote)
                        </div>
                        {otherPlayers.length === 0 ? (
                          <div className="text-xs text-zinc-500">
                            No other players in this room right now.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {otherPlayers.map((p) => (
                              <div
                                key={p.playerId}
                                className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs"
                              >
                                <div>
                                  <span className="font-semibold text-white">{p.name}</span>
                                  <span className="ml-2 font-telemetry text-[10px] text-zinc-400">
                                    {Math.round(p.speedKmh)} km/h
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onAdminKickPlayer(p.playerId);
                                    flashFeedback(`Kicked ${p.name} from room`);
                                  }}
                                  className="rounded border border-red-500/40 bg-red-950/40 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 cursor-pointer"
                                >
                                  Kick
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
