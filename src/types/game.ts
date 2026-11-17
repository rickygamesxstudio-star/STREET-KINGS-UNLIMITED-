export type CameraMode = 'chase' | 'far' | 'cockpit' | 'hood';

export type PlayerMode = 'driving' | 'walking';

export type CarBodyStyle = 'coupe' | 'muscle' | 'supercar' | 'offroad' | 'jdm' | 'sedan';

export type PaintFinish = 'gloss' | 'metallic' | 'matte';

export type WeatherMode = 'clear' | 'overcast' | 'rain' | 'fog';

export type TimeOfDayMode = 'auto' | 'dawn' | 'noon' | 'sunset' | 'midnight';

export type GraphicsPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  shadows: boolean;
  bloom: boolean;
  weatherEffects: boolean;
  trafficDensity: 'low' | 'normal' | 'high';
  weather: WeatherMode;
  timeOfDay: TimeOfDayMode;
}

export interface CarUpgrades {
  engine: number; // 1..4
  turbo: number; // 1..4
  tires: number; // 1..4
  suspension: number; // 1..4
  brakes: number; // 1..4
  transmission: number; // 1..4
}

export interface CarCustomization {
  paintColor: string;
  finish: PaintFinish;
  rimColor: string;
  spoiler: boolean;
  underglowColor: string | null;
}

export interface CarSpec {
  id: string;
  name: string;
  brand: string;
  category: string;
  bodyStyle: CarBodyStyle;
  price: number;
  repRequired: number;
  baseSpeedKmh: number;
  baseAccel: number;
  baseHandling: number;
  baseDrift: number;
  offroadRating: number;
  defaultColor: string;
  width: number;
  length: number;
  height: number;
  clearance: number;
  description: string;
}

export interface OwnedCar {
  instanceId: string;
  specId: string;
  upgrades: CarUpgrades;
  customization: CarCustomization;
  condition: number; // 0..100
  fuel: number; // 0..100
  tireHealth: number; // 0..100
  oilHealth: number; // 0..100
  mileageKm: number;
  impounded?: boolean;
}

export type LandmarkType =
  | 'dealership'
  | 'garage'
  | 'gas'
  | 'bank'
  | 'race'
  | 'property'
  | 'job'
  | 'police'
  | 'airport'
  | 'hidden';

export interface WorldLandmark {
  id: string;
  name: string;
  type: LandmarkType;
  district: string;
  x: number;
  z: number;
  color: string;
  description: string;
  raceId?: string;
  propertyId?: string;
  hiddenRewardCash?: number;
  hiddenRewardRep?: number;
}

export type RaceType =
  | 'street'
  | 'drag'
  | 'circuit'
  | 'drift'
  | 'offroad'
  | 'championship';

export interface RaceWaypoint {
  x: number;
  z: number;
}

export interface RaceEvent {
  id: string;
  name: string;
  type: RaceType;
  district: string;
  laps: number;
  entryFee: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeThird: number;
  repReward: number;
  repRequired: number;
  opponents: number;
  targetDriftScore?: number;
  startHeading: number;
  waypoints: RaceWaypoint[];
  description: string;
}

export interface PropertyAsset {
  id: string;
  name: string;
  kind: 'property' | 'business';
  district: string;
  price: number;
  incomePerMinute: number;
  x: number;
  z: number;
  description: string;
}

export interface JobDefinition {
  id: string;
  title: string;
  category: 'Delivery' | 'VIP Chauffeur' | 'Street Bounty' | 'Roadside Rescue';
  payout: number;
  repReward: number;
  timeLimitSec: number;
  pickup: { x: number; z: number; label: string };
  dropoff: { x: number; z: number; label: string };
  description: string;
}

export type RadioGenre =
  | 'reggae'
  | 'dancehall'
  | 'rnb'
  | 'hiphop'
  | 'afrobeats'
  | 'youtube'
  | 'preview';

export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  durationSec: number;
  youtubeId?: string;
  youtubePlaylistId?: string;
  youtubeUrl?: string;
  previewUrl?: string;
  thumbnail?: string;
}

export interface RadioStation {
  id: string;
  name: string;
  frequency: string;
  genre: RadioGenre;
  accentColor: string;
  tracks: RadioTrack[];
}

export interface ActiveRaceState {
  raceId: string;
  raceName: string;
  type: RaceType;
  countdown: number;
  active: boolean;
  finished: boolean;
  lap: number;
  totalLaps: number;
  checkpointIndex: number;
  totalCheckpoints: number;
  position: number;
  totalRacers: number;
  elapsedSec: number;
  driftScore: number;
  targetDriftScore?: number;
  resultPlace?: number;
  prizeWon?: number;
  repWon?: number;
}

