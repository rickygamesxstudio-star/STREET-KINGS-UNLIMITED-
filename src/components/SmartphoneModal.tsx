import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  Bot,
  Briefcase,
  Car,
  Check,
  Copy,
  Download,
  Flag,
  Globe,
  Landmark,
  MapPin,
  MessageSquare,
  Music,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import {
  ACHIEVEMENTS_CATALOG,
  CAR_CATALOG,
  JOBS_CATALOG,
  RACE_EVENTS,
  WORLD_LANDMARKS,
} from '../data/worldData';
import {
  GraphicsPreset,
  GraphicsSettings,
  HudTelemetry,
  JobDefinition,
  MultiplayerRoomInfo,
  PlayerEconomyState,
  RaceEvent,
  RadioStation,
  RadioTrack,
  RemotePlayerState,
  TimeOfDayMode,
  TradeOfferPayload,
  WeatherMode,
} from '../types/game';

export type PhoneAppId =
  | 'home'
  | 'contacts'
  | 'messages'
  | 'gps'
  | 'bank'
  | 'market'
  | 'social'
  | 'music'
  | 'garage'
  | 'jobs'
  | 'multiplayer'
  | 'settings';

interface PublicServerItem {
  code: string;
  name: string;
  playerCount: number;
  carMeet: { label: string; hostName: string } | null;
  raceActive: boolean;
}

interface SmartphoneModalProps {
  initialApp?: PhoneAppId;
  economy: PlayerEconomyState;
  telemetry: HudTelemetry;
  station: RadioStation;
  track: RadioTrack | undefined;
  radioPlaying: boolean;
  playingOnPhone: boolean;
  wsConnected: boolean;
  playerId: string;
  roomInfo: MultiplayerRoomInfo | null;
  remotePlayers: RemotePlayerState[];
  roomChat: Array<{ fromId: string; fromName: string; text: string; timestamp: number }>;
  incomingTrade: TradeOfferPayload | null;
  onClose: () => void;
  onSetGps: (x: number, z: number, label: string) => void;
  onClearGps: () => void;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onSelectOwnedCar: (instanceId: string) => void;
  onRedeemImpounded: (instanceId: string) => void;
  onStartJob: (job: JobDefinition) => void;
  onOpenModalShortcut: (modal: 'dealership' | 'empire' | 'radio' | 'garage' | 'copilot' | 'map_real' | 'admin') => void;
  onToggleRadioPlay: () => void;
  onNextTrack: () => void;
  onSetPlayingOnPhone: (enabled: boolean) => void;
  onPostSocial: (content: string) => void;
  onLikeSocial: (postId: string) => void;
  onMarkMessagesRead: () => void;
  onUpdateGraphics: (next: GraphicsSettings) => void;
  onUpdateProfile: (name: string, jacketColor: string) => void;
  onManualSave: () => void;
  // Multiplayer actions
  onCreateRoom: (roomName: string, isPublic: boolean) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onSendRoomChat: (text: string) => void;
  onAddFriend: (playerId: string, name: string) => void;
  onHostCarMeet: (label: string) => void;
  onStartRoomRace: (race: RaceEvent) => void;
  onSendTradeOffer: (toId: string, offerCash: number, requestCash: number) => void;
  onRespondTrade: (tradeId: string, accept: boolean) => void;
}

const CONTACTS = [
  { name: 'Kingston Dispatch', role: 'Island Jobs & Contracts', phone: '876-555-0142', app: 'jobs' as PhoneAppId },
  { name: 'Jax — Knutsford Customs', role: 'Performance & Tuning', phone: '876-555-0198', shortcut: 'garage' as const },
  { name: 'Elena — Jamaica National', role: 'Wire Transfers & Real Estate', phone: '876-555-0110', app: 'bank' as PhoneAppId },
  { name: 'Marcus — Kingston Apex', role: 'Exotic Vehicle Imports', phone: '876-555-0177', shortcut: 'dealership' as const },
  { name: 'JCF Central Station', role: 'Records & Impound Desk', phone: '119-304', lmId: 'lm_police_central' },
];

