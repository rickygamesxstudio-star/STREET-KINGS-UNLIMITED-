import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { SoundEngine } from './audio/SoundEngine';
import { AdminModal } from './components/AdminModal';
import { ControlsModal } from './components/ControlsModal';
import { DealershipModal } from './components/DealershipModal';
import { DrivingHud } from './components/DrivingHud';
import { EmpireModal } from './components/EmpireModal';
import { GarageModal } from './components/GarageModal';
import { GasStationModal } from './components/GasStationModal';
import { GeminiCopilotModal } from './components/GeminiCopilotModal';
import { MainMenuOverlay } from './components/MainMenuOverlay';
import { PoliceModal } from './components/PoliceModal';
import { RadioModal } from './components/RadioModal';
import { RaceHubModal } from './components/RaceHubModal';
import { PhoneAppId, SmartphoneModal } from './components/SmartphoneModal';
import { WorldMapModal } from './components/WorldMapModal';
import {
  ACHIEVEMENTS_CATALOG,
  CAR_CATALOG,
  PROPERTIES_CATALOG,
  RACE_EVENTS,
  RADIO_STATIONS,
  WORLD_LANDMARKS,
} from './data/worldData';
import { DrivingEngine } from './engine/DrivingEngine';
import { MultiplayerClient } from './services/MultiplayerClient';
import {
  ActiveRaceState,
  AdminOverrides,
  CarCustomization,
  CarSpec,
  CarUpgrades,
  GraphicsSettings,
  HudTelemetry,
  InputState,
  JobDefinition,
  LandmarkType,
  MultiplayerRoomInfo,
  OwnedCar,
  PlayerEconomyState,
  PoliceStopEvent,
  PropertyAsset,
  RaceEvent,
  RadioStation,
  RadioTrack,
  RandomWorldEvent,
  RemotePlayerState,
  TimeOfDayMode,
  TradeOfferPayload,
  WeatherMode,
  WorldLandmark,
} from './types/game';

const STORAGE_KEY = 'street_kings_unlimited_save_v1';
const PLAYER_ID_KEY = 'street_kings_player_id_v1';

type ModalType =
  | null
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
  | 'admin';

const DEFAULT_GRAPHICS: GraphicsSettings = {
  preset: 'high',
  shadows: true,
  bloom: true,
  weatherEffects: true,
  trafficDensity: 'normal',
  weather: 'clear',
  timeOfDay: 'sunset',
};

function getPersistentPlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const generated = `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(PLAYER_ID_KEY, generated);
    return generated;
  } catch {
    return `sk_${Date.now().toString(36)}`;
  }
}

function createInitialEconomy(): PlayerEconomyState {
  const starterSpec = CAR_CATALOG[0];
  const starterCar: OwnedCar = {
    instanceId: 'car_starter_1',
    specId: starterSpec.id,
    upgrades: {
      engine: 1,
      turbo: 1,
      tires: 1,
      suspension: 1,
      brakes: 1,
      transmission: 1,
    },
    customization: {
      paintColor: starterSpec.defaultColor,
      finish: 'metallic',
      rimColor: '#e4e4e7',
      spoiler: true,
      underglowColor: '#06b6d4',
    },
    condition: 100,
    fuel: 100,
    tireHealth: 100,
    oilHealth: 100,
    mileageKm: 0,
  };

  const defaults: PlayerEconomyState = {
    cash: 12500,
    bank: 25000,
    reputation: 0,
    ownedCars: [starterCar],
    activeCarInstanceId: starterCar.instanceId,
    ownedPropertyIds: [],
    completedRaceIds: [],
    championshipPoints: 0,
    character: {
      name: 'StreetKing',
      jacketColor: '#e11d48',
      avatarTag: 'SK',
    },
    policeRecord: {
      busts: 0,
      jailSentences: 0,
      totalFinesPaid: 0,
      confiscationsCount: 0,
      offenseHistory: [],
    },
    achievements: [],
    discoveredLandmarkIds: [],
    favoriteTracks: [],
    friends: [],
    messages: [
      {
        id: 'msg_welcome',
        from: 'Kingston Dispatch',
        text: 'Welcome to Street Kings: Jamaica! Use your Smartphone [P] for GPS routes, Jobs, Banking, Phone Music & Live Online Multiplayer.',
        time: 'Now',
        unread: true,
      },
    ],
    socialPosts: [
      {
        id: 'soc_1',
        author: 'Jax',
        handle: '@knutsford_jax',
        content: 'New twin-turbo kits just arrived at Knutsford Customs. Drop by New Kingston for a tune!',
        likes: 24,
        time: '12m ago',
      },
      {
        id: 'soc_2',
        author: 'Elena',
        handle: '@yard_elena',
        content: 'Beverly Hills villas and Palisadoes hangars are open for investors.',
        likes: 18,
        time: '34m ago',
      },
    ],
    graphicsSettings: DEFAULT_GRAPHICS,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerEconomyState>;
      if (parsed && Array.isArray(parsed.ownedCars) && parsed.ownedCars.length > 0) {
        return {
          ...defaults,
          ...parsed,
          character: { ...defaults.character, ...(parsed.character || {}) },
          policeRecord: {
            ...defaults.policeRecord,
            ...(parsed.policeRecord || {}),
            offenseHistory: Array.isArray(parsed.policeRecord?.offenseHistory)
              ? parsed.policeRecord!.offenseHistory
              : [],
          },
          achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
          discoveredLandmarkIds: Array.isArray(parsed.discoveredLandmarkIds)
            ? parsed.discoveredLandmarkIds
            : [],
          favoriteTracks: Array.isArray(parsed.favoriteTracks) ? parsed.favoriteTracks : [],
          friends: Array.isArray(parsed.friends) ? parsed.friends : [],
          messages:
            Array.isArray(parsed.messages) && parsed.messages.length > 0
              ? parsed.messages
              : defaults.messages,
          socialPosts:
            Array.isArray(parsed.socialPosts) && parsed.socialPosts.length > 0
              ? parsed.socialPosts
              : defaults.socialPosts,
          graphicsSettings: {
            ...DEFAULT_GRAPHICS,
            ...(parsed.graphicsSettings || {}),
          },
        };
      }
    }
  } catch {
    // ignore storage parse failure
  }

  return defaults;
}

const INITIAL_TELEMETRY: HudTelemetry = {
  speedKmh: 0,
  rpm: 850,
  maxRpm: 8500,
  gear: 'N',
  nitro: 100,
  isDrifting: false,
  currentDriftPoints: 0,
  playerMode: 'driving',
  cameraMode: 'chase',
  playerX: 0,
  playerY: 0,
  playerZ: 24,
  playerHeading: 0,
  surface: 'asphalt',
  wantedLevel: 0,
  wantedCooldownPct: 0,
  bustProgressPct: 0,
  nearbyPrompt: null,
  gpsTarget: null,
  activeRace: null,
  activeJob: null,
  activeRandomEvent: null,
  minimapEntities: [],
  clockHour: 18.2,
  weather: 'clear',
  toastMessage: 'W/A/S/D Drive · SPACE Handbrake · SHIFT Nitro · P Phone · M Map · ~ Admin',
};

const OFFICERS = [
  { name: 'Officer Campbell', badge: '418' },
  { name: 'Sgt. Reid', badge: '209' },
  { name: 'Lt. Brown', badge: '112' },
  { name: 'Officer Grant', badge: '534' },
];

const DEFAULT_ADMIN_OVERRIDES: AdminOverrides = {
  godMode: false,
  unlimitedNitroFuel: false,
  noPolice: false,
  trafficDisabled: false,
  freezeTime: false,
  speedMultiplier: 1,
  accelMultiplier: 1,
  gripMultiplier: 1,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<DrivingEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const mpClientRef = useRef<MultiplayerClient | null>(null);
  const prevPlayerModeRef = useRef<'driving' | 'walking'>('driving');
  const playerId = useMemo(() => getPersistentPlayerId(), []);

  const [showMainMenu, setShowMainMenu] = useState(true);
  const [economy, setEconomy] = useState<PlayerEconomyState>(createInitialEconomy);
  const [telemetry, setTelemetry] = useState<HudTelemetry>(INITIAL_TELEMETRY);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [mapInitialTab, setMapInitialTab] = useState<'city' | 'google'>('city');
  const [phoneInitialApp, setPhoneInitialApp] = useState<PhoneAppId>('home');
  const [raceResult, setRaceResult] = useState<ActiveRaceState | null>(null);
  const [policeStop, setPoliceStop] = useState<PoliceStopEvent | null>(null);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Admin Console State
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [verifiedAdminCode, setVerifiedAdminCode] = useState('');
  const [adminOverrides, setAdminOverrides] = useState<AdminOverrides>(DEFAULT_ADMIN_OVERRIDES);

  // Radio State
  const [stations, setStations] = useState<RadioStation[]>(RADIO_STATIONS);
  const [activeStationId, setActiveStationId] = useState<string>(RADIO_STATIONS[0].id);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [radioPlaying, setRadioPlaying] = useState<boolean>(false);
  const [playingOnPhone, setPlayingOnPhone] = useState<boolean>(false);
  const [radioVolume, setRadioVolume] = useState<number>(0.55);

  // Real Online Multiplayer State
  const [wsConnected, setWsConnected] = useState(false);
  const [roomInfo, setRoomInfo] = useState<MultiplayerRoomInfo | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayerState[]>([]);
  const [roomChat, setRoomChat] = useState<
    Array<{ fromId: string; fromName: string; text: string; timestamp: number }>
  >([]);
  const [incomingTrade, setIncomingTrade] = useState<TradeOfferPayload | null>(null);

  const economyRef = useRef(economy);
  economyRef.current = economy;

  const activeCar = useMemo(() => {
    const found = economy.ownedCars.find(
      (c) => c.instanceId === economy.activeCarInstanceId && !c.impounded
    );
    return (
      found ||
      economy.ownedCars.find((c) => !c.impounded) ||
      economy.ownedCars[0]
    );
  }, [economy.ownedCars, economy.activeCarInstanceId]);

  const activeSpec = useMemo(() => {
    return CAR_CATALOG.find((s) => s.id === activeCar.specId) || CAR_CATALOG[0];
  }, [activeCar.specId]);

  const activeStation = useMemo(() => {
    return stations.find((s) => s.id === activeStationId) || stations[0];
  }, [stations, activeStationId]);

  const activeTrack = activeStation.tracks[activeTrackIndex] || activeStation.tracks[0];

  // Persist Save State
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(economy));
    } catch {
      // ignore quota error
    }
  }, [economy]);

  const unlockAchievement = useCallback((achId: string) => {
    const def = ACHIEVEMENTS_CATALOG.find((a) => a.id === achId);
    if (!def) return;
    setEconomy((prev) => {
      if (prev.achievements.includes(achId)) return prev;
      engineRef.current?.showToast(
        `Achievement Unlocked: ${def.title} (+$${def.rewardCash.toLocaleString()})`,
        4.0
      );
      soundRef.current?.playChime('cash');
      return {
        ...prev,
        cash: prev.cash + def.rewardCash,
        achievements: [...prev.achievements, achId],
        messages: [
          {
            id: `ach_msg_${Date.now()}`,
            from: 'Street Kings Awards',
            text: `Unlocked "${def.title}": ${def.description} Bonus +$${def.rewardCash.toLocaleString()} credited!`,
            time: 'Just now',
            unread: true,
          },
          ...prev.messages,
        ],
      };
    });
  }, []);

  const spendFunds = useCallback((cost: number): boolean => {
    const cur = economyRef.current;
    if (cur.cash + cur.bank < cost) return false;
    setEconomy((prev) => {
      if (prev.cash + prev.bank < cost) return prev;
      if (prev.cash >= cost) {
        return { ...prev, cash: prev.cash - cost };
      }
      const rem = cost - prev.cash;
      return { ...prev, cash: 0, bank: prev.bank - rem };
    });
    return true;
  }, []);

  // Mount Three.js DrivingEngine once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const sound = new SoundEngine();
    soundRef.current = sound;

    const engine = new DrivingEngine(
      mountEl,
      activeSpec,
      activeCar,
      economy.graphicsSettings,
      economy.discoveredLandmarkIds,
      sound,
      {
        onTelemetry: (t) => setTelemetry(t),
        onOpenLandmark: (type: LandmarkType, landmarkId: string) => {
          if (type === 'dealership') setActiveModal('dealership');
          else if (type === 'garage') setActiveModal('garage');
          else if (type === 'gas') setActiveModal('gas');
          else if (type === 'bank' || type === 'property') setActiveModal('empire');
          else if (type === 'police') {
            const rec = economyRef.current.policeRecord;
            engine.showToast(
              `JCF Police Record: ${rec.busts} Busts · ${rec.jailSentences} Jail Sentences · ${rec.confiscationsCount} Impounds`,
              4.0
            );
          } else if (type === 'airport') {
            engine.showToast('Norman Manley Int’l Runway Clear — Push for top speed!', 3.2);
          } else if (type === 'race') {
            const lm = WORLD_LANDMARKS.find((l) => l.id === landmarkId);
            const race = RACE_EVENTS.find((r) => r.id === lm?.raceId);
            if (race) {
              setActiveModal('races');
            }
          }
        },
        onDriftBanked: (pts, cashEarned, repEarned) => {
          setEconomy((prev) => ({
            ...prev,
            cash: prev.cash + cashEarned,
            reputation: prev.reputation + repEarned,
          }));
          if (pts >= 500) unlockAchievement('ach_first_drift');
        },
        onRaceFinished: (res) => {
          setRaceResult(res);
          mpClientRef.current?.notifyRaceFinished();
          setEconomy((prev) => {
            const completed =
              res.resultPlace === 1 && !prev.completedRaceIds.includes(res.raceId)
                ? [...prev.completedRaceIds, res.raceId]
                : prev.completedRaceIds;
            const ptsGain =
              res.resultPlace === 1
                ? 25
                : res.resultPlace === 2
                ? 15
                : res.resultPlace === 3
                ? 10
                : 3;
            return {
              ...prev,
              cash: prev.cash + (res.prizeWon || 0),
              reputation: prev.reputation + (res.repWon || 0),
              completedRaceIds: completed,
              championshipPoints: prev.championshipPoints + ptsGain,
            };
          });
          if (res.resultPlace === 1) {
            unlockAchievement('ach_first_win');
            if (res.raceId === 'race_street_kings_championship') {
              unlockAchievement('ach_champ');
            }
          }
        },
        onJobFinished: (success, payout, rep, title) => {
          if (success) {
            setEconomy((prev) => ({
              ...prev,
              cash: prev.cash + payout,
              reputation: prev.reputation + rep,
              messages: [
                {
                  id: `job_msg_${Date.now()}`,
                  from: 'Kingston Dispatch',
                  text: `Contract "${title}" completed! Paid +$${payout.toLocaleString()} and +${rep} REP.`,
                  time: 'Just now',
                  unread: true,
                },
                ...prev.messages,
              ],
            }));
          }
        },
        onPoliceStop: (charges, wantedLevel) => {
          const curRec = economyRef.current.policeRecord;
          const officer = OFFICERS[Math.floor(Math.random() * OFFICERS.length)];
          const safeCharges =
            charges.length > 0 ? charges : ['Reckless Driving & Evading Traffic Stop'];
          const baseFine = wantedLevel * 380 + safeCharges.length * 160;
          const nextBustCount = curRec.busts + 1;
          const nextJailCount = curRec.jailSentences + 1;
          const isThirdBustConfiscationRisk = nextBustCount % 3 === 0;
          const isThirdJailEscalation = curRec.jailSentences >= 2;
          const escalatedFine = Math.round(
            baseFine * (isThirdJailEscalation ? 1.5 : 1.0)
          );

          setPoliceStop({
            officerName: officer.name,
            badgeNumber: officer.badge,
            wantedLevel,
            charges: safeCharges,
            baseFine,
            escalatedFine,
            nextBustCount,
            nextJailCount,
            isThirdBustConfiscationRisk,
            isThirdJailEscalation,
          });
        },
        onEscapedPolice: (repReward) => {
          setEconomy((prev) => ({
            ...prev,
            reputation: prev.reputation + repReward,
          }));
          unlockAchievement('ach_outlaw');
        },
        onConsumptionUpdate: (fuelDelta, condDelta, distKm) => {
          setEconomy((prev) => ({
            ...prev,
            ownedCars: prev.ownedCars.map((c) =>
              c.instanceId !== prev.activeCarInstanceId
                ? c
                : {
                    ...c,
                    fuel: Math.max(0, Math.min(100, c.fuel + fuelDelta)),
                    condition: Math.max(0, Math.min(100, c.condition + condDelta)),
                    tireHealth: Math.max(5, c.tireHealth - distKm * 0.15),
                    oilHealth: Math.max(5, c.oilHealth - distKm * 0.1),
                    mileageKm: c.mileageKm + distKm,
                  }
            ),
          }));
        },
        onHiddenDiscovered: (landmark: WorldLandmark) => {
          const cashBonus = landmark.hiddenRewardCash || 5000;
          const repBonus = landmark.hiddenRewardRep || 150;
          setEconomy((prev) => {
            if (prev.discoveredLandmarkIds.includes(landmark.id)) return prev;
            return {
              ...prev,
              cash: prev.cash + cashBonus,
              reputation: prev.reputation + repBonus,
              discoveredLandmarkIds: [...prev.discoveredLandmarkIds, landmark.id],
            };
          });
          unlockAchievement('ach_explorer');
        },
        onRandomEventCompleted: (ev: RandomWorldEvent) => {
          setEconomy((prev) => ({
            ...prev,
            cash: prev.cash + ev.rewardCash,
            reputation: prev.reputation + ev.rewardRep,
          }));
        },
      }
    );

    engineRef.current = engine;

    return () => {
      engine.dispose();
      sound.dispose();
      engineRef.current = null;
      soundRef.current = null;
    };
    // Intentionally mounted once so WebGL stays alive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mount Real WebSocket Multiplayer Client
  useEffect(() => {
    const client = new MultiplayerClient(playerId, {
      onConnectionChange: (connected) => setWsConnected(connected),
      onRoomJoined: (room, players) => {
        setRoomInfo(room);
        setRemotePlayers(players);
        setRoomChat([]);
        engineRef.current?.syncRemotePlayers(players, playerId);
        engineRef.current?.setCarMeetBeacon(room.carMeet || null);
        engineRef.current?.showToast(`Joined Room ${room.code} (${room.name})`, 3.5);
      },
      onRoomLeft: () => {
        setRoomInfo(null);
        setRemotePlayers([]);
        setRoomChat([]);
        engineRef.current?.syncRemotePlayers([], playerId);
        engineRef.current?.setCarMeetBeacon(null);
        engineRef.current?.showToast('Left online room');
      },
      onRoomError: (err) => {
        engineRef.current?.showToast(`Multiplayer: ${err}`, 3.5);
      },
      onPlayerJoined: (player) => {
        setRemotePlayers((prev) => {
          const next = [...prev.filter((p) => p.playerId !== player.playerId), player];
          engineRef.current?.syncRemotePlayers(next, playerId);
          return next;
        });
        engineRef.current?.showToast(`${player.name} joined the lobby`, 2.2);
      },
      onPlayerLeft: (pid) => {
        setRemotePlayers((prev) => {
          const next = prev.filter((p) => p.playerId !== pid);
          engineRef.current?.syncRemotePlayers(next, playerId);
          return next;
        });
      },
      onPlayerUpdate: (player) => {
        setRemotePlayers((prev) => {
          const idx = prev.findIndex((p) => p.playerId === player.playerId);
          const next =
            idx >= 0
              ? prev.map((p, i) => (i === idx ? player : p))
              : [...prev, player];
          engineRef.current?.syncRemotePlayers(next, playerId);
          return next;
        });
      },
      onChat: (msg) => {
        setRoomChat((prev) => [...prev.slice(-40), msg]);
        if (msg.fromId !== playerId) {
          engineRef.current?.showToast(`${msg.fromName}: ${msg.text}`, 3.0);
        }
      },
      onCarMeet: (meet) => {
        setRoomInfo((prev) => (prev ? { ...prev, carMeet: meet } : prev));
        engineRef.current?.setCarMeetBeacon(meet);
        engineRef.current?.showToast(
          `Car Meet Hosted by ${meet.hostName}: ${meet.label}`,
          4.0
        );
      },
      onRaceStart: (race, starterName) => {
        setRoomInfo((prev) => (prev ? { ...prev, race } : prev));
        if (race) {
          const def = RACE_EVENTS.find((r) => r.id === race.raceId);
          if (def) {
            engineRef.current?.startRace(def);
            engineRef.current?.showToast(
              `Multiplayer Race Started by ${starterName}: ${def.name}!`,
              3.5
            );
          }
        }
      },
      onRaceUpdate: (race) => {
        setRoomInfo((prev) => (prev ? { ...prev, race } : prev));
      },
      onTradeIncoming: (trade) => {
        setIncomingTrade(trade);
        engineRef.current?.showToast(
          `New Cash Trade Offer from ${trade.fromName} (Open Phone)`,
          4.0
        );
      },
      onTradeResolved: (trade) => {
        setIncomingTrade(null);
        if (trade.status === 'accepted') {
          const isSender = trade.fromId === playerId;
          const isReceiver = trade.toId === playerId;
          if (isSender || isReceiver) {
            const delta = isSender
              ? trade.requestCash - trade.offerCash
              : trade.offerCash - trade.requestCash;
            setEconomy((prev) => ({
              ...prev,
              cash: Math.max(0, prev.cash + delta),
            }));
            soundRef.current?.playChime('cash');
            engineRef.current?.showToast(
              `Trade Completed with ${isSender ? trade.toName : trade.fromName}! (${
                delta >= 0 ? `+$${delta.toLocaleString()}` : `-$${Math.abs(delta).toLocaleString()}`
              })`,
              3.5
            );
          }
        } else {
          engineRef.current?.showToast('Trade offer declined', 2.5);
        }
      },
      onTradeError: (err) => {
        engineRef.current?.showToast(`Trade Error: ${err}`, 3.5);
      },
      onAntiCheatWarning: (reason, x, z) => {
        engineRef.current?.teleportTo(x, z, 0);
        engineRef.current?.showToast(`Anti-Cheat Reconciliation: ${reason}`, 4.0);
      },
      onAdminBroadcast: (text, adminName) => {
        engineRef.current?.showToast(`ADMIN (${adminName}): ${text}`, 4.5);
      },
      onAdminWeather: (weather, timeOfDay, adminName) => {
        setEconomy((prev) => {
          const nextGraphics: GraphicsSettings = {
            ...prev.graphicsSettings,
            weather: weather as WeatherMode,
            timeOfDay: timeOfDay as TimeOfDayMode,
          };
          engineRef.current?.applyGraphicsSettings(nextGraphics);
          return { ...prev, graphicsSettings: nextGraphics };
        });
        engineRef.current?.showToast(`Room Admin (${adminName}) updated environment.`, 3.5);
      },
      onAdminKicked: (reason) => {
        engineRef.current?.showToast(reason, 4.5);
      },
    });

    mpClientRef.current = client;
    client.connect();

    return () => {
      client.dispose();
      mpClientRef.current = null;
    };
  }, [playerId]);

  // Broadcast player vehicle state at 20Hz while in an Online Multiplayer room
  useEffect(() => {
    if (!roomInfo) return;
    const timer = window.setInterval(() => {
      const snap = engineRef.current?.getPlayerSnapshot();
      if (snap) {
        mpClientRef.current?.sendState(snap);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [roomInfo]);

  // Stop car stereo when exiting vehicle unless user chose to play on phone
  useEffect(() => {
    const prevMode = prevPlayerModeRef.current;
    prevPlayerModeRef.current = telemetry.playerMode;
    if (prevMode === 'driving' && telemetry.playerMode === 'walking' && !playingOnPhone) {
      setRadioPlaying(false);
    }
  }, [telemetry.playerMode, playingOnPhone]);

  // Sync Radio Synth State (never plays synth over YouTube or audio preview tracks)
  useEffect(() => {
    if (!soundRef.current) return;
    const externalAudio = Boolean(
      activeTrack?.youtubeId || activeTrack?.youtubePlaylistId || activeTrack?.previewUrl
    );
    soundRef.current.setRadioState(
      radioPlaying,
      externalAudio ? 'preview' : activeStation.genre,
      activeTrack?.bpm || 96,
      radioVolume
    );
  }, [
    radioPlaying,
    activeStation.genre,
    activeTrack?.bpm,
    activeTrack?.youtubeId,
    activeTrack?.youtubePlaylistId,
    activeTrack?.previewUrl,
    radioVolume,
  ]);

  // Passive Business Income every 15 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      setEconomy((prev) => {
        if (prev.ownedPropertyIds.length === 0) return prev;
        const perMin = PROPERTIES_CATALOG.filter((p) =>
          prev.ownedPropertyIds.includes(p.id)
        ).reduce((sum, p) => sum + p.incomePerMinute, 0);
        const payout = Math.round(perMin / 4);
        if (payout <= 0) return prev;
        return { ...prev, bank: prev.bank + payout };
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Listen for Google Maps Platform Demo Key quota exceeded events
  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Global Map (M), Smartphone (P), AI Co-Pilot (G), Escape shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'KeyM' && !e.repeat) {
        setMapInitialTab('city');
        setActiveModal((cur) => (cur === 'map' ? null : 'map'));
      } else if (e.code === 'KeyP' && !e.repeat) {
        setPhoneInitialApp('home');
        setActiveModal((cur) => (cur === 'phone' ? null : 'phone'));
      } else if (e.code === 'KeyG' && !e.repeat) {
        setActiveModal((cur) => (cur === 'copilot' ? null : 'copilot'));
      } else if ((e.code === 'Backquote' || e.code === 'F9') && !e.repeat) {
        e.preventDefault();
        setActiveModal((cur) => (cur === 'admin' ? null : 'admin'));
      } else if (e.code === 'Escape') {
        setActiveModal(null);
        setRaceResult(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // --- Economy & Garage Handlers ---
  const handleBuyCar = (spec: CarSpec) => {
    if (economy.cash + economy.bank < spec.price || economy.reputation < spec.repRequired) {
      return;
    }
    const newCar: OwnedCar = {
      instanceId: `car_${Date.now()}`,
      specId: spec.id,
      upgrades: {
        engine: 1,
        turbo: 1,
        tires: 1,
        suspension: 1,
        brakes: 1,
        transmission: 1,
      },
      customization: {
        paintColor: spec.defaultColor,
        finish: 'metallic',
        rimColor: '#e4e4e7',
        spoiler: spec.bodyStyle !== 'offroad',
        underglowColor: null,
      },
      condition: 100,
      fuel: 100,
      tireHealth: 100,
      oilHealth: 100,
      mileageKm: 0,
    };
    spendFunds(spec.price);
    const nextCount = economy.ownedCars.length + 1;
    setEconomy((prev) => ({
      ...prev,
      ownedCars: [...prev.ownedCars, newCar],
      activeCarInstanceId: newCar.instanceId,
    }));
    engineRef.current?.swapActiveCar(spec, newCar);
    soundRef.current?.playChime('cash');
    if (nextCount >= 3) unlockAchievement('ach_collector');
  };

  const handleSelectOwnedCar = (instanceId: string) => {
    const target = economy.ownedCars.find((c) => c.instanceId === instanceId && !c.impounded);
    if (!target) return;
    const spec = CAR_CATALOG.find((s) => s.id === target.specId);
    if (!spec) return;
    setEconomy((prev) => ({ ...prev, activeCarInstanceId: instanceId }));
    engineRef.current?.swapActiveCar(spec, target);
    setActiveModal(null);
  };

  const handleRedeemImpounded = (instanceId: string) => {
    const fee = 1500;
    if (economy.cash + economy.bank < fee) {
      engineRef.current?.showToast('Need $1,500 to pay Impound Release Fee');
      return;
    }
    spendFunds(fee);
    setEconomy((prev) => ({
      ...prev,
      ownedCars: prev.ownedCars.map((c) =>
        c.instanceId === instanceId ? { ...c, impounded: false, condition: 100 } : c
      ),
    }));
    soundRef.current?.playChime('cash');
    engineRef.current?.showToast('Impounded Vehicle Redeemed & Ready!');
  };

  const handleUpgradePart = (part: keyof CarUpgrades, cost: number) => {
    if (economy.cash + economy.bank < cost) return;
    spendFunds(cost);
    setEconomy((prev) => {
      const nextCars = prev.ownedCars.map((c) =>
        c.instanceId !== prev.activeCarInstanceId
          ? c
          : {
              ...c,
              upgrades: {
                ...c.upgrades,
                [part]: Math.min(4, c.upgrades[part] + 1),
              },
            }
      );
      const updated = nextCars.find((c) => c.instanceId === prev.activeCarInstanceId);
      if (updated) engineRef.current?.syncOwnedCarState(updated);
      return { ...prev, ownedCars: nextCars };
    });
    soundRef.current?.playChime('cash');
  };

  const handleCustomize = (custom: Partial<CarCustomization>, cost: number) => {
    if (economy.cash + economy.bank < cost) return;
    spendFunds(cost);
    setEconomy((prev) => {
      const nextCars = prev.ownedCars.map((c) =>
        c.instanceId !== prev.activeCarInstanceId
          ? c
          : {
              ...c,
              customization: { ...c.customization, ...custom },
            }
      );
      const updated = nextCars.find((c) => c.instanceId === prev.activeCarInstanceId);
      if (updated) engineRef.current?.syncOwnedCarState(updated);
      return { ...prev, ownedCars: nextCars };
    });
  };

  const handleRepairAndService = (cost: number) => {
    if (economy.cash + economy.bank < cost) return;
    spendFunds(cost);
    setEconomy((prev) => {
      const nextCars = prev.ownedCars.map((c) =>
        c.instanceId !== prev.activeCarInstanceId
          ? c
          : { ...c, condition: 100, tireHealth: 100, oilHealth: 100 }
      );
      const updated = nextCars.find((c) => c.instanceId === prev.activeCarInstanceId);
      if (updated) engineRef.current?.syncOwnedCarState(updated);
      return { ...prev, ownedCars: nextCars };
    });
    soundRef.current?.playChime('cash');
  };

  const handleRefuel = (cost: number) => {
    if (economy.cash + economy.bank < cost) return;
    spendFunds(cost);
    setEconomy((prev) => {
      const nextCars = prev.ownedCars.map((c) =>
        c.instanceId !== prev.activeCarInstanceId ? c : { ...c, fuel: 100 }
      );
      const updated = nextCars.find((c) => c.instanceId === prev.activeCarInstanceId);
      if (updated) engineRef.current?.syncOwnedCarState(updated);
      return { ...prev, ownedCars: nextCars };
    });
    engineRef.current?.showToast('Tank Filled to 100%');
  };

  const handleQuickRepair = (cost: number) => {
    if (economy.cash + economy.bank < cost) return;
    spendFunds(cost);
    setEconomy((prev) => {
      const nextCars = prev.ownedCars.map((c) =>
        c.instanceId !== prev.activeCarInstanceId ? c : { ...c, condition: 100 }
      );
      const updated = nextCars.find((c) => c.instanceId === prev.activeCarInstanceId);
      if (updated) engineRef.current?.syncOwnedCarState(updated);
      return { ...prev, ownedCars: nextCars };
    });
    engineRef.current?.showToast('Body & Engine Restored to 100%');
  };

  const handleStartRace = (race: RaceEvent) => {
    if (economy.cash + economy.bank < race.entryFee) return;
    spendFunds(race.entryFee);
    setRaceResult(null);
    engineRef.current?.startRace(race);
  };

  const handleBuyProperty = (prop: PropertyAsset) => {
    if (
      economy.cash + economy.bank < prop.price ||
      economy.ownedPropertyIds.includes(prop.id)
    ) {
      return;
    }
    spendFunds(prop.price);
    setEconomy((prev) => ({
      ...prev,
      ownedPropertyIds: [...prev.ownedPropertyIds, prop.id],
    }));
    soundRef.current?.playChime('cash');
    unlockAchievement('ach_empire');
  };

  const handleDeposit = (amount: number) => {
    setEconomy((prev) => {
      const amt = Math.min(prev.cash, Math.max(0, amount));
      return { ...prev, cash: prev.cash - amt, bank: prev.bank + amt };
    });
  };

  const handleWithdraw = (amount: number) => {
    setEconomy((prev) => {
      const amt = Math.min(prev.bank, Math.max(0, amount));
      return { ...prev, cash: prev.cash + amt, bank: prev.bank - amt };
    });
  };

  const handleFastTravel = (lm: WorldLandmark) => {
    engineRef.current?.teleportTo(lm.x, lm.z + 10, 0);
    if (roomInfo) {
      const snap = engineRef.current?.getPlayerSnapshot();
      if (snap) mpClientRef.current?.sendState({ ...snap, fastTravel: true });
    }
    engineRef.current?.showToast(`Arrived at ${lm.name}`);
  };

  // --- Police Stop Legal Resolution Handlers ---
  const handlePolicePayFine = (fine: number) => {
    if (!policeStop) return;
    spendFunds(fine);
    setEconomy((prev) => ({
      ...prev,
      policeRecord: {
        ...prev.policeRecord,
        busts: prev.policeRecord.busts + 1,
        totalFinesPaid: prev.policeRecord.totalFinesPaid + fine,
        offenseHistory: [
          {
            id: `off_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            charges: policeStop.charges,
            fine,
            outcome: 'paid',
            notes: `Settled citation with ${policeStop.officerName}. No jail sentence recorded.`,
          },
          ...prev.policeRecord.offenseHistory.slice(0, 19),
        ],
      },
    }));
    setPoliceStop(null);
    engineRef.current?.resolvePoliceStop();
    engineRef.current?.showToast(
      `Citation Paid (-$${fine.toLocaleString()}). Police Bust #${policeStop.nextBustCount} logged.`
    );
  };

  const handlePoliceServeJail = (reducedFine: number) => {
    if (!policeStop) return;
    if (reducedFine > 0) spendFunds(reducedFine);
    setEconomy((prev) => ({
      ...prev,
      policeRecord: {
        ...prev.policeRecord,
        busts: prev.policeRecord.busts + 1,
        jailSentences: prev.policeRecord.jailSentences + 1,
        totalFinesPaid: prev.policeRecord.totalFinesPaid + reducedFine,
        offenseHistory: [
          {
            id: `off_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            charges: policeStop.charges,
            fine: reducedFine,
            outcome: 'jailed',
            notes: `Served precinct detention (${
              policeStop.isThirdJailEscalation ? '3+ Habitual Escalation' : 'Standard'
            }).`,
          },
          ...prev.policeRecord.offenseHistory.slice(0, 19),
        ],
      },
    }));
    setPoliceStop(null);
    engineRef.current?.resolvePoliceStop();
    engineRef.current?.teleportTo(-80, -96, 0);
    engineRef.current?.showToast(
      `Released from JCF Central Station (Jail Sentence #${policeStop.nextJailCount} recorded separately).`
    );
  };

  const handlePoliceAppeal = (): { dismissed: boolean; newFine: number; note: string } => {
    if (!policeStop) return { dismissed: false, newFine: 0, note: '' };
    if (economy.reputation >= 1200 && policeStop.wantedLevel === 1) {
      setEconomy((prev) => ({
        ...prev,
        policeRecord: {
          ...prev.policeRecord,
          offenseHistory: [
            {
              id: `off_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              charges: policeStop.charges,
              fine: 0,
              outcome: 'dismissed',
              notes: 'Citation dismissed on review due to high Street King standing.',
            },
            ...prev.policeRecord.offenseHistory.slice(0, 19),
          ],
        },
      }));
      setPoliceStop(null);
      engineRef.current?.resolvePoliceStop();
      engineRef.current?.showToast('Citation Dismissed on Legal Review!');
      return { dismissed: true, newFine: 0, note: 'Citation dismissed!' };
    }
    if (economy.reputation >= 350 || policeStop.charges.length <= 2) {
      const reduced = Math.round(policeStop.escalatedFine * 0.65);
      return {
        dismissed: false,
        newFine: reduced,
        note: `Traffic magistrate reduced fine by 35% to $${reduced.toLocaleString()} after reviewing dashcam telemetry.`,
      };
    }
    return {
      dismissed: false,
      newFine: policeStop.escalatedFine,
      note: 'Review denied: prior driving infractions upheld the full citation.',
    };
  };

  const handlePoliceConfiscate = () => {
    if (!policeStop) return;
    const confiscatedId = activeCar.instanceId;
    const otherAvailable = economy.ownedCars.find(
      (c) => c.instanceId !== confiscatedId && !c.impounded
    );

    let nextCars = economy.ownedCars.map((c) =>
      c.instanceId === confiscatedId ? { ...c, impounded: true } : c
    );
    let nextActive = otherAvailable;

    if (!nextActive) {
      // Provide emergency street loaner so player is never soft-locked
      const loanerSpec = CAR_CATALOG[0];
      const loaner: OwnedCar = {
        instanceId: `car_loaner_${Date.now()}`,
        specId: loanerSpec.id,
        upgrades: { engine: 1, turbo: 1, tires: 1, suspension: 1, brakes: 1, transmission: 1 },
        customization: {
          paintColor: '#71717a',
          finish: 'matte',
          rimColor: '#e4e4e7',
          spoiler: false,
          underglowColor: null,
        },
        condition: 100,
        fuel: 100,
        tireHealth: 100,
        oilHealth: 100,
        mileageKm: 0,
      };
      nextCars = [...nextCars, loaner];
      nextActive = loaner;
    }

    const nextSpec = CAR_CATALOG.find((s) => s.id === nextActive!.specId) || CAR_CATALOG[0];

    setEconomy((prev) => ({
      ...prev,
      ownedCars: nextCars,
      activeCarInstanceId: nextActive!.instanceId,
      policeRecord: {
        ...prev.policeRecord,
        busts: prev.policeRecord.busts + 1,
        confiscationsCount: prev.policeRecord.confiscationsCount + 1,
        offenseHistory: [
          {
            id: `off_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            charges: policeStop.charges,
            fine: 0,
            outcome: 'confiscated',
            notes: `${activeSpec.name} impounded at Bust #${policeStop.nextBustCount}. Redeemable in Smartphone -> Garage for $1,500.`,
          },
          ...prev.policeRecord.offenseHistory.slice(0, 19),
        ],
      },
    }));

    setPoliceStop(null);
    engineRef.current?.resolvePoliceStop();
    engineRef.current?.swapActiveCar(nextSpec, nextActive);
    engineRef.current?.teleportTo(-80, -96, 0);
    engineRef.current?.showToast(
      `Vehicle Confiscated to Impound! Redeem it from Phone → Garage for $1,500.`,
      4.5
    );
  };

  // --- Radio & Music Search Controls ---
  const handleToggleRadioPlay = () => {
    soundRef.current?.ensureInit();
    setRadioPlaying((p) => !p);
  };

  const handleSelectStation = (stationId: string) => {
    soundRef.current?.ensureInit();
    setActiveStationId(stationId);
    setActiveTrackIndex(0);
    setRadioPlaying(true);
  };

  const handlePrevTrack = () => {
    soundRef.current?.ensureInit();
    const len = activeStation.tracks.length;
    setActiveTrackIndex((i) => (i - 1 + len) % len);
    setRadioPlaying(true);
  };

  const handleNextTrack = () => {
    soundRef.current?.ensureInit();
    const len = activeStation.tracks.length;
    setActiveTrackIndex((i) => (i + 1) % len);
    setRadioPlaying(true);
  };

  const handleAddYouTubeTrack = (track: RadioTrack, playNow = true) => {
    soundRef.current?.ensureInit();
    setStations((prev) =>
      prev.map((st) => {
        if (st.id !== 'st_youtube') return st;
        const existingIdx = st.tracks.findIndex((t) => t.id === track.id);
        if (existingIdx >= 0) {
          if (playNow) {
            setActiveStationId('st_youtube');
            setActiveTrackIndex(existingIdx);
            setRadioPlaying(true);
          }
          return st;
        }
        const updatedTracks = [...st.tracks, track];
        if (playNow) {
          setActiveStationId('st_youtube');
          setActiveTrackIndex(updatedTracks.length - 1);
          setRadioPlaying(true);
        }
        return { ...st, tracks: updatedTracks };
      })
    );
  };

  const handleRemoveYouTubeTrack = (trackId: string) => {
    setStations((prev) =>
      prev.map((st) => {
        if (st.id !== 'st_youtube') return st;
        const filtered = st.tracks.filter((t) => t.id !== trackId);
        setActiveTrackIndex(0);
        return { ...st, tracks: filtered };
      })
    );
  };

  const handleToggleFavoriteTrack = (track: RadioTrack) => {
    setEconomy((prev) => {
      const exists = prev.favoriteTracks.some((t) => t.id === track.id);
      return {
        ...prev,
        favoriteTracks: exists
          ? prev.favoriteTracks.filter((t) => t.id !== track.id)
          : [track, ...prev.favoriteTracks],
      };
    });
  };

  const handleTouchInput = useCallback((partial: Partial<InputState>) => {
    engineRef.current?.setTouchInput(partial);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Isolated Three.js WebGL Viewport */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0 h-full w-full" />

      {/* Cinematic Animated Loading Screen & Main Menu */}
      {showMainMenu && (
        <MainMenuOverlay
          playerName={economy.character.name}
          cash={economy.cash}
          bank={economy.bank}
          reputation={economy.reputation}
          ownedCarCount={economy.ownedCars.length}
          onDriveNow={() => {
            soundRef.current?.ensureInit();
            setShowMainMenu(false);
          }}
          onOpenMultiplayer={() => {
            setPhoneInitialApp('multiplayer');
            setActiveModal('phone');
          }}
          onOpenGarage={() => setActiveModal('garage')}
          onOpenSettings={() => {
            setPhoneInitialApp('settings');
            setActiveModal('phone');
          }}
        />
      )}

      {/* Live Driving & Exploration HUD */}
      {!showMainMenu && (
        <DrivingHud
          telemetry={telemetry}
          economy={economy}
          activeSpec={activeSpec}
          activeCar={activeCar}
          station={activeStation}
          track={activeTrack}
          radioPlaying={radioPlaying}
          playingOnPhone={playingOnPhone}
          sfxMuted={sfxMuted}
          adminUnlocked={adminUnlocked}
          roomInfo={roomInfo}
          remotePlayerCount={remotePlayers.filter((p) => p.playerId !== playerId).length}
          onToggleRadioPlay={handleToggleRadioPlay}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          onStopPhoneMusic={() => {
            setPlayingOnPhone(false);
            setRadioPlaying(false);
          }}
          onToggleSfxMute={() => {
            const next = !sfxMuted;
            setSfxMuted(next);
            soundRef.current?.setSfxMuted(next);
          }}
          onCycleCamera={() => engineRef.current?.cycleCamera()}
          onToggleEnterExit={() => engineRef.current?.toggleEnterExitVehicle()}
          onResetVehicle={() => engineRef.current?.resetVehicle()}
          onInteractPrompt={() => engineRef.current?.handleInteractOrToggleVehicle()}
          onTouchInput={handleTouchInput}
          onSetGpsToMeet={() => {
            if (roomInfo?.carMeet) {
              engineRef.current?.setGpsTarget(
                roomInfo.carMeet.x,
                roomInfo.carMeet.z,
                `Meet: ${roomInfo.carMeet.label}`
              );
            }
          }}
          onOpenModal={(m) => {
            if (m === 'phone') setPhoneInitialApp('home');
            if (m === 'map') setMapInitialTab('city');
            setActiveModal(m);
          }}
          onAbortRace={() => engineRef.current?.abortRace()}
        />
      )}

      {/* Interactive Police Confrontation Modal */}
      {policeStop && (
        <PoliceModal
          stopEvent={policeStop}
          economy={economy}
          activeCar={activeCar}
          onPayFine={handlePolicePayFine}
          onServeJail={handlePoliceServeJail}
          onAppealCharges={handlePoliceAppeal}
          onConfiscateVehicle={handlePoliceConfiscate}
        />
      )}

      {/* Race Finish Podium Summary */}
      {raceResult && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/40 bg-zinc-950 p-6 text-center shadow-2xl">
            <Trophy className="mx-auto h-10 w-10 text-amber-400" />
            <h2 className="mt-2 font-display text-2xl font-bold text-white">
              {raceResult.raceName} Complete
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Finished in{' '}
              <strong className="text-amber-400">
                #{raceResult.resultPlace} of {raceResult.totalRacers}
              </strong>{' '}
              · Time {raceResult.elapsedSec.toFixed(1)}s
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-zinc-900/70 p-4 font-telemetry">
              <div>
                <div className="text-[11px] text-zinc-400">PRIZE MONEY</div>
                <div className="text-lg font-bold text-emerald-400">
                  +${(raceResult.prizeWon || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">REPUTATION</div>
                <div className="text-lg font-bold text-amber-300">
                  +{raceResult.repWon || 0} REP
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRaceResult(null)}
              className="mt-5 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 cursor-pointer"
            >
              Back to Free Roam
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {activeModal === 'phone' && (
        <SmartphoneModal
          initialApp={phoneInitialApp}
          economy={economy}
          telemetry={telemetry}
          station={activeStation}
          track={activeTrack}
          radioPlaying={radioPlaying}
          playingOnPhone={playingOnPhone}
          wsConnected={wsConnected}
          playerId={playerId}
          roomInfo={roomInfo}
          remotePlayers={remotePlayers}
          roomChat={roomChat}
          incomingTrade={incomingTrade}
          onClose={() => setActiveModal(null)}
          onSetGps={(x, z, label) => engineRef.current?.setGpsTarget(x, z, label)}
          onClearGps={() => engineRef.current?.clearGpsTarget()}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onSelectOwnedCar={handleSelectOwnedCar}
          onRedeemImpounded={handleRedeemImpounded}
          onStartJob={(job: JobDefinition) => engineRef.current?.startJob(job)}
          onOpenModalShortcut={(m) => {
            if (m === 'map_real') {
              setMapInitialTab('google');
              setActiveModal('map');
            } else {
              setActiveModal(m);
            }
          }}
          onToggleRadioPlay={handleToggleRadioPlay}
          onNextTrack={handleNextTrack}
          onSetPlayingOnPhone={(enabled) => {
            setPlayingOnPhone(enabled);
            if (enabled) {
              soundRef.current?.ensureInit();
            } else if (telemetry.playerMode !== 'driving') {
              setRadioPlaying(false);
            }
          }}
          onPostSocial={(content) =>
            setEconomy((prev) => ({
              ...prev,
              socialPosts: [
                {
                  id: `soc_${Date.now()}`,
                  author: prev.character.name,
                  handle: `@${prev.character.name.toLowerCase().replace(/\s+/g, '_')}`,
                  content,
                  likes: 1,
                  time: 'Just now',
                },
                ...prev.socialPosts,
              ],
            }))
          }
          onLikeSocial={(postId) =>
            setEconomy((prev) => ({
              ...prev,
              socialPosts: prev.socialPosts.map((p) =>
                p.id === postId ? { ...p, likes: p.likes + 1 } : p
              ),
            }))
          }
          onMarkMessagesRead={() =>
            setEconomy((prev) => ({
              ...prev,
              messages: prev.messages.map((m) => ({ ...m, unread: false })),
            }))
          }
          onUpdateGraphics={(next) => {
            setEconomy((prev) => ({ ...prev, graphicsSettings: next }));
            engineRef.current?.applyGraphicsSettings(next);
          }}
          onUpdateProfile={(name, jacketColor) => {
            setEconomy((prev) => ({
              ...prev,
              character: { ...prev.character, name, jacketColor },
            }));
            engineRef.current?.showToast(`Profile updated: ${name}`);
          }}
          onManualSave={() => {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(economy));
              engineRef.current?.showToast('Game Progress Saved!');
            } catch {
              // ignore
            }
          }}
          onCreateRoom={(roomName, isPublic) => {
            const snap = engineRef.current?.getPlayerSnapshot();
            if (!snap) return;
            mpClientRef.current?.createRoom({
              name: economy.character.name,
              roomName,
              isPublic,
              x: snap.x,
              y: snap.y,
              z: snap.z,
              heading: snap.heading,
              specId: snap.specId,
              paintColor: snap.paintColor,
              finish: snap.finish,
              rimColor: snap.rimColor,
              spoiler: snap.spoiler,
              underglowColor: snap.underglowColor,
              cash: economy.cash,
            });
          }}
          onJoinRoom={(code) => {
            const snap = engineRef.current?.getPlayerSnapshot();
            if (!snap) return;
            mpClientRef.current?.joinRoom({
              code,
              name: economy.character.name,
              x: snap.x,
              y: snap.y,
              z: snap.z,
              heading: snap.heading,
              specId: snap.specId,
              paintColor: snap.paintColor,
              finish: snap.finish,
              rimColor: snap.rimColor,
              spoiler: snap.spoiler,
              underglowColor: snap.underglowColor,
              cash: economy.cash,
            });
          }}
          onLeaveRoom={() => mpClientRef.current?.leaveRoom()}
          onSendRoomChat={(text) => mpClientRef.current?.sendChat(text)}
          onAddFriend={(fid, fname) =>
            setEconomy((prev) => {
              if (prev.friends.some((f) => f.playerId === fid)) return prev;
              engineRef.current?.showToast(`Added ${fname} to Friends`);
              return { ...prev, friends: [...prev.friends, { playerId: fid, name: fname }] };
            })
          }
          onHostCarMeet={(label) => {
            const snap = engineRef.current?.getPlayerSnapshot();
            if (snap) mpClientRef.current?.hostCarMeet(snap.x, snap.z, label);
          }}
          onStartRoomRace={(race) => {
            mpClientRef.current?.startRoomRace(race.id, race.name);
            engineRef.current?.startRace(race);
          }}
          onSendTradeOffer={(toId, offerCash, requestCash) => {
            if (offerCash > economy.cash) {
              engineRef.current?.showToast('Insufficient wallet cash for offer');
              return;
            }
            mpClientRef.current?.sendTradeOffer(toId, offerCash, requestCash);
            engineRef.current?.showToast('Escrow trade offer sent!');
          }}
          onRespondTrade={(tradeId, accept) => {
            mpClientRef.current?.respondTrade(tradeId, accept);
            setIncomingTrade(null);
          }}
        />
      )}

      {activeModal === 'map' && (
        <WorldMapModal
          telemetry={telemetry}
          remotePlayers={remotePlayers}
          discoveredHiddenIds={economy.discoveredLandmarkIds}
          initialTab={mapInitialTab}
          onClose={() => setActiveModal(null)}
          onSetGps={(x, z, label) => engineRef.current?.setGpsTarget(x, z, label)}
          onFastTravel={handleFastTravel}
        />
      )}

      {activeModal === 'copilot' && (
        <GeminiCopilotModal
          economy={economy}
          telemetry={telemetry}
          activeSpec={activeSpec}
          activeCar={activeCar}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'dealership' && (
        <DealershipModal
          economy={economy}
          onClose={() => setActiveModal(null)}
          onBuyCar={handleBuyCar}
          onSelectOwnedCar={handleSelectOwnedCar}
        />
      )}

      {activeModal === 'garage' && (
        <GarageModal
          economy={economy}
          activeSpec={activeSpec}
          activeCar={activeCar}
          onClose={() => setActiveModal(null)}
          onUpgradePart={handleUpgradePart}
          onCustomize={handleCustomize}
          onRepairAndService={handleRepairAndService}
        />
      )}

      {activeModal === 'races' && (
        <RaceHubModal
          economy={economy}
          onClose={() => setActiveModal(null)}
          onStartRace={handleStartRace}
        />
      )}

      {activeModal === 'empire' && (
        <EmpireModal
          economy={economy}
          onClose={() => setActiveModal(null)}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onBuyProperty={handleBuyProperty}
          onStartJob={(job: JobDefinition) => engineRef.current?.startJob(job)}
        />
      )}

      {activeModal === 'gas' && (
        <GasStationModal
          economy={economy}
          activeCar={activeCar}
          onClose={() => setActiveModal(null)}
          onRefuel={handleRefuel}
          onQuickRepair={handleQuickRepair}
        />
      )}

      {activeModal === 'controls' && (
        <ControlsModal onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'admin' && (
        <AdminModal
          unlocked={adminUnlocked}
          verifiedCode={verifiedAdminCode}
          overrides={adminOverrides}
          economy={economy}
          telemetry={telemetry}
          roomInfo={roomInfo}
          remotePlayers={remotePlayers}
          playerId={playerId}
          onUnlock={(code) => {
            setVerifiedAdminCode(code);
            setAdminUnlocked(true);
            engineRef.current?.showToast('Master Admin Controls Unlocked!', 3.0);
          }}
          onLock={() => {
            setAdminUnlocked(false);
            setVerifiedAdminCode('');
          }}
          onClose={() => setActiveModal(null)}
          onUpdateOverrides={(next) => {
            setAdminOverrides(next);
            engineRef.current?.setAdminOverrides(next);
          }}
          onGrantCash={(amount) => {
            setEconomy((prev) => ({ ...prev, cash: Math.max(0, prev.cash + amount) }));
            soundRef.current?.playChime('cash');
          }}
          onGrantBank={(amount) => {
            setEconomy((prev) => ({ ...prev, bank: Math.max(0, prev.bank + amount) }));
            soundRef.current?.playChime('cash');
          }}
          onAddRep={(amount) => {
            setEconomy((prev) => ({ ...prev, reputation: Math.max(0, prev.reputation + amount) }));
          }}
          onUnlockAllCars={() => {
            setEconomy((prev) => {
              const existingIds = new Set(prev.ownedCars.map((c) => c.specId));
              const additions: OwnedCar[] = CAR_CATALOG.filter((s) => !existingIds.has(s.id)).map(
                (spec, idx) => ({
                  instanceId: `car_admin_${spec.id}_${Date.now()}_${idx}`,
                  specId: spec.id,
                  upgrades: {
                    engine: 2,
                    turbo: 2,
                    tires: 2,
                    suspension: 2,
                    brakes: 2,
                    transmission: 2,
                  },
                  customization: {
                    paintColor: spec.defaultColor,
                    finish: 'metallic',
                    rimColor: '#e4e4e7',
                    spoiler: spec.bodyStyle !== 'offroad',
                    underglowColor: '#06b6d4',
                  },
                  condition: 100,
                  fuel: 100,
                  tireHealth: 100,
                  oilHealth: 100,
                  mileageKm: 0,
                })
              );
              return { ...prev, ownedCars: [...prev.ownedCars, ...additions] };
            });
          }}
          onUnlockAllProperties={() => {
            setEconomy((prev) => ({
              ...prev,
              ownedPropertyIds: PROPERTIES_CATALOG.map((p) => p.id),
            }));
          }}
          onUnlockAllAchievements={() => {
            setEconomy((prev) => ({
              ...prev,
              achievements: ACHIEVEMENTS_CATALOG.map((a) => a.id),
            }));
          }}
          onMaxUpgradeActiveCar={() => {
            setEconomy((prev) => {
              const nextCars = prev.ownedCars.map((c) =>
                c.instanceId !== prev.activeCarInstanceId
                  ? c
                  : {
                      ...c,
                      upgrades: {
                        engine: 4,
                        turbo: 4,
                        tires: 4,
                        suspension: 4,
                        brakes: 4,
                        transmission: 4,
                      },
                    }
              );
              const updated = nextCars.find((c) => c.instanceId === prev.activeCarInstanceId);
              if (updated) engineRef.current?.syncOwnedCarState(updated);
              return { ...prev, ownedCars: nextCars };
            });
          }}
          onRepairRefuelActiveCar={() => {
            setEconomy((prev) => {
              const nextCars = prev.ownedCars.map((c) =>
                c.instanceId !== prev.activeCarInstanceId
                  ? c
                  : { ...c, condition: 100, fuel: 100, tireHealth: 100, oilHealth: 100 }
              );
              const updated = nextCars.find((c) => c.instanceId === prev.activeCarInstanceId);
              if (updated) engineRef.current?.syncOwnedCarState(updated);
              return { ...prev, ownedCars: nextCars };
            });
          }}
          onClearPoliceRecord={() => {
            setPoliceStop(null);
            engineRef.current?.resolvePoliceStop();
            setEconomy((prev) => ({
              ...prev,
              ownedCars: prev.ownedCars.map((c) => ({ ...c, impounded: false })),
              policeRecord: {
                busts: 0,
                jailSentences: 0,
                totalFinesPaid: 0,
                confiscationsCount: 0,
                offenseHistory: [],
              },
            }));
          }}
          onSpawnAndDriveCar={(spec) => {
            const existing = economy.ownedCars.find(
              (c) => c.specId === spec.id && !c.impounded
            );
            if (existing) {
              setEconomy((prev) => ({ ...prev, activeCarInstanceId: existing.instanceId }));
              engineRef.current?.swapActiveCar(spec, existing);
              return;
            }
            const spawned: OwnedCar = {
              instanceId: `car_spawn_${spec.id}_${Date.now()}`,
              specId: spec.id,
              upgrades: {
                engine: 3,
                turbo: 3,
                tires: 3,
                suspension: 3,
                brakes: 3,
                transmission: 3,
              },
              customization: {
                paintColor: spec.defaultColor,
                finish: 'metallic',
                rimColor: '#e4e4e7',
                spoiler: spec.bodyStyle !== 'offroad',
                underglowColor: '#06b6d4',
              },
              condition: 100,
              fuel: 100,
              tireHealth: 100,
              oilHealth: 100,
              mileageKm: 0,
            };
            setEconomy((prev) => ({
              ...prev,
              ownedCars: [...prev.ownedCars, spawned],
              activeCarInstanceId: spawned.instanceId,
            }));
            engineRef.current?.swapActiveCar(spec, spawned);
          }}
          onSetWeatherAndTime={(weather, timeOfDay) => {
            setEconomy((prev) => {
              const nextGraphics: GraphicsSettings = {
                ...prev.graphicsSettings,
                weather,
                timeOfDay,
              };
              engineRef.current?.applyGraphicsSettings(nextGraphics);
              return { ...prev, graphicsSettings: nextGraphics };
            });
          }}
          onSetClockHour={(hour) => engineRef.current?.setAdminClockHour(hour)}
          onSetWantedLevel={(lvl) => engineRef.current?.setAdminWantedLevel(lvl)}
          onTriggerWorldEvent={() => engineRef.current?.triggerAdminWorldEvent()}
          onTestPoliceStop={() => engineRef.current?.testPoliceStop()}
          onTeleportCoords={(x, z, label) => {
            engineRef.current?.teleportTo(x, z, 0);
            if (roomInfo) {
              const snap = engineRef.current?.getPlayerSnapshot();
              if (snap) mpClientRef.current?.sendState({ ...snap, fastTravel: true });
            }
            engineRef.current?.showToast(`Teleported to ${label || `(${x}, ${z})`}`);
          }}
          onTeleportLandmark={handleFastTravel}
          onAdminRoomAnnounce={(text) =>
            mpClientRef.current?.sendAdminAnnounce(verifiedAdminCode, text)
          }
          onAdminRoomWeatherSync={(weather, timeOfDay) =>
            mpClientRef.current?.sendAdminWeather(verifiedAdminCode, weather, timeOfDay)
          }
          onAdminKickPlayer={(targetPlayerId) =>
            mpClientRef.current?.sendAdminKick(verifiedAdminCode, targetPlayerId)
          }
        />
      )}

      {/* Keep RadioModal mounted so YouTube iframe & full song playback continue smoothly */}
      <RadioModal
        open={activeModal === 'radio'}
        stations={stations}
        activeStationId={activeStationId}
        activeTrackIndex={activeTrackIndex}
        isPlaying={radioPlaying}
        volume={radioVolume}
        favorites={economy.favoriteTracks}
        playerMode={telemetry.playerMode}
        playingOnPhone={playingOnPhone}
        onSetPlayingOnPhone={(enabled) => {
          setPlayingOnPhone(enabled);
          if (enabled) {
            soundRef.current?.ensureInit();
          } else if (telemetry.playerMode !== 'driving') {
            setRadioPlaying(false);
          }
        }}
        onClose={() => setActiveModal(null)}
        onSelectStation={handleSelectStation}
        onSelectTrack={(idx) => {
          soundRef.current?.ensureInit();
          setActiveTrackIndex(idx);
          setRadioPlaying(true);
        }}
        onTogglePlay={handleToggleRadioPlay}
        onPrevTrack={handlePrevTrack}
        onNextTrack={handleNextTrack}
        onVolumeChange={setRadioVolume}
        onAddYouTubeTrack={handleAddYouTubeTrack}
        onRemoveYouTubeTrack={handleRemoveYouTubeTrack}
        onToggleFavorite={handleToggleFavoriteTrack}
        onPlayExternalTrack={(t) => handleAddYouTubeTrack(t, true)}
      />
    </div>
  );
}