export interface ActiveJobState {
  jobId: string;
  title: string;
  stage: 'pickup' | 'dropoff';
  targetLabel: string;
  targetX: number;
  targetZ: number;
  remainingSec: number;
  payout: number;
  repReward: number;
}

export interface RandomWorldEvent {
  id: string;
  title: string;
  description: string;
  x: number;
  z: number;
  rewardCash: number;
  rewardRep: number;
  remainingSec: number;
}

export interface MinimapEntity {
  x: number;
  z: number;
  kind: 'traffic' | 'police' | 'ambulance' | 'racer' | 'landmark' | 'remotePlayer';
  color?: string;
  label?: string;
}

export interface TrafficLightState {
  x: number;
  z: number;
  nsGreen: boolean;
  amber: boolean;
}

export interface HudTelemetry {
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: string;
  nitro: number;
  isDrifting: boolean;
  currentDriftPoints: number;
  playerMode: PlayerMode;
  cameraMode: CameraMode;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerHeading: number;
  surface: 'asphalt' | 'dirt' | 'sand' | 'grass';
  wantedLevel: number;
  wantedCooldownPct: number;
  bustProgressPct: number;
  nearbyPrompt: {
    label: string;
    actionType: 'vehicle' | LandmarkType;
    landmarkId?: string;
  } | null;
  gpsTarget: { x: number; z: number; label: string; routePoints?: Array<{ x: number; z: number }> } | null;
  activeRace: ActiveRaceState | null;
  activeJob: ActiveJobState | null;
  activeRandomEvent: RandomWorldEvent | null;
  minimapEntities: MinimapEntity[];
  clockHour: number; // 0..24
  weather: WeatherMode;
  toastMessage: string | null;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  nitro: boolean;
  horn: boolean;
}

export interface PoliceOffenseLog {
  id: string;
  timestamp: string;
  charges: string[];
  fine: number;
  outcome: 'paid' | 'jailed' | 'dismissed' | 'confiscated';
  notes: string;
}

export interface PoliceRecord {
  busts: number; // Tracked separately from jailSentences
  jailSentences: number; // Tracked separately from busts
  totalFinesPaid: number;
  confiscationsCount: number;
  offenseHistory: PoliceOffenseLog[];
}

export interface PoliceStopEvent {
  officerName: string;
  badgeNumber: string;
  wantedLevel: number;
  charges: string[];
  baseFine: number;
  escalatedFine: number;
  nextBustCount: number;
  nextJailCount: number;
  isThirdBustConfiscationRisk: boolean;
  isThirdJailEscalation: boolean;
}

export interface CharacterProfile {
  name: string;
  jacketColor: string;
  avatarTag: string;
}

export interface PhoneMessage {
  id: string;
  from: string;
  text: string;
  time: string;
  unread?: boolean;
}

export interface SocialPost {
  id: string;
  author: string;
  handle: string;
  content: string;
  likes: number;
  time: string;
}

export interface RemotePlayerState {
  playerId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  speedKmh: number;
  steerAngle: number;
  specId: string;
  paintColor: string;
  finish: string;
  rimColor: string;
  spoiler: boolean;
  underglowColor: string | null;
  isDrifting: boolean;
  nitroActive: boolean;
  hornActive: boolean;
  playerMode: 'driving' | 'walking';
}

export interface MultiplayerRoomInfo {
  code: string;
  name: string;
  isPublic: boolean;
  hostId: string;
  carMeet: { x: number; z: number; label: string; hostName: string } | null;
  race: {
    active: boolean;
    raceId: string;
    raceName: string;
    countdownEndsMs: number;
    finishedOrder: Array<{ playerId: string; name: string; elapsedMs: number }>;
  } | null;
}

export interface TradeOfferPayload {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  offerCash: number;
  requestCash: number;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

export interface PlayerEconomyState {
  cash: number;
  bank: number;
  reputation: number;
  ownedCars: OwnedCar[];
  activeCarInstanceId: string;
  ownedPropertyIds: string[];
  completedRaceIds: string[];
  championshipPoints: number;
  // Upgraded persistent fields (migrated non-destructively!)
  character: CharacterProfile;
  policeRecord: PoliceRecord;
  achievements: string[];
  discoveredLandmarkIds: string[];
  favoriteTracks: RadioTrack[];
  friends: Array<{ playerId: string; name: string }>;
  messages: PhoneMessage[];
  socialPosts: SocialPost[];
  graphicsSettings: GraphicsSettings;
}

export interface AdminOverrides {
  godMode: boolean;
  unlimitedNitroFuel: boolean;
  noPolice: boolean;
  trafficDisabled: boolean;
  freezeTime: boolean;
  speedMultiplier: number;
  accelMultiplier: number;
  gripMultiplier: number;
}