export const SmartphoneModal: React.FC<SmartphoneModalProps> = ({
  initialApp = 'home',
  economy,
  telemetry,
  station,
  track,
  radioPlaying,
  playingOnPhone,
  wsConnected,
  playerId,
  roomInfo,
  remotePlayers,
  roomChat,
  incomingTrade,
  onClose,
  onSetGps,
  onClearGps,
  onDeposit,
  onWithdraw,
  onSelectOwnedCar,
  onRedeemImpounded,
  onStartJob,
  onOpenModalShortcut,
  onToggleRadioPlay,
  onNextTrack,
  onSetPlayingOnPhone,
  onPostSocial,
  onLikeSocial,
  onMarkMessagesRead,
  onUpdateGraphics,
  onUpdateProfile,
  onManualSave,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSendRoomChat,
  onAddFriend,
  onHostCarMeet,
  onStartRoomRace,
  onSendTradeOffer,
  onRespondTrade,
}) => {
  const [app, setApp] = useState<PhoneAppId>(initialApp);
  const [chatInput, setChatInput] = useState('');
  const [socialDraft, setSocialDraft] = useState('');
  const [customBankAmt, setCustomBankAmt] = useState('2500');

  // Multiplayer form state
  const [newRoomName, setNewRoomName] = useState(`${economy.character.name}'s Cruise`);
  const [newRoomPublic, setNewRoomPublic] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [publicServers, setPublicServers] = useState<PublicServerItem[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [carMeetLabel, setCarMeetLabel] = useState('Midnight Meet & Showcase');
  const [selectedRaceId, setSelectedRaceId] = useState(RACE_EVENTS[0].id);

  // Trade form state
  const [tradeTargetId, setTradeTargetId] = useState('');
  const [tradeOfferCash, setTradeOfferCash] = useState('1000');
  const [tradeRequestCash, setTradeRequestCash] = useState('0');

  // Settings profile draft
  const [driverName, setDriverName] = useState(economy.character.name);
  const [jacketColor, setJacketColor] = useState(economy.character.jacketColor);

  const unreadCount = economy.messages.filter((m) => m.unread).length;

  const refreshServers = async () => {
    setLoadingServers(true);
    try {
      const r = await fetch('/api/servers');
      if (r.ok) {
        const d = await r.json();
        setPublicServers(d.servers || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingServers(false);
    }
  };

  const openApp = (next: PhoneAppId) => {
    setApp(next);
    if (next === 'messages') onMarkMessagesRead();
    if (next === 'multiplayer') refreshServers();
  };

  const hh = Math.floor(((telemetry.clockHour % 24) + 24) % 24);
  const mm = Math.floor((telemetry.clockHour - Math.floor(telemetry.clockHour)) * 60);
  const clockStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  const APPS: Array<{ id: PhoneAppId; label: string; color: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'multiplayer', label: 'Online', color: '#06b6d4', icon: <Users className="h-5 w-5" /> },
    { id: 'gps', label: 'GPS', color: '#10b981', icon: <Navigation className="h-5 w-5" /> },
    { id: 'messages', label: 'Messages', color: '#3b82f6', icon: <MessageSquare className="h-5 w-5" />, badge: unreadCount },
    { id: 'contacts', label: 'Contacts', color: '#22c55e', icon: <Phone className="h-5 w-5" /> },
    { id: 'bank', label: 'Bank', color: '#a855f7', icon: <Landmark className="h-5 w-5" /> },
    { id: 'market', label: 'Market', color: '#f59e0b', icon: <ShoppingBag className="h-5 w-5" /> },
    { id: 'social', label: 'StreetFeed', color: '#ec4899', icon: <Sparkles className="h-5 w-5" /> },
    { id: 'music', label: 'Music', color: '#f43f5e', icon: <Music className="h-5 w-5" /> },
    { id: 'garage', label: 'Garage', color: '#eab308', icon: <Car className="h-5 w-5" /> },
    { id: 'jobs', label: 'Jobs', color: '#14b8a6', icon: <Briefcase className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', color: '#94a3b8', icon: <Settings className="h-5 w-5" /> },
  ];

  const otherPlayers = remotePlayers.filter((p) => p.playerId !== playerId);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Phone Status Bar */}
        <div className="flex items-center justify-between bg-zinc-900 px-5 py-2.5 text-[11px] font-telemetry text-zinc-300 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{clockStr}</span>
            {roomInfo && (
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-300">
                {roomInfo.code}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Wifi className={`h-3.5 w-3.5 ${wsConnected ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="text-emerald-400 font-bold">
              ${(economy.cash + economy.bank).toLocaleString()}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="ml-1 rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
              title="Close Smartphone [P]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Incoming Trade Notification Banner */}
        {incomingTrade && incomingTrade.status === 'pending' && (
          <div className="bg-amber-950/80 border-b border-amber-500/40 px-4 py-2.5 text-xs">
            <div className="font-bold text-amber-300">
              Trade Offer from {incomingTrade.fromName}
            </div>
            <div className="text-zinc-200 mt-0.5">
              They offer ${incomingTrade.offerCash.toLocaleString()} · Requesting $
              {incomingTrade.requestCash.toLocaleString()}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onRespondTrade(incomingTrade.id, true)}
                className="rounded bg-emerald-500 px-3 py-1 font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
              >
                Accept Trade
              </button>
              <button
                type="button"
                onClick={() => onRespondTrade(incomingTrade.id, false)}
                className="rounded border border-white/20 px-3 py-1 text-zinc-200 hover:bg-white/10 cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* App Sub-Header */}
        {app !== 'home' && (
          <div className="flex items-center justify-between bg-zinc-900/60 px-4 py-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setApp('home')}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              ← Home
            </button>
            <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
              {APPS.find((a) => a.id === app)?.label || app}
            </span>
            <span className="text-[10px] font-telemetry text-zinc-500">SK-OS 4.0</span>
          </div>
        )}

        {/* Main Phone Screen Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* HOME SCREEN */}
          {app === 'home' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-400">Driver Profile</div>
                    <div className="font-display text-base font-bold text-white">
                      {economy.character.name}
                    </div>
                  </div>
                  <div className="text-right font-telemetry text-xs">
                    <div className="text-amber-300">{economy.reputation} REP</div>
                    <div className="text-zinc-400">
                      Busts: {economy.policeRecord.busts} · Jail: {economy.policeRecord.jailSentences}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenModalShortcut('copilot')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-950/35 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-900/40 cursor-pointer"
                >
                  <Bot className="h-4 w-4" /> AI Co-Pilot [G]
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModalShortcut('map_real')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-950/35 py-2.5 text-xs font-bold text-cyan-300 hover:bg-cyan-900/40 cursor-pointer"
                >
                  <Globe className="h-4 w-4" /> Google Maps
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {APPS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openApp(item.id)}
                    className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-zinc-900/75 p-3.5 hover:border-white/25 hover:bg-zinc-900 cursor-pointer"
                  >
                    {item.badge ? (
                      <span className="absolute top-2 right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-950"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.icon}
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-200">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CONTACTS APP */}
          {app === 'contacts' && (
            <div className="space-y-2">
              {CONTACTS.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/70 p-3"
                >
                  <div>
                    <div className="text-xs font-bold text-white">{c.name}</div>
                    <div className="text-[11px] text-zinc-400">
                      {c.role} · {c.phone}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (c.app) openApp(c.app);
                      else if (c.shortcut) onOpenModalShortcut(c.shortcut);
                      else if (c.lmId) {
                        const lm = WORLD_LANDMARKS.find((l) => l.id === c.lmId);
                        if (lm) {
                          onSetGps(lm.x, lm.z, lm.name);
                          onClose();
                        }
                      }
                    }}
                    className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    Connect
                  </button>
                </div>
              ))}

              <div className="pt-2 text-xs font-semibold text-zinc-400">
                Friends List ({economy.friends.length})
              </div>
              {economy.friends.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-3 text-xs text-zinc-400">
                  No friends added yet. Join a Multiplayer lobby to add online drivers.
                </div>
              ) : (
                economy.friends.map((f) => (
                  <div
                    key={f.playerId}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-white">{f.name}</span>
                    <span className="font-telemetry text-[10px] text-cyan-400">FRIEND</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* MESSAGES & LIVE ROOM CHAT */}
          {app === 'messages' && (
            <div className="space-y-3">
              {roomInfo && (
                <div className="rounded-xl border border-cyan-500/30 bg-zinc-900/75 p-3 space-y-2">
                  <div className="text-xs font-bold text-cyan-300">
                    Lobby Chat · {roomInfo.code}
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs">
                    {roomChat.length === 0 ? (
                      <div className="text-zinc-500">No messages in room yet.</div>
                    ) : (
                      roomChat.map((m, idx) => (
                        <div key={idx} className="rounded bg-zinc-950/70 px-2.5 py-1.5">
                          <span className="font-bold text-amber-400">{m.fromName}: </span>
                          <span className="text-zinc-200">{m.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!chatInput.trim()) return;
                      onSendRoomChat(chatInput.trim());
                      setChatInput('');
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Message lobby..."
                      className="flex-1 rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-cyan-500 px-3 py-1.5 text-zinc-950 font-bold cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              )}

              <div className="text-xs font-semibold text-zinc-400">Inbox Notifications</div>
              <div className="space-y-2">
                {economy.messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-xs"
                  >
                    <div className="flex justify-between font-bold text-white">
                      <span>{m.from}</span>
                      <span className="text-[10px] font-telemetry text-zinc-500">{m.time}</span>
                    </div>
                    <p className="mt-1 text-zinc-300">{m.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GPS APP */}
          {app === 'gps' && (
            <div className="space-y-2.5">
              {telemetry.gpsTarget && (
                <div className="flex items-center justify-between rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3 text-xs">
                  <div>
                    <div className="text-[10px] font-telemetry text-cyan-400">ACTIVE ROUTE</div>
                    <div className="font-bold text-white">{telemetry.gpsTarget.label}</div>
                  </div>
                  <button
                    type="button"
                    onClick={onClearGps}
                    className="rounded bg-zinc-800 px-2.5 py-1 text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="text-xs text-zinc-400">Tap any landmark to calculate road route:</div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {WORLD_LANDMARKS.filter((l) => l.type !== 'hidden').map((lm) => (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() => {
                      onSetGps(lm.x, lm.z, lm.name);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-left text-xs hover:border-cyan-400/50 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">{lm.name}</div>
                      <div className="text-[11px] text-zinc-400">{lm.district}</div>
                    </div>
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: lm.color }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* BANK APP */}
          {app === 'bank' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 font-telemetry">
                <div className="rounded-xl border border-white/10 bg-zinc-900 p-3">
                  <div className="text-[10px] text-zinc-400">WALLET CASH</div>
                  <div className="text-lg font-bold text-emerald-400">
                    ${economy.cash.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-zinc-900 p-3">
                  <div className="text-[10px] text-zinc-400">PACIFIC BANK</div>
                  <div className="text-lg font-bold text-sky-400">
                    ${economy.bank.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3 space-y-2.5 text-xs">
                <div className="font-semibold text-zinc-200">Quick Transfer</div>
                <input
                  type="number"
                  min={1}
                  value={customBankAmt}
                  onChange={(e) => setCustomBankAmt(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white font-telemetry"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onDeposit(Math.max(0, Number(customBankAmt) || 0))}
                    className="rounded-lg bg-sky-500 py-2 font-bold text-zinc-950 hover:bg-sky-400 cursor-pointer"
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => onWithdraw(Math.max(0, Number(customBankAmt) || 0))}
                    className="rounded-lg border border-white/15 py-2 font-bold text-white hover:bg-white/10 cursor-pointer"
                  >
                    Withdraw
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onDeposit(economy.cash)}
                    className="rounded-lg border border-sky-500/30 py-1.5 text-[11px] text-sky-300 hover:bg-sky-500/10 cursor-pointer"
                  >
                    Deposit All Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenModalShortcut('empire')}
                    className="rounded-lg border border-violet-500/30 py-1.5 text-[11px] text-violet-300 hover:bg-violet-500/10 cursor-pointer"
                  >
                    Property Empire
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MARKETPLACE & P2P TRADING APP */}
          {app === 'market' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenModalShortcut('dealership')}
                  className="rounded-xl border border-amber-500/40 bg-zinc-900 p-3 text-left text-xs hover:bg-zinc-800 cursor-pointer"
                >
                  <div className="font-bold text-amber-400">Car Dealership</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Buy new supercars & off-roaders</div>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModalShortcut('empire')}
                  className="rounded-xl border border-violet-500/40 bg-zinc-900 p-3 text-left text-xs hover:bg-zinc-800 cursor-pointer"
                >
                  <div className="font-bold text-violet-400">Properties</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">Passive income real estate</div>
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-900/75 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-bold text-white">
                  <ArrowLeftRight className="h-4 w-4 text-emerald-400" />
                  Multiplayer Secure Cash Trade
                </div>
                {!roomInfo || otherPlayers.length === 0 ? (
                  <div className="text-zinc-400">
                    Join an Online Multiplayer room with another player to send secure server-validated cash trades.
                  </div>
                ) : (
                  <>
                    <select
                      value={tradeTargetId || otherPlayers[0]?.playerId || ''}
                      onChange={(e) => setTradeTargetId(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-2 text-xs text-white"
                    >
                      {otherPlayers.map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name} ({p.speedKmh} km/h)
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-400">Offer Cash ($)</label>
                        <input
                          type="number"
                          min={0}
                          value={tradeOfferCash}
                          onChange={(e) => setTradeOfferCash(e.target.value)}
                          className="mt-0.5 w-full rounded border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400">Request Cash ($)</label>
                        <input
                          type="number"
                          min={0}
                          value={tradeRequestCash}
                          onChange={(e) => setTradeRequestCash(e.target.value)}
                          className="mt-0.5 w-full rounded border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const target = tradeTargetId || otherPlayers[0]?.playerId;
                        if (target) {
                          onSendTradeOffer(
                            target,
                            Math.max(0, Number(tradeOfferCash) || 0),
                            Math.max(0, Number(tradeRequestCash) || 0)
                          );
                        }
                      }}
                      className="w-full rounded-lg bg-emerald-500 py-2 font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                    >
                      Send Escrow Trade Offer
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SOCIAL FEED ("StreetFeed") */}
          {app === 'social' && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!socialDraft.trim()) return;
                  onPostSocial(socialDraft.trim());
                  setSocialDraft('');
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={socialDraft}
                  onChange={(e) => setSocialDraft(e.target.value)}
                  placeholder="Share a race win or car meet photo..."
                  className="flex-1 rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-pink-500 px-3 py-2 text-xs font-bold text-white hover:bg-pink-400 cursor-pointer"
                >
                  Post
                </button>
              </form>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {economy.socialPosts.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-white/10 bg-zinc-900/70 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">
                        {p.author}{' '}
                        <span className="font-normal text-zinc-400">{p.handle}</span>
                      </span>
                      <span className="text-[10px] text-zinc-500">{p.time}</span>
                    </div>
                    <p className="mt-1.5 text-zinc-200">{p.content}</p>
                    <button
                      type="button"
                      onClick={() => onLikeSocial(p.id)}
                      className="mt-2 text-[11px] text-pink-400 hover:text-pink-300 cursor-pointer"
                    >
                      ♥ {p.likes} Likes
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MUSIC QUICK APP */}
          {app === 'music' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-zinc-900 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-telemetry uppercase" style={{ color: station.accentColor }}>
                    {station.name}
                  </div>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-telemetry text-zinc-300">
                    {telemetry.playerMode === 'driving'
                      ? 'IN-CAR STEREO'
                      : playingOnPhone
                      ? 'PHONE AUDIO ACTIVE'
                      : 'ON FOOT (BAR HIDDEN)'}
                  </span>
                </div>
                <div className="text-base font-bold text-white">
                  {track?.title || 'No Track Selected'}
                </div>
                <div className="text-zinc-400">{track?.artist}</div>
                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!radioPlaying && telemetry.playerMode !== 'driving') {
                        onSetPlayingOnPhone(true);
                      }
                      onToggleRadioPlay();
                    }}
                    className="flex-1 rounded-lg bg-amber-500 py-2 font-bold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                  >
                    {radioPlaying ? 'Pause' : telemetry.playerMode !== 'driving' ? 'Play on Phone' : 'Play'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (telemetry.playerMode !== 'driving') {
                        onSetPlayingOnPhone(true);
                      }
                      onNextTrack();
                    }}
                    className="rounded-lg border border-white/15 px-3 py-2 text-white hover:bg-white/10 cursor-pointer"
                  >
                    Next
                  </button>
                </div>

                <label className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 cursor-pointer">
                  <span className="text-[11px] text-zinc-300">
                    Keep Music Playing on Phone Outside Car
                  </span>
                  <input
                    type="checkbox"
                    checked={playingOnPhone}
                    onChange={(e) => onSetPlayingOnPhone(e.target.checked)}
                    className="accent-rose-500"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (telemetry.playerMode !== 'driving') {
                    onSetPlayingOnPhone(true);
                  }
                  onOpenModalShortcut('radio');
                }}
                className="w-full rounded-xl border border-rose-500/40 bg-rose-950/30 py-3 font-bold text-rose-300 hover:bg-rose-900/40 cursor-pointer"
              >
                Open Full YouTube Song Player &amp; Music Search
              </button>
            </div>
          )}

          {/* GARAGE QUICK APP */}
          {app === 'garage' && (
            <div className="space-y-2.5 text-xs">
              <button
                type="button"
                onClick={() => onOpenModalShortcut('garage')}
                className="w-full rounded-xl bg-amber-500 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 cursor-pointer"
              >
                Open Tuning & Paint Workshop
              </button>
              {economy.ownedCars.map((car) => {
                const spec = CAR_CATALOG.find((s) => s.id === car.specId) || CAR_CATALOG[0];
                const isActive = car.instanceId === economy.activeCarInstanceId;
                return (
                  <div
                    key={car.instanceId}
                    className={`rounded-xl border p-3 ${
                      isActive
                        ? 'border-amber-400 bg-zinc-900'
                        : 'border-white/10 bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">
                          {spec.brand} {spec.name}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Cond {Math.round(car.condition)}% · Fuel {Math.round(car.fuel)}% ·{' '}
                          {car.mileageKm.toFixed(1)} km
                        </div>
                      </div>
                      {car.impounded ? (
                        <button
                          type="button"
                          onClick={() => onRedeemImpounded(car.instanceId)}
                          className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-400 cursor-pointer"
                        >
                          Redeem ($1,500)
                        </button>
                      ) : isActive ? (
                        <span className="text-[11px] font-telemetry text-amber-400">ACTIVE</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectOwnedCar(car.instanceId);
                            onClose();
                          }}
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-zinc-950 cursor-pointer"
                        >
                          Drive
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* JOBS APP */}
          {app === 'jobs' && (
            <div className="space-y-2 text-xs">
              {JOBS_CATALOG.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-white/10 bg-zinc-900/70 p-3 space-y-1.5"
                >
                  <div className="flex justify-between font-bold text-white">
                    <span>{job.title}</span>
                    <span className="text-emerald-400">+${job.payout.toLocaleString()}</span>
                  </div>
                  <p className="text-zinc-400">{job.description}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onStartJob(job);
                      onClose();
                    }}
                    className="w-full rounded-lg bg-cyan-500 py-1.5 font-bold text-zinc-950 hover:bg-cyan-400 cursor-pointer"
                  >
                    Accept Contract ({job.timeLimitSec}s)
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* REAL ONLINE MULTIPLAYER APP */}
          {app === 'multiplayer' && (
            <div className="space-y-3 text-xs">
              {roomInfo ? (
                <>
                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-telemetry text-cyan-400">
                          {roomInfo.isPublic ? 'PUBLIC SERVER' : 'PRIVATE ROOM'}
                        </div>
                        <div className="font-bold text-white text-sm">{roomInfo.name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={onLeaveRoom}
                        className="rounded-lg border border-red-500/40 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/20 cursor-pointer"
                      >
                        Leave
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-zinc-950/80 px-3 py-2 border border-white/10">
                      <div>
                        <span className="text-zinc-400 mr-2">6-CHAR ROOM CODE:</span>
                        <strong className="font-telemetry text-base tracking-widest text-amber-400">
                          {roomInfo.code}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(roomInfo.code).catch(() => {});
                          setCopiedCode(true);
                          window.setTimeout(() => setCopiedCode(false), 1800);
                        }}
                        className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 cursor-pointer"
                      >
                        {copiedCode ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedCode ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Car Meet & Room Race Actions */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/75 p-3 space-y-2">
                    <div className="font-semibold text-white">Car Meet & Lobby Races</div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={carMeetLabel}
                        onChange={(e) => setCarMeetLabel(e.target.value)}
                        className="flex-1 rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => onHostCarMeet(carMeetLabel.trim() || 'Car Meet')}
                        className="rounded-lg bg-violet-500 px-3 py-1.5 font-bold text-white hover:bg-violet-400 cursor-pointer"
                      >
                        Host Meet
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <select
                        value={selectedRaceId}
                        onChange={(e) => setSelectedRaceId(e.target.value)}
                        className="flex-1 rounded-lg border border-white/15 bg-zinc-950 px-2 py-1.5 text-xs text-white"
                      >
                        {RACE_EVENTS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const race = RACE_EVENTS.find((r) => r.id === selectedRaceId);
                          if (race) {
                            onStartRoomRace(race);
                            onClose();
                          }
                        }}
                        className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                      >
                        <Flag className="h-3.5 w-3.5" /> Start Race
                      </button>
                    </div>
                  </div>

                  {/* Connected Drivers List */}
                  <div className="space-y-1.5">
                    <div className="font-semibold text-zinc-400">
                      Drivers in Lobby ({otherPlayers.length + 1})
                    </div>
                    <div className="rounded-lg border border-amber-400/30 bg-zinc-900/70 px-3 py-2 flex justify-between">
                      <span className="font-bold text-amber-300">
                        {economy.character.name} (You)
                      </span>
                      <span className="font-telemetry text-zinc-400">
                        {telemetry.speedKmh} km/h
                      </span>
                    </div>
                    {otherPlayers.map((p) => (
                      <div
                        key={p.playerId}
                        className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{p.name}</div>
                          <div className="text-[10px] font-telemetry text-zinc-400">
                            {p.speedKmh} km/h · ({Math.round(p.x)}, {Math.round(p.z)})
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onSetGps(p.x, p.z, `Player: ${p.name}`);
                              onClose();
                            }}
                            className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-cyan-300 hover:bg-zinc-700 cursor-pointer"
                          >
                            GPS
                          </button>
                          <button
                            type="button"
                            onClick={() => onAddFriend(p.playerId, p.name)}
                            className="rounded bg-zinc-800 p-1 text-emerald-400 hover:bg-zinc-700 cursor-pointer"
                            title="Add Friend"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Create Room */}
                  <div className="rounded-xl border border-white/10 bg-zinc-900/75 p-3 space-y-2">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Plus className="h-4 w-4 text-amber-400" /> Create Online Room
                    </div>
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="Lobby Name"
                      className="w-full rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-white"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newRoomPublic}
                          onChange={(e) => setNewRoomPublic(e.target.checked)}
                          className="accent-cyan-500"
                        />
                        List as Public Server
                      </label>
                      <button
                        type="button"
                        onClick={() => onCreateRoom(newRoomName.trim() || 'Street Cruise', newRoomPublic)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                      >
                        Create 6-Char Room
                      </button>
                    </div>
                  </div>

                  {/* Join by 6-Character Code */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (joinCode.trim().length >= 4) {
                        onJoinRoom(joinCode.trim().toUpperCase());
                      }
                    }}
                    className="rounded-xl border border-white/10 bg-zinc-900/75 p-3 space-y-2"
                  >
                    <div className="font-bold text-white">Join by 6-Character Game Code</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="e.g. KGN001"
                        className="flex-1 rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 font-telemetry text-sm tracking-widest uppercase text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-cyan-500 px-4 py-1.5 font-bold text-zinc-950 hover:bg-cyan-400 cursor-pointer"
                      >
                        Join
                      </button>
                    </div>
                  </form>

                  {/* Public Servers Browser */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-cyan-400" /> Public Servers
                      </span>
                      <button
                        type="button"
                        onClick={refreshServers}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                      >
                        <RefreshCw className={`h-3 w-3 ${loadingServers ? 'animate-spin' : ''}`} /> Refresh
                      </button>
                    </div>
                    {publicServers.map((srv) => (
                      <div
                        key={srv.code}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 p-2.5"
                      >
                        <div>
                          <div className="font-bold text-white">{srv.name}</div>
                          <div className="text-[10px] font-telemetry text-zinc-400">
                            CODE: {srv.code} · {srv.playerCount} online
                            {srv.carMeet ? ` · Meet: ${srv.carMeet.label}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onJoinRoom(srv.code)}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                        >
                          Connect
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SETTINGS, GRAPHICS, PROFILE & ACHIEVEMENTS */}
          {app === 'settings' && (
            <div className="space-y-3 text-xs">
              {/* Graphics */}
              <div className="rounded-xl border border-white/10 bg-zinc-900/75 p-3 space-y-2.5">
                <div className="font-bold text-white">AAA Graphics & Atmosphere</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['low', 'medium', 'high', 'ultra'] as GraphicsPreset[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        onUpdateGraphics({
                          ...economy.graphicsSettings,
                          preset: p,
                          shadows: p !== 'low',
                          bloom: p === 'high' || p === 'ultra',
                        })
                      }
                      className={`rounded-lg py-1.5 font-semibold uppercase cursor-pointer ${
                        economy.graphicsSettings.preset === p
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center justify-between rounded-lg bg-zinc-950/70 px-2.5 py-2 cursor-pointer">
                    <span>Dynamic Shadows</span>
                    <input
                      type="checkbox"
                      checked={economy.graphicsSettings.shadows}
                      onChange={(e) =>
                        onUpdateGraphics({
                          ...economy.graphicsSettings,
                          shadows: e.target.checked,
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-lg bg-zinc-950/70 px-2.5 py-2 cursor-pointer">
                    <span>Neon Bloom</span>
                    <input
                      type="checkbox"
                      checked={economy.graphicsSettings.bloom}
                      onChange={(e) =>
                        onUpdateGraphics({
                          ...economy.graphicsSettings,
                          bloom: e.target.checked,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400">Weather</label>
                    <select
                      value={economy.graphicsSettings.weather}
                      onChange={(e) =>
                        onUpdateGraphics({
                          ...economy.graphicsSettings,
                          weather: e.target.value as WeatherMode,
                        })
                      }
                      className="mt-0.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-2 py-1.5 text-white"
                    >
                      <option value="clear">Clear Skies</option>
                      <option value="overcast">Overcast</option>
                      <option value="rain">Rain & Wet Roads</option>
                      <option value="fog">Coastal Fog</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400">Day / Night Cycle</label>
                    <select
                      value={economy.graphicsSettings.timeOfDay}
                      onChange={(e) =>
                        onUpdateGraphics({
                          ...economy.graphicsSettings,
                          timeOfDay: e.target.value as TimeOfDayMode,
                        })
                      }
                      className="mt-0.5 w-full rounded-lg border border-white/15 bg-zinc-950 px-2 py-1.5 text-white"
                    >
                      <option value="auto">Auto Day/Night</option>
                      <option value="dawn">Golden Dawn</option>
                      <option value="noon">High Noon</option>
                      <option value="sunset">Neon Sunset</option>
                      <option value="midnight">Midnight</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Driver Profile */}
              <div className="rounded-xl border border-white/10 bg-zinc-900/75 p-3 space-y-2">
                <div className="font-bold text-white">Driver Identity</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={20}
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="flex-1 rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-white"
                  />
                  <input
                    type="color"
                    value={jacketColor}
                    onChange={(e) => setJacketColor(e.target.value)}
                    className="h-8 w-10 rounded cursor-pointer bg-transparent"
                    title="Jacket Color"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateProfile(driverName.trim() || 'StreetKing', jacketColor)}
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 font-bold text-zinc-950 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Achievements */}
              <div className="rounded-xl border border-white/10 bg-zinc-900/75 p-3 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-400" />
                  Achievements ({economy.achievements.length}/{ACHIEVEMENTS_CATALOG.length})
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {ACHIEVEMENTS_CATALOG.map((ach) => {
                    const unlocked = economy.achievements.includes(ach.id);
                    return (
                      <div
                        key={ach.id}
                        className={`rounded-lg px-2.5 py-1.5 border ${
                          unlocked
                            ? 'border-amber-400/40 bg-amber-950/25 text-amber-200'
                            : 'border-white/5 bg-zinc-950/60 text-zinc-500'
                        }`}
                      >
                        <div className="flex justify-between font-semibold">
                          <span>{ach.title}</span>
                          <span>{unlocked ? 'UNLOCKED' : `+$${ach.rewardCash}`}</span>
                        </div>
                        <div className="text-[10px]">{ach.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save / Export */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onManualSave}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" /> Save Progress
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(economy, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'street-kings-save.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 py-2 font-semibold text-zinc-200 hover:bg-white/10 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenModalShortcut('admin');
                  }}
                  className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/35 py-2 font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" /> Open Admin Code Console [~ / F9]
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
