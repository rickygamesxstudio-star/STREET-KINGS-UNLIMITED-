import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SoundEngine } from '../audio/SoundEngine';
import { CAR_CATALOG, computeRoadRoute, WORLD_LANDMARKS, WORLD_RADIUS } from '../data/worldData';
import {
  ActiveJobState,
  ActiveRaceState,
  AdminOverrides,
  CameraMode,
  CarCustomization,
  CarSpec,
  GraphicsSettings,
  HudTelemetry,
  InputState,
  JobDefinition,
  LandmarkType,
  MinimapEntity,
  OwnedCar,
  PlayerMode,
  RaceEvent,
  RandomWorldEvent,
  RemotePlayerState,
  WorldLandmark,
} from '../types/game';
import {
  buildCompositeCar,
  buildPlayerCharacter,
  CarVisualRig,
  CharacterVisualRig,
  createNameplateSprite,
} from './CarBuilder';
import { createProceduralTextures, ProceduralTextureSet } from './ProceduralTextures';
import {
  BuildingCollider,
  buildOpenWorld,
  getSurfaceType,
  groundHeightAt,
  TrafficLightRig,
} from './WorldBuilder';

export interface EngineCallbacks {
  onTelemetry: (telemetry: HudTelemetry) => void;
  onOpenLandmark: (type: LandmarkType, landmarkId: string) => void;
  onDriftBanked: (points: number, cashEarned: number, repEarned: number) => void;
  onRaceFinished: (result: ActiveRaceState) => void;
  onJobFinished: (success: boolean, payout: number, rep: number, title: string) => void;
  onPoliceStop: (charges: string[], wantedLevel: number) => void;
  onEscapedPolice: (repReward: number) => void;
  onConsumptionUpdate: (fuelDelta: number, conditionDelta: number, distanceKm: number) => void;
  onHiddenDiscovered: (landmark: WorldLandmark) => void;
  onRandomEventCompleted: (event: RandomWorldEvent) => void;
}

interface TrafficAgent {
  rig: CarVisualRig;
  x: number;
  z: number;
  heading: number;
  speed: number;
  baseSpeed: number;
  halfW: number;
  halfL: number;
  axis: 'x' | 'z';
  laneCoord: number;
  dir: 1 | -1;
  isAmbulance?: boolean;
  isPatrol?: boolean;
}

interface PedestrianAgent {
  rig: CharacterVisualRig;
  x: number;
  z: number;
  heading: number;
  speed: number;
  phase: number;
}

interface PoliceAgent {
  rig: CarVisualRig;
  x: number;
  z: number;
  heading: number;
  speed: number;
  halfW: number;
  halfL: number;
}

interface RacerAgent {
  rig: CarVisualRig;
  x: number;
  z: number;
  heading: number;
  speed: number;
  halfW: number;
  halfL: number;
  waypointIdx: number;
  lap: number;
  finished: boolean;
  progressScore: number;
}

interface RemotePeerVisual {
  rig: CarVisualRig;
  nameplate: THREE.Sprite;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetHeading: number;
  specId: string;
  paintColor: string;
  speedKmh: number;
  halfW: number;
  halfL: number;
}

interface ParticleItem {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _skyDay = new THREE.Color('#60a5fa');
const _skyDusk = new THREE.Color('#1a2338');
const _skyDawn = new THREE.Color('#fb923c');
const _skyNight = new THREE.Color('#090d1a');
const _skyFog = new THREE.Color('#64748b');
const _tmpColor = new THREE.Color();

export class DrivingEngine {
  private container: HTMLElement;
  private sound: SoundEngine;
  private callbacks: EngineCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextureSet;
  private isSoftwareGl = false;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private headSpotLight!: THREE.SpotLight;

  private colliders: BuildingCollider[] = [];
  private oceanMesh!: THREE.Mesh;
  private landmarkBeacons: THREE.Mesh[] = [];
  private roadMaterials: THREE.MeshStandardMaterial[] = [];
  private windowMaterials: THREE.MeshStandardMaterial[] = [];
  private streetLampMaterials: THREE.MeshStandardMaterial[] = [];
  private trafficLightRigs: TrafficLightRig[] = [];

  private rainPoints: THREE.Points | null = null;
  private gpsRouteLine: THREE.Line | null = null;
  private carMeetBeacon: THREE.Mesh | null = null;
  private randomEventBeacon: THREE.Group | null = null;

  private graphics: GraphicsSettings = {
    preset: 'high',
    shadows: true,
    bloom: true,
    weatherEffects: true,
    trafficDensity: 'normal',
    weather: 'clear',
    timeOfDay: 'sunset',
  };
  private clockHour = 18.2; // Starts at golden sunset

  // Player state
  private playerRig!: CarVisualRig;
  private activeSpec!: CarSpec;
  private activeOwned!: OwnedCar;
  private charRig!: CharacterVisualRig;
  private playerMode: PlayerMode = 'driving';
  private cameraMode: CameraMode = 'chase';

  // Car physics
  private carX = 0;
  private carZ = 24;
  private carHeading = 0;
  private velX = 0;
  private velZ = 0;
  private steerAngle = 0;
  private wheelSpin = 0;
  private nitro = 100;
  private currentDriftPoints = 0;
  private isDrifting = false;
  private driftGraceTimer = 0;
  private rpm = 900;
  private gear = 'N';
  private bodyPitch = 0;
  private bodyRoll = 0;

  // Walking physics
  private walkX = 4;
  private walkZ = 24;
  private walkHeading = 0;
  private walkAnimPhase = 0;

  private camPos = new THREE.Vector3(0, 5, 34);
  private camTarget = new THREE.Vector3(0, 1.5, 24);
  private currentFov = 62;

  private keyboardInput: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
    nitro: false,
    horn: false,
  };
  private touchInput: Partial<InputState> = {};

  private traffic: TrafficAgent[] = [];
  private pedestrians: PedestrianAgent[] = [];
  private police: PoliceAgent[] = [];
  private racers: RacerAgent[] = [];
  private remotePeers = new Map<string, RemotePeerVisual>();
  private particles: ParticleItem[] = [];
  private particleGeo = new THREE.SphereGeometry(0.32, 6, 6);

  private wantedLevel = 0;
  private wantedCooldown = 0;
  private bustTimer = 0;
  private policePaused = false;
  private pendingCharges = new Set<string>();
  private discoveredHiddenIds = new Set<string>();

  private trafficLightCycleTimer = 0;
  private nsGreen = true;
  private lightAmber = false;

  private gpsTarget: {
    x: number;
    z: number;
    label: string;
    routePoints?: Array<{ x: number; z: number }>;
  } | null = null;
  private checkpointMesh!: THREE.Group;
  private gpsBeaconMesh!: THREE.Mesh;

  private activeRace: ActiveRaceState | null = null;
  private activeRaceDef: RaceEvent | null = null;
  private lastCountdownBeep = 0;

  private activeJob: ActiveJobState | null = null;
  private activeJobDef: JobDefinition | null = null;

  private activeRandomEvent: RandomWorldEvent | null = null;
  private randomEventTimer = 18;

  private toastMessage: string | null = null;
  private toastTimer = 0;

  private adminOverrides: AdminOverrides = {
    godMode: false,
    unlimitedNitroFuel: false,
    noPolice: false,
    trafficDisabled: false,
    freezeTime: false,
    speedMultiplier: 1,
    accelMultiplier: 1,
    gripMultiplier: 1,
  };

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private telemetryAccum = 0;
  private consumptionAccum = 0;
  private distanceAccumKm = 0;
  private lastVehicleCrashTime = 0;

  constructor(
    container: HTMLElement,
    initialSpec: CarSpec,
    initialOwned: OwnedCar,
    initialGraphics: GraphicsSettings,
    discoveredIds: string[],
    sound: SoundEngine,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.activeSpec = initialSpec;
    this.activeOwned = { ...initialOwned };
    this.graphics = { ...initialGraphics };
    discoveredIds.forEach((id) => this.discoveredHiddenIds.add(id));
    this.sound = sound;
    this.callbacks = callbacks;

    this.initScene();
    this.applyGraphicsSettings(this.graphics);
    this.bindEvents();
    this.tick();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a2338');
    this.scene.fog = new THREE.FogExp2('#1a2338', 0.0018);

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.15, 1300);

    // Post-processing Composer (GPU only)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(width / 2), Math.floor(height / 2)),
        0.38,
        0.4,
        0.88
      );
      this.composer.addPass(this.bloomPass);
    }

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    this.hemiLight = new THREE.HemisphereLight('#93c5fd', '#451a03', 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff1d6', 1.85);
    this.sunLight.position.set(160, 220, 140);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 520;
    const d = 120;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight('#38bdf8', 0.55);
    this.rimLight.position.set(-140, 90, -180);
    this.scene.add(this.rimLight);

    this.textures = createProceduralTextures(
      this.renderer.capabilities.getMaxAnisotropy()
    );
    const worldRes = buildOpenWorld(this.scene, this.textures, this.isSoftwareGl);
    this.colliders = worldRes.colliders;
    this.oceanMesh = worldRes.oceanMesh;
    this.landmarkBeacons = worldRes.landmarkBeacons;
    this.roadMaterials = worldRes.roadMaterials;
    this.windowMaterials = worldRes.windowMaterials;
    this.streetLampMaterials = worldRes.streetLampMaterials;
    this.trafficLightRigs = worldRes.trafficLightRigs;

    // Player Car + Headlight SpotLight
    this.playerRig = buildCompositeCar(
      this.activeSpec,
      this.activeOwned.customization,
      this.textures.contactShadow
    );
    this.playerRig.root.position.set(this.carX, groundHeightAt(this.carX, this.carZ), this.carZ);
    this.headSpotLight = new THREE.SpotLight('#fef3c7', 0, 55, Math.PI / 5, 0.5, 1.5);
    this.headSpotLight.position.set(0, 0.7, -2.0);
    this.headSpotLight.target.position.set(0, 0, -24);
    this.playerRig.root.add(this.headSpotLight, this.headSpotLight.target);
    this.scene.add(this.playerRig.root);

    this.charRig = buildPlayerCharacter();
    this.charRig.root.visible = false;
    this.scene.add(this.charRig.root);

    // Rain Particle Cloud
    const rainCount = 700;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 90;
      rainPos[i * 3 + 1] = Math.random() * 34;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rainPoints = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({ color: '#bae6fd', size: 0.25, transparent: true, opacity: 0.6 })
    );
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // Checkpoint & GPS Beacons
    this.checkpointMesh = new THREE.Group();
    const cpRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.25, 10, 28),
      new THREE.MeshBasicMaterial({ color: '#f59e0b' })
    );
    cpRing.rotation.x = Math.PI / 2;
    cpRing.position.y = 0.35;
    const cpBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 36, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    cpBeam.position.y = 18;
    this.checkpointMesh.add(cpRing, cpBeam);
    this.checkpointMesh.visible = false;
    this.scene.add(this.checkpointMesh);

    this.gpsBeaconMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#06b6d4',
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.gpsBeaconMesh.visible = false;
    this.scene.add(this.gpsBeaconMesh);

    this.carMeetBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 4.5, 85, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#a855f7',
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.carMeetBeacon.visible = false;
    this.scene.add(this.carMeetBeacon);

    this.randomEventBeacon = new THREE.Group();
    const evRing = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.3, 10, 28),
      new THREE.MeshBasicMaterial({ color: '#10b981' })
    );
    evRing.rotation.x = Math.PI / 2;
    evRing.position.y = 0.4;
    const evCol = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 48, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#10b981',
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    evCol.position.y = 24;
    this.randomEventBeacon.add(evRing, evCol);
    this.randomEventBeacon.visible = false;
    this.scene.add(this.randomEventBeacon);

    this.spawnTraffic();
    this.spawnPedestrians();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  public applyGraphicsSettings(next: GraphicsSettings): void {
    this.graphics = { ...next };

    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.enabled = next.shadows;
      this.sunLight.castShadow = next.shadows;
      const pr =
        next.preset === 'low'
          ? 0.85
          : next.preset === 'medium'
          ? 1.0
          : Math.min(window.devicePixelRatio, next.preset === 'ultra' ? 2 : 1.5);
      this.renderer.setPixelRatio(pr);
      if (this.bloomPass) {
        this.bloomPass.enabled = next.bloom;
      }
    }

    // Weather road wetness & fog
    const isRain = next.weather === 'rain';
    const isFog = next.weather === 'fog';
    this.roadMaterials.forEach((mat) => {
      mat.roughness = isRain ? 0.22 : 0.82;
      mat.metalness = isRain ? 0.38 : 0.06;
    });
    if (this.rainPoints) {
      this.rainPoints.visible = isRain && next.weatherEffects;
    }

    const fogDensity = isFog ? 0.0055 : isRain ? 0.0028 : next.weather === 'overcast' ? 0.002 : 0.0014;
    (this.scene.fog as THREE.FogExp2).density = fogDensity;

    if (next.timeOfDay === 'dawn') this.clockHour = 6.2;
    else if (next.timeOfDay === 'noon') this.clockHour = 13.0;
    else if (next.timeOfDay === 'sunset') this.clockHour = 18.2;
    else if (next.timeOfDay === 'midnight') this.clockHour = 23.5;

    this.updateAtmosphereLighting();
  }

  private updateAtmosphereLighting(): void {
    const h = this.clockHour % 24;
    // Daylight factor 0 (night) -> 1 (midday)
    const sunElev = Math.sin(((h - 6) / 12) * Math.PI);
    const dayFactor = THREE.MathUtils.clamp(sunElev, 0, 1);

    if (this.graphics.weather === 'fog' || this.graphics.weather === 'overcast' || this.graphics.weather === 'rain') {
      _tmpColor.copy(_skyFog).lerp(_skyNight, (1 - dayFactor) * 0.72);
    } else if (h >= 5 && h < 8) {
      _tmpColor.copy(_skyNight).lerp(_skyDawn, (h - 5) / 3);
    } else if (h >= 8 && h < 16.5) {
      _tmpColor.copy(_skyDawn).lerp(_skyDay, Math.min(1, (h - 8) / 2));
    } else if (h >= 16.5 && h < 19.5) {
      _tmpColor.copy(_skyDay).lerp(_skyDusk, (h - 16.5) / 3);
    } else {
      _tmpColor.copy(_skyNight);
    }

    (this.scene.background as THREE.Color).copy(_tmpColor);
    (this.scene.fog as THREE.FogExp2).color.copy(_tmpColor);

    this.sunLight.intensity = 0.25 + dayFactor * 1.95;
    this.sunLight.position.set(
      Math.cos((h / 24) * Math.PI * 2) * 200,
      40 + Math.max(0, sunElev) * 210,
      120
    );
    this.hemiLight.intensity = 0.35 + dayFactor * 0.55;

    const nightAmt = 1 - dayFactor;
    this.headSpotLight.intensity = nightAmt > 0.45 ? 18 * nightAmt : 0;
    this.windowMaterials.forEach((m) => (m.emissiveIntensity = 0.12 + nightAmt * 0.85));
    this.streetLampMaterials.forEach((m) => (m.emissiveIntensity = 0.2 + nightAmt * 2.4));
  }

  private spawnTraffic(): void {
    const trafficSpecs = [CAR_CATALOG[0], CAR_CATALOG[4], CAR_CATALOG[1]];
    const trafficColors = ['#cbd5e1', '#475569', '#1d4ed8', '#047857', '#b91c1c', '#d97706'];
    const lanes = [-160, -80, 0, 80, 160];

    for (let i = 0; i < 16; i++) {
      const isAmbulance = i === 3 || i === 11;
      const isPatrol = i === 7 || i === 15;
      const spec = isAmbulance || isPatrol ? CAR_CATALOG[4] : trafficSpecs[i % trafficSpecs.length];
      const rig = buildCompositeCar(
        spec,
        {
          paintColor: trafficColors[i % trafficColors.length],
          finish: 'gloss',
          rimColor: '#94a3b8',
          spoiler: false,
          underglowColor: null,
        },
        this.textures.contactShadow,
        { isTraffic: true, isAmbulance, isPolice: isPatrol }
      );
      const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
      const dir: 1 | -1 = i % 3 === 0 ? -1 : 1;
      const laneCoord = lanes[i % lanes.length] + (dir === 1 ? 3.4 : -3.4);
      const posAlong = -200 + ((i * 33) % 400);
      const x = axis === 'z' ? laneCoord : posAlong;
      const z = axis === 'z' ? posAlong : laneCoord;
      const heading =
        axis === 'z'
          ? dir === 1
            ? Math.PI
            : 0
          : dir === 1
          ? -Math.PI / 2
          : Math.PI / 2;

      rig.root.position.set(x, 0, z);
      rig.root.rotation.y = heading;
      this.scene.add(rig.root);

      const baseSpeed = isAmbulance ? 19 : 13 + (i % 4) * 2.4;
      this.traffic.push({
        rig,
        x,
        z,
        heading,
        speed: baseSpeed,
        baseSpeed,
        halfW: spec.width * 0.5,
        halfL: spec.length * 0.5,
        axis,
        laneCoord,
        dir,
        isAmbulance,
        isPatrol,
      });
    }
  }

  private spawnPedestrians(): void {
    const coords = [
      { x: 10, z: -20 },
      { x: -10, z: 45 },
      { x: 70, z: 12 },
      { x: -70, z: -30 },
      { x: 150, z: 72 },
      { x: 195, z: 225 },
      { x: 250, z: 228 },
      { x: -10, z: -115 },
      { x: 340, z: 40 },
      { x: 380, z: -220 },
      { x: -450, z: 120 },
      { x: -95, z: 228 },
    ];
    coords.forEach((c, idx) => {
      const rig = buildPlayerCharacter();
      rig.root.position.set(c.x, groundHeightAt(c.x, c.z), c.z);
      this.scene.add(rig.root);
      this.pedestrians.push({
        rig,
        x: c.x,
        z: c.z,
        heading: (idx * 1.3) % (Math.PI * 2),
        speed: 1.8 + (idx % 3) * 0.4,
        phase: idx * 0.7,
      });
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    this.sound.ensureInit();
    const code = e.code;

    if (code === 'KeyW' || code === 'ArrowUp') this.keyboardInput.forward = true;
    if (code === 'KeyS' || code === 'ArrowDown') this.keyboardInput.backward = true;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keyboardInput.left = true;
    if (code === 'KeyD' || code === 'ArrowRight') this.keyboardInput.right = true;
    if (code === 'Space') {
      e.preventDefault();
      this.keyboardInput.handbrake = true;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keyboardInput.nitro = true;
    if (code === 'KeyH') this.keyboardInput.horn = true;

    if (!e.repeat) {
      if (code === 'KeyC') this.cycleCamera();
      if (code === 'KeyE') this.handleInteractOrToggleVehicle();
      if (code === 'KeyR') this.resetVehicle();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'KeyW' || code === 'ArrowUp') this.keyboardInput.forward = false;
    if (code === 'KeyS' || code === 'ArrowDown') this.keyboardInput.backward = false;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keyboardInput.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.keyboardInput.right = false;
    if (code === 'Space') this.keyboardInput.handbrake = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keyboardInput.nitro = false;
    if (code === 'KeyH') this.keyboardInput.horn = false;
  };

  public setTouchInput(partial: Partial<InputState>): void {
    this.sound.ensureInit();
    Object.assign(this.touchInput, partial);
  }

  private getMergedInput(): InputState {
    return {
      forward: this.keyboardInput.forward || Boolean(this.touchInput.forward),
      backward: this.keyboardInput.backward || Boolean(this.touchInput.backward),
      left: this.keyboardInput.left || Boolean(this.touchInput.left),
      right: this.keyboardInput.right || Boolean(this.touchInput.right),
      handbrake: this.keyboardInput.handbrake || Boolean(this.touchInput.handbrake),
      nitro: this.keyboardInput.nitro || Boolean(this.touchInput.nitro),
      horn: this.keyboardInput.horn || Boolean(this.touchInput.horn),
    };
  }

  public showToast(msg: string, duration = 3.2): void {
    this.toastMessage = msg;
    this.toastTimer = duration;
  }

  public cycleCamera(): void {
    const modes: CameraMode[] = ['chase', 'far', 'cockpit', 'hood'];
    const idx = modes.indexOf(this.cameraMode);
    this.cameraMode = modes[(idx + 1) % modes.length];
    this.showToast(`Camera: ${this.cameraMode.toUpperCase()}`, 1.5);
  }

  public handleInteractOrToggleVehicle(): void {
    const prompt = this.findNearbyPrompt();
    if (prompt && prompt.actionType !== 'vehicle' && prompt.landmarkId) {
      this.callbacks.onOpenLandmark(prompt.actionType, prompt.landmarkId);
      return;
    }
    this.toggleEnterExitVehicle();
  }

  public toggleEnterExitVehicle(): void {
    if (this.playerMode === 'driving') {
      const speed = Math.hypot(this.velX, this.velZ);
      if (speed > 8) {
        this.showToast('Slow down to exit vehicle');
        return;
      }
      if (this.activeRace && this.activeRace.active) {
        this.showToast('Cannot exit vehicle during an active race');
        return;
      }
      this.playerMode = 'walking';
      const sideX = Math.cos(this.carHeading) * -2.2;
      const sideZ = -Math.sin(this.carHeading) * -2.2;
      this.walkX = this.carX + sideX;
      this.walkZ = this.carZ + sideZ;
      this.walkHeading = this.carHeading;
      this.charRig.root.position.set(
        this.walkX,
        groundHeightAt(this.walkX, this.walkZ),
        this.walkZ
      );
      this.charRig.root.visible = true;
      this.showToast('On Foot — Press E near your car to enter');
    } else {
      const dist = Math.hypot(this.walkX - this.carX, this.walkZ - this.carZ);
      if (dist <= 5.5) {
        this.playerMode = 'driving';
        this.charRig.root.visible = false;
        this.showToast(`Entered ${this.activeSpec.name}`);
      } else {
        this.showToast('Walk closer to your car to enter');
      }
    }
  }

  public resetVehicle(): void {
    this.velX = 0;
    this.velZ = 0;
    this.bodyPitch = 0;
    this.bodyRoll = 0;
    const snappedX = Math.round(this.carX / 80) * 80;
    const snappedZ = Math.round(this.carZ / 80) * 80;
    if (Math.abs(this.carX) < 260 && Math.abs(this.carZ) < 260) {
      this.carX = THREE.MathUtils.clamp(snappedX, -240, 240);
      this.carZ = THREE.MathUtils.clamp(snappedZ, -240, 240);
    }
    if (this.playerMode === 'walking') {
      this.walkX = this.carX + 2.5;
      this.walkZ = this.carZ;
    }
    this.showToast('Vehicle reset to roadway');
  }

  public swapActiveCar(spec: CarSpec, owned: OwnedCar): void {
    this.activeSpec = spec;
    this.activeOwned = { ...owned };

    this.scene.remove(this.playerRig.root);
    this.playerRig = buildCompositeCar(
      spec,
      owned.customization,
      this.textures.contactShadow
    );
    this.playerRig.root.position.set(this.carX, groundHeightAt(this.carX, this.carZ), this.carZ);
    this.playerRig.root.rotation.y = this.carHeading;
    this.playerRig.root.add(this.headSpotLight, this.headSpotLight.target);
    this.scene.add(this.playerRig.root);
    this.showToast(`Now driving: ${spec.brand} ${spec.name}`);
  }

  public syncOwnedCarState(owned: OwnedCar): void {
    this.activeOwned = { ...owned };
    this.updateCarCustomization(owned.customization);
  }

  public updateCarCustomization(custom: CarCustomization): void {
    this.activeOwned.customization = { ...custom };
    this.playerRig.bodyMaterial.color.set(custom.paintColor);
    this.playerRig.bodyMaterial.roughness =
      custom.finish === 'matte' ? 0.62 : custom.finish === 'metallic' ? 0.2 : 0.12;
    this.playerRig.bodyMaterial.metalness =
      custom.finish === 'matte' ? 0.25 : custom.finish === 'metallic' ? 0.88 : 0.45;
    this.playerRig.bodyMaterial.clearcoat = custom.finish === 'matte' ? 0.05 : 1.0;
    this.playerRig.rimMaterial.color.set(custom.rimColor);
    this.playerRig.spoilerGroup.visible =
      custom.spoiler && this.activeSpec.bodyStyle !== 'offroad';
    if (custom.underglowColor) {
      this.playerRig.underglowMesh.visible = true;
      (this.playerRig.underglowMesh.material as THREE.MeshBasicMaterial).color.set(
        custom.underglowColor
      );
    } else {
      this.playerRig.underglowMesh.visible = false;
    }
  }

  public setGpsTarget(x: number, z: number, label: string): void {
    const px = this.playerMode === 'driving' ? this.carX : this.walkX;
    const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
    const routePoints = computeRoadRoute(px, pz, x, z);

    this.gpsTarget = { x, z, label, routePoints };
    this.gpsBeaconMesh.position.set(x, groundHeightAt(x, z) + 35, z);
    this.gpsBeaconMesh.visible = true;

    if (this.gpsRouteLine) {
      this.scene.remove(this.gpsRouteLine);
      this.gpsRouteLine.geometry.dispose();
    }
    const pts3d = routePoints.map(
      (p) => new THREE.Vector3(p.x, groundHeightAt(p.x, p.z) + 0.35, p.z)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(pts3d);
    this.gpsRouteLine = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: '#06b6d4' })
    );
    this.scene.add(this.gpsRouteLine);
    this.showToast(`GPS Route Calculated: ${label}`);
  }

  public clearGpsTarget(): void {
    this.gpsTarget = null;
    this.gpsBeaconMesh.visible = false;
    if (this.gpsRouteLine) {
      this.scene.remove(this.gpsRouteLine);
      this.gpsRouteLine.geometry.dispose();
      this.gpsRouteLine = null;
    }
  }

  public teleportTo(x: number, z: number, heading = 0): void {
    this.carX = x;
    this.carZ = z;
    this.carHeading = heading;
    this.velX = 0;
    this.velZ = 0;
    this.playerMode = 'driving';
    this.charRig.root.visible = false;
    this.playerRig.root.position.set(x, groundHeightAt(x, z), z);
    this.playerRig.root.rotation.y = heading;
    this.camPos.set(x + Math.sin(heading) * 9, groundHeightAt(x, z) + 4, z + Math.cos(heading) * 9);
  }

  public resolvePoliceStop(): void {
    this.wantedLevel = 0;
    this.bustTimer = 0;
    this.policePaused = false;
    this.pendingCharges.clear();
    this.clearPolice();
  }

  public setAdminOverrides(next: AdminOverrides): void {
    this.adminOverrides = { ...next };
    this.traffic.forEach((t) => {
      t.rig.root.visible = !this.adminOverrides.trafficDisabled;
    });
    if (this.adminOverrides.noPolice && this.wantedLevel > 0) {
      this.resolvePoliceStop();
    }
    if (this.adminOverrides.unlimitedNitroFuel) {
      this.nitro = 100;
      this.activeOwned.fuel = 100;
    }
    if (this.adminOverrides.godMode) {
      this.activeOwned.condition = 100;
    }
  }

  public setAdminClockHour(hour: number): void {
    this.clockHour = ((hour % 24) + 24) % 24;
    this.updateAtmosphereLighting();
  }

  public setAdminWantedLevel(level: number, charge = 'Admin Wanted Override'): void {
    const clamped = Math.max(0, Math.min(5, Math.round(level)));
    if (clamped === 0) {
      this.resolvePoliceStop();
      this.showToast('Admin: Police Pursuit Cleared', 2.4);
      return;
    }
    this.adminOverrides.noPolice = false;
    this.policePaused = false;
    this.pendingCharges.add(charge);
    this.wantedLevel = clamped;
    this.wantedCooldown = 14;
    this.syncPoliceCount();
    this.showToast(`Admin: Wanted Level set to ${clamped}★`, 2.6);
  }

  public triggerAdminWorldEvent(): void {
    this.activeRandomEvent = null;
    this.randomEventTimer = 0;
    this.updateRandomEvents(0.016);
  }

  public testPoliceStop(): void {
    if (this.wantedLevel === 0) {
      this.wantedLevel = 2;
      this.pendingCharges.add('Admin Patrol Stop Simulation');
    }
    this.policePaused = true;
    this.velX = 0;
    this.velZ = 0;
    this.callbacks.onPoliceStop(Array.from(this.pendingCharges), this.wantedLevel);
  }

  public setCarMeetBeacon(meet: { x: number; z: number; label: string } | null): void {
    if (!this.carMeetBeacon) return;
    if (!meet) {
      this.carMeetBeacon.visible = false;
    } else {
      this.carMeetBeacon.position.set(meet.x, groundHeightAt(meet.x, meet.z) + 42, meet.z);
      this.carMeetBeacon.visible = true;
    }
  }

  public syncRemotePlayers(players: RemotePlayerState[], selfId: string): void {
    const activeIds = new Set<string>();
    players.forEach((p) => {
      if (p.playerId === selfId) return;
      activeIds.add(p.playerId);

      const existing = this.remotePeers.get(p.playerId);
      if (!existing || existing.specId !== p.specId) {
        if (existing) {
          this.scene.remove(existing.rig.root);
        }
        const spec = CAR_CATALOG.find((c) => c.id === p.specId) || CAR_CATALOG[0];
        const rig = buildCompositeCar(
          spec,
          {
            paintColor: p.paintColor || spec.defaultColor,
            finish: (p.finish as 'gloss' | 'metallic' | 'matte') || 'metallic',
            rimColor: p.rimColor || '#e4e4e7',
            spoiler: p.spoiler,
            underglowColor: p.underglowColor,
          },
          this.textures.contactShadow,
          { isTraffic: true }
        );
        const nameplate = createNameplateSprite(p.name);
        rig.root.add(nameplate);
        rig.root.position.set(p.x, p.y, p.z);
        rig.root.rotation.y = p.heading;
        this.scene.add(rig.root);

        this.remotePeers.set(p.playerId, {
          rig,
          nameplate,
          targetX: p.x,
          targetY: p.y,
          targetZ: p.z,
          targetHeading: p.heading,
          specId: p.specId,
          paintColor: p.paintColor,
          speedKmh: p.speedKmh,
          halfW: spec.width * 0.5,
          halfL: spec.length * 0.5,
        });
      } else {
        existing.targetX = p.x;
        existing.targetY = p.y;
        existing.targetZ = p.z;
        existing.targetHeading = p.heading;
        existing.speedKmh = p.speedKmh;
        if (existing.paintColor !== p.paintColor) {
          existing.paintColor = p.paintColor;
          existing.rig.bodyMaterial.color.set(p.paintColor);
        }
        existing.rig.nitroFlames[0].visible = p.nitroActive;
        existing.rig.nitroFlames[1].visible = p.nitroActive;
      }
    });

    // Remove departed players
    this.remotePeers.forEach((peer, id) => {
      if (!activeIds.has(id)) {
        this.scene.remove(peer.rig.root);
        this.remotePeers.delete(id);
      }
    });
  }

  public getPlayerSnapshot() {
    const px = this.playerMode === 'driving' ? this.carX : this.walkX;
    const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
    return {
      x: px,
      y: groundHeightAt(px, pz),
      z: pz,
      heading: this.playerMode === 'driving' ? this.carHeading : this.walkHeading,
      speedKmh: Math.round(Math.hypot(this.velX, this.velZ) * 3.6),
      steerAngle: this.steerAngle,
      specId: this.activeSpec.id,
      paintColor: this.activeOwned.customization.paintColor,
      finish: this.activeOwned.customization.finish,
      rimColor: this.activeOwned.customization.rimColor,
      spoiler: this.activeOwned.customization.spoiler,
      underglowColor: this.activeOwned.customization.underglowColor,
      isDrifting: this.isDrifting,
      nitroActive: this.getMergedInput().nitro && this.nitro > 2,
      hornActive: this.getMergedInput().horn,
      playerMode: this.playerMode,
    };
  }

  public startRace(race: RaceEvent): void {
    this.clearRaceOpponents();
    this.playerMode = 'driving';
    this.charRig.root.visible = false;

    const lm = WORLD_LANDMARKS.find((l) => l.raceId === race.id);
    const startX = lm ? lm.x : race.waypoints[0].x;
    const startZ = lm ? lm.z : race.waypoints[0].z;

    this.carX = startX;
    this.carZ = startZ;
    this.carHeading = race.startHeading;
    this.velX = 0;
    this.velZ = 0;
    this.nitro = 100;
    this.resolvePoliceStop();

    const oppColors = ['#2563eb', '#16a34a', '#9333ea', '#f43f5e', '#eab308'];
    for (let i = 0; i < race.opponents; i++) {
      const spec = CAR_CATALOG[(i + 1) % CAR_CATALOG.length];
      const rig = buildCompositeCar(
        spec,
        {
          paintColor: oppColors[i % oppColors.length],
          finish: 'metallic',
          rimColor: '#e4e4e7',
          spoiler: true,
          underglowColor: null,
        },
        this.textures.contactShadow,
        { isTraffic: true }
      );
      const sideOffset = (i % 2 === 0 ? 1 : -1) * 3.4;
      const backOffset = Math.floor(i / 2 + 1) * 6.5;
      const rx =
        startX +
        Math.cos(race.startHeading) * sideOffset +
        Math.sin(race.startHeading) * backOffset;
      const rz =
        startZ -
        Math.sin(race.startHeading) * sideOffset +
        Math.cos(race.startHeading) * backOffset;
      rig.root.position.set(rx, groundHeightAt(rx, rz), rz);
      rig.root.rotation.y = race.startHeading;
      this.scene.add(rig.root);

      this.racers.push({
        rig,
        x: rx,
        z: rz,
        heading: race.startHeading,
        speed: 0,
        halfW: spec.width * 0.5,
        halfL: spec.length * 0.5,
        waypointIdx: 0,
        lap: 1,
        finished: false,
        progressScore: 0,
      });
    }

    this.activeRaceDef = race;
    this.activeRace = {
      raceId: race.id,
      raceName: race.name,
      type: race.type,
      countdown: 3.2,
      active: true,
      finished: false,
      lap: 1,
      totalLaps: race.laps,
      checkpointIndex: 0,
      totalCheckpoints: race.waypoints.length,
      position: 1,
      totalRacers: race.opponents + 1,
      elapsedSec: 0,
      driftScore: 0,
      targetDriftScore: race.targetDriftScore,
    };
    this.lastCountdownBeep = 4;

    const wp = race.waypoints[0];
    this.checkpointMesh.position.set(wp.x, groundHeightAt(wp.x, wp.z), wp.z);
    this.checkpointMesh.visible = true;
    this.showToast(`Starting ${race.name}!`);
  }

  public abortRace(): void {
    this.clearRaceOpponents();
    this.activeRace = null;
    this.activeRaceDef = null;
    if (!this.activeJob) this.checkpointMesh.visible = false;
  }

  private clearRaceOpponents(): void {
    this.racers.forEach((r) => this.scene.remove(r.rig.root));
    this.racers = [];
  }

  public startJob(job: JobDefinition): void {
    this.activeJobDef = job;
    this.activeJob = {
      jobId: job.id,
      title: job.title,
      stage: 'pickup',
      targetLabel: job.pickup.label,
      targetX: job.pickup.x,
      targetZ: job.pickup.z,
      remainingSec: job.timeLimitSec,
      payout: job.payout,
      repReward: job.repReward,
    };
    this.checkpointMesh.position.set(
      job.pickup.x,
      groundHeightAt(job.pickup.x, job.pickup.z),
      job.pickup.z
    );
    this.checkpointMesh.visible = true;
    this.setGpsTarget(job.pickup.x, job.pickup.z, job.pickup.label);
    this.showToast(`Job Started: Head to ${job.pickup.label}`);
  }

  private clearPolice(): void {
    this.police.forEach((p) => this.scene.remove(p.rig.root));
    this.police = [];
  }

  private spawnParticle(x: number, y: number, z: number, color: string, size = 1): void {
    if (this.particles.length > 48) return;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.particleGeo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 0.8 + Math.random() * 1.4,
      vz: (Math.random() - 0.5) * 2.2,
      life: 0,
      maxLife: 0.55 + Math.random() * 0.3,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.stepSimulation(dt, now * 0.001);

    if (this.composer && this.graphics.bloom && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number, elapsedSec: number): void {
    const input = this.getMergedInput();

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastMessage = null;
    }

    // Dynamic Day/Night Cycle
    if (this.graphics.timeOfDay === 'auto' && !this.adminOverrides.freezeTime) {
      this.clockHour = (this.clockHour + dt * 0.08) % 24; // ~5 min full 24h cycle
      this.updateAtmosphereLighting();
    }

    // Rain animation around player
    if (this.rainPoints && this.rainPoints.visible) {
      this.rainPoints.position.set(this.carX, 0, this.carZ);
      const arr = this.rainPoints.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * 32;
        if (arr[i + 1] < 0) arr[i + 1] = 32;
      }
      this.rainPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Traffic Lights cycle (every 10s switch)
    this.trafficLightCycleTimer += dt;
    const cycle = this.trafficLightCycleTimer % 14;
    this.nsGreen = cycle < 7;
    this.lightAmber = (cycle > 5.5 && cycle < 7) || cycle > 12.5;
    this.trafficLightRigs.forEach((tl) => {
      if (this.lightAmber) {
        tl.nsBulbMat.color.set('#f59e0b');
        tl.nsBulbMat.emissive.set('#f59e0b');
        tl.ewBulbMat.color.set('#f59e0b');
        tl.ewBulbMat.emissive.set('#f59e0b');
      } else if (this.nsGreen) {
        tl.nsBulbMat.color.set('#10b981');
        tl.nsBulbMat.emissive.set('#10b981');
        tl.ewBulbMat.color.set('#ef4444');
        tl.ewBulbMat.emissive.set('#ef4444');
      } else {
        tl.nsBulbMat.color.set('#ef4444');
        tl.nsBulbMat.emissive.set('#ef4444');
        tl.ewBulbMat.color.set('#10b981');
        tl.ewBulbMat.emissive.set('#10b981');
      }
    });

    if (this.oceanMesh) {
      this.oceanMesh.position.y = -0.85 + Math.sin(elapsedSec * 1.4) * 0.14;
    }
    this.landmarkBeacons.forEach((b, idx) => {
      b.rotation.y = elapsedSec * 0.5 + idx;
    });
    if (this.checkpointMesh.visible) {
      this.checkpointMesh.rotation.y = elapsedSec * 1.6;
    }

    // Random World Events
    this.updateRandomEvents(dt);

    let raceLocked = this.policePaused;
    if (this.activeRace && this.activeRace.active) {
      if (this.activeRace.countdown > 0) {
        raceLocked = true;
        this.activeRace.countdown -= dt;
        const ceilVal = Math.ceil(this.activeRace.countdown);
        if (ceilVal < this.lastCountdownBeep && ceilVal >= 1) {
          this.lastCountdownBeep = ceilVal;
          this.sound.playChime('countdown');
        }
        if (this.activeRace.countdown <= 0) {
          this.activeRace.countdown = 0;
          this.sound.playChime('go');
          this.showToast('GO!', 1.5);
        }
      } else {
        this.activeRace.elapsedSec += dt;
      }
    }

    if (this.playerMode === 'driving') {
      this.updateCarPhysics(dt, input, raceLocked);
    } else {
      this.updateWalkingPhysics(dt, input);
    }

    this.updateTraffic(dt, elapsedSec);
    this.updatePedestrians(dt);
    this.updatePolice(dt, elapsedSec);
    this.updateRemotePeers(dt);
    this.updateRaceLogic(dt, raceLocked);
    this.resolveAllVehicleCollisions(elapsedSec);
    this.syncVehicleMeshes();
    this.updateJobLogic(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.checkHiddenDiscoveries();

    if (this.gpsTarget) {
      const px = this.playerMode === 'driving' ? this.carX : this.walkX;
      const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
      if (Math.hypot(px - this.gpsTarget.x, pz - this.gpsTarget.z) < 16) {
        this.showToast(`Arrived at ${this.gpsTarget.label}`);
        this.clearGpsTarget();
      }
    }

    this.telemetryAccum += dt;
    if (this.telemetryAccum >= 0.04) {
      this.telemetryAccum = 0;
      this.emitTelemetry();
    }
  }

  private updateRandomEvents(dt: number): void {
    if (this.activeRandomEvent) {
      this.activeRandomEvent.remainingSec -= dt;
      const px = this.playerMode === 'driving' ? this.carX : this.walkX;
      const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
      if (Math.hypot(px - this.activeRandomEvent.x, pz - this.activeRandomEvent.z) < 14) {
        const completed = { ...this.activeRandomEvent };
        this.activeRandomEvent = null;
        if (this.randomEventBeacon) this.randomEventBeacon.visible = false;
        this.sound.playChime('cash');
        this.callbacks.onRandomEventCompleted(completed);
        this.showToast(
          `${completed.title} Complete! +$${completed.rewardCash.toLocaleString()} · +${completed.rewardRep} REP`,
          3.4
        );
        this.randomEventTimer = 35;
        return;
      }
      if (this.activeRandomEvent.remainingSec <= 0) {
        this.activeRandomEvent = null;
        if (this.randomEventBeacon) this.randomEventBeacon.visible = false;
        this.randomEventTimer = 30;
      }
      return;
    }

    this.randomEventTimer -= dt;
    if (this.randomEventTimer <= 0) {
      const events = [
        {
          id: `re_armored_${Date.now()}`,
          title: 'New Kingston Cash Drop',
          description: 'An armored courier dropped a lockbox near Jamaica National Plaza!',
          x: 40,
          z: -120,
          rewardCash: 3500,
          rewardRep: 85,
          remainingSec: 65,
        },
        {
          id: `re_airport_${Date.now()}`,
          title: 'Palisadoes Runway Time Attack',
          description: 'Reach the west Norman Manley runway stash before security locks the gate!',
          x: -560,
          z: 160,
          rewardCash: 4800,
          rewardRep: 110,
          remainingSec: 75,
        },
        {
          id: `re_luxury_${Date.now()}`,
          title: 'Beverly Hills VIP Courier',
          description: 'Collect an urgent luxury tuning contract at Beverly Hills Kingston!',
          x: 380,
          z: -240,
          rewardCash: 4200,
          rewardRep: 95,
          remainingSec: 70,
        },
      ];
      const pick = events[Math.floor(Math.random() * events.length)];
      this.activeRandomEvent = pick;
      if (this.randomEventBeacon) {
        this.randomEventBeacon.position.set(pick.x, groundHeightAt(pick.x, pick.z), pick.z);
        this.randomEventBeacon.visible = true;
      }
      this.showToast(`World Event: ${pick.title} — Check your Map!`, 3.5);
    }
  }

  private checkHiddenDiscoveries(): void {
    const px = this.playerMode === 'driving' ? this.carX : this.walkX;
    const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
    for (let i = 0; i < WORLD_LANDMARKS.length; i++) {
      const lm = WORLD_LANDMARKS[i];
      if (lm.type !== 'hidden' || this.discoveredHiddenIds.has(lm.id)) continue;
      if (Math.hypot(px - lm.x, pz - lm.z) < 16) {
        this.discoveredHiddenIds.add(lm.id);
        this.sound.playChime('cash');
        this.callbacks.onHiddenDiscovered(lm);
        this.showToast(
          `Discovered ${lm.name}! +$${(lm.hiddenRewardCash || 5000).toLocaleString()}`,
          3.8
        );
      }
    }
  }

  private updateRemotePeers(dt: number): void {
    this.remotePeers.forEach((peer) => {
      peer.rig.root.position.x = THREE.MathUtils.damp(peer.rig.root.position.x, peer.targetX, 12, dt);
      peer.rig.root.position.y = THREE.MathUtils.damp(peer.rig.root.position.y, peer.targetY, 12, dt);
      peer.rig.root.position.z = THREE.MathUtils.damp(peer.rig.root.position.z, peer.targetZ, 12, dt);
      // Shortest angular interpolation
      let diff = peer.targetHeading - peer.rig.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      peer.rig.root.rotation.y += diff * Math.min(1, 12 * dt);
      peer.rig.wheelSpinGroups.forEach((w) => (w.rotation.x -= (peer.speedKmh / 3.6) * dt * 2.2));
    });
  }

  private updateCarPhysics(dt: number, input: InputState, raceLocked: boolean): void {
    const upg = this.activeOwned.upgrades;
    const spec = this.activeSpec;

    const healthFactor = this.adminOverrides.godMode
      ? 1
      : 0.65 + (this.activeOwned.condition / 100) * 0.35;
    const hasFuel = this.adminOverrides.unlimitedNitroFuel || this.activeOwned.fuel > 0.2;

    const maxSpeedMs =
      ((spec.baseSpeedKmh + (upg.engine - 1) * 18 + (upg.transmission - 1) * 10) / 3.6) *
      healthFactor *
      (hasFuel ? 1 : 0.32) *
      this.adminOverrides.speedMultiplier;

    const accelForce =
      (spec.baseAccel * 2.4 + (upg.engine - 1) * 2.2 + (upg.turbo - 1) * 1.8) *
      healthFactor *
      (hasFuel ? 1 : 0.35) *
      this.adminOverrides.accelMultiplier;

    const handlingFactor = spec.baseHandling + (upg.tires - 1) * 0.8 + (upg.suspension - 1) * 0.5;
    const brakeForce = 26 + (upg.brakes - 1) * 4.5;

    const fwdX = -Math.sin(this.carHeading);
    const fwdZ = -Math.cos(this.carHeading);
    const rightX = Math.cos(this.carHeading);
    const rightZ = -Math.sin(this.carHeading);

    let forwardSpeed = this.velX * fwdX + this.velZ * fwdZ;
    let lateralSpeed = this.velX * rightX + this.velZ * rightZ;

    const surface = getSurfaceType(this.carX, this.carZ);
    const offroadBonus = spec.offroadRating / 10;
    const rainFactor = this.graphics.weather === 'rain' ? 0.92 : 1.0;
    const surfaceSpeedCap =
      (surface === 'asphalt'
        ? 1.0
        : surface === 'dirt'
        ? 0.72 + offroadBonus * 0.26
        : surface === 'sand'
        ? 0.62 + offroadBonus * 0.3
        : 0.78 + offroadBonus * 0.2) * rainFactor;

    const effectiveMaxSpeed = maxSpeedMs * surfaceSpeedCap;

    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const speedRatio = Math.min(1, Math.abs(forwardSpeed) / 28);
    const maxSteer = THREE.MathUtils.lerp(0.62, 0.28, speedRatio * 0.75);
    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, steerInput * maxSteer, 11, dt);

    let nitroActive = false;
    let throttleActive = false;

    if (!raceLocked) {
      if (input.nitro && (this.nitro > 1 || this.adminOverrides.unlimitedNitroFuel) && input.forward && hasFuel) {
        nitroActive = true;
        if (this.adminOverrides.unlimitedNitroFuel) {
          this.nitro = 100;
        } else {
          this.nitro = Math.max(0, this.nitro - dt * (24 - upg.turbo * 2));
        }
        forwardSpeed += accelForce * 0.95 * dt;
      } else {
        this.nitro = this.adminOverrides.unlimitedNitroFuel
          ? 100
          : Math.min(100, this.nitro + dt * (this.isDrifting ? 14 : 6.5));
      }

      if (input.forward) {
        throttleActive = true;
        if (forwardSpeed < -1.5) {
          forwardSpeed += brakeForce * dt;
        } else {
          const torqueCurve = 1 - Math.min(0.6, Math.abs(forwardSpeed) / (effectiveMaxSpeed * 1.25));
          forwardSpeed += accelForce * torqueCurve * dt;
        }
      } else if (input.backward) {
        if (forwardSpeed > 1.5) {
          forwardSpeed -= brakeForce * dt;
        } else {
          forwardSpeed -= accelForce * 0.62 * dt;
        }
      } else {
        forwardSpeed *= Math.max(0, 1 - 0.55 * dt);
      }

      if (input.handbrake) {
        forwardSpeed *= Math.max(0, 1 - 1.35 * dt);
      }
    } else {
      forwardSpeed = 0;
      lateralSpeed = 0;
    }

    const topCap = nitroActive ? effectiveMaxSpeed * 1.22 : effectiveMaxSpeed;
    forwardSpeed = THREE.MathUtils.clamp(forwardSpeed, -effectiveMaxSpeed * 0.38, topCap);

    if (Math.abs(forwardSpeed) > 0.6 && !raceLocked) {
      const dirSign = forwardSpeed >= 0 ? 1 : -1;
      const turnPower =
        (1.65 + handlingFactor * 0.14) *
        (input.handbrake ? 1.48 : 1.0) *
        Math.min(1, Math.abs(forwardSpeed) / 7);
      this.carHeading += this.steerAngle * turnPower * dirSign * dt;
    }

    const baseGrip =
      (surface === 'asphalt'
        ? 6.8 + (upg.tires - 1) * 0.9
        : 3.4 + offroadBonus * 2.2) *
      (this.graphics.weather === 'rain' ? 0.78 : 1.0) *
      this.adminOverrides.gripMultiplier;
    const grip = input.handbrake ? baseGrip * 0.24 : baseGrip;
    lateralSpeed *= Math.max(0, 1 - grip * dt);

    const newFwdX = -Math.sin(this.carHeading);
    const newFwdZ = -Math.cos(this.carHeading);
    const newRightX = Math.cos(this.carHeading);
    const newRightZ = -Math.sin(this.carHeading);

    this.velX = newFwdX * forwardSpeed + newRightX * lateralSpeed;
    this.velZ = newFwdZ * forwardSpeed + newRightZ * lateralSpeed;

    const totalStepX = this.velX * dt;
    const totalStepZ = this.velZ * dt;
    const totalDist = Math.hypot(totalStepX, totalStepZ);
    const substeps = Math.max(1, Math.min(5, Math.ceil(totalDist / 0.8)));
    const subX = totalStepX / substeps;
    const subZ = totalStepZ / substeps;

    let nextX = this.carX;
    let nextZ = this.carZ;
    let collidedStrength = 0;
    const bound = WORLD_RADIUS - 30;
    const carRadius = spec.width * 0.52;

    for (let step = 0; step < substeps; step++) {
      nextX += subX;
      nextZ += subZ;

      if (Math.abs(nextX) > bound) {
        nextX = THREE.MathUtils.clamp(nextX, -bound, bound);
        this.velX *= -0.4;
      }
      if (Math.abs(nextZ) > bound) {
        nextZ = THREE.MathUtils.clamp(nextZ, -bound, bound);
        this.velZ *= -0.4;
      }

      const resolved = this.resolveBuildingColliders(nextX, nextZ, carRadius);
      nextX = resolved.x;
      nextZ = resolved.z;
      if (resolved.impact > collidedStrength) {
        collidedStrength = resolved.impact;
      }
    }

    if (collidedStrength > 0.15) {
      this.sound.playCollision(collidedStrength);
      if (!this.adminOverrides.godMode) {
        const dmg = Math.min(14, collidedStrength * 4.5);
        this.activeOwned.condition = Math.max(0, this.activeOwned.condition - dmg);
        this.callbacks.onConsumptionUpdate(0, -dmg, 0);
      }
    }

    const stepDistM = Math.hypot(nextX - this.carX, nextZ - this.carZ);
    this.carX = nextX;
    this.carZ = nextZ;

    this.distanceAccumKm += stepDistM / 1000;
    this.consumptionAccum += dt;
    if (this.consumptionAccum >= 1.0) {
      const fuelBurn = this.adminOverrides.unlimitedNitroFuel
        ? 0
        : (throttleActive ? 0.14 : 0.02) + (nitroActive ? 0.25 : 0);
      if (fuelBurn > 0) {
        this.activeOwned.fuel = Math.max(0, this.activeOwned.fuel - fuelBurn);
      }
      this.callbacks.onConsumptionUpdate(-fuelBurn, 0, this.distanceAccumKm);
      this.consumptionAccum = 0;
      this.distanceAccumKm = 0;
    }

    const speedKmh = Math.hypot(this.velX, this.velZ) * 3.6;
    const slipRatio = Math.abs(lateralSpeed) / Math.max(4, Math.abs(forwardSpeed));

    if (speedKmh > 26 && (slipRatio > 0.22 || (input.handbrake && Math.abs(lateralSpeed) > 3.5))) {
      this.isDrifting = true;
      this.driftGraceTimer = 0.65;
      const pts = Math.round((speedKmh * 0.38 + Math.abs(lateralSpeed) * 4) * dt * 10);
      this.currentDriftPoints += pts;
      if (this.activeRace && this.activeRace.active && this.activeRace.type === 'drift') {
        this.activeRace.driftScore += pts;
      }
      if (Math.random() < 0.45) {
        const rearX = this.carX - newFwdX * (spec.length * 0.36);
        const rearZ = this.carZ - newFwdZ * (spec.length * 0.36);
        const pColor = surface === 'dirt' || surface === 'sand' ? '#d6b984' : '#e4e4e7';
        this.spawnParticle(rearX, groundHeightAt(rearX, rearZ) + 0.2, rearZ, pColor, 0.9);
      }
    } else if (this.isDrifting) {
      this.driftGraceTimer -= dt;
      if (this.driftGraceTimer <= 0) {
        this.isDrifting = false;
        if (this.currentDriftPoints >= 150) {
          const cash = Math.round(this.currentDriftPoints * 0.35);
          const rep = Math.round(this.currentDriftPoints * 0.04);
          this.callbacks.onDriftBanked(this.currentDriftPoints, cash, rep);
          this.showToast(`Drift Banked! +$${cash} · +${rep} REP`, 2.2);
        }
        this.currentDriftPoints = 0;
      }
    }

    const absKmh = Math.abs(forwardSpeed) * 3.6;
    if (forwardSpeed < -0.5) {
      this.gear = 'R';
      this.rpm = 1200 + (absKmh / 60) * 5500;
    } else if (absKmh < 2 && !throttleActive) {
      this.gear = 'N';
      this.rpm = 850 + Math.sin(performance.now() * 0.01) * 40;
    } else {
      const gearThresholds = [0, 46, 92, 145, 200, 255, 360];
      let gIdx = 1;
      for (let i = 1; i < gearThresholds.length; i++) {
        if (absKmh >= gearThresholds[i]) gIdx = Math.min(6, i + 1);
      }
      this.gear = String(gIdx);
      const low = gearThresholds[gIdx - 1];
      const high = gearThresholds[gIdx];
      const frac = THREE.MathUtils.clamp((absKmh - low) / Math.max(10, high - low), 0.12, 1);
      this.rpm = 1800 + frac * 6400 + (nitroActive ? 450 : 0);
    }

    if (
      absKmh > 165 &&
      Math.abs(this.carX) < 220 &&
      Math.abs(this.carZ) < 220 &&
      !this.activeRace &&
      !this.policePaused &&
      !this.adminOverrides.noPolice
    ) {
      if (this.wantedLevel === 0) {
        this.triggerWanted(1, 'Excessive Speeding in New Kingston Zone');
      }
    }

    const gy = groundHeightAt(this.carX, this.carZ);
    this.playerRig.root.position.set(this.carX, gy, this.carZ);
    this.playerRig.root.rotation.y = this.carHeading;

    const hFront = groundHeightAt(this.carX + newFwdX * 2, this.carZ + newFwdZ * 2);
    const hBack = groundHeightAt(this.carX - newFwdX * 2, this.carZ - newFwdZ * 2);
    const slopePitch = Math.atan2(hFront - hBack, 4);

    const targetPitch =
      slopePitch + (input.forward ? -0.028 : input.backward && forwardSpeed > 1 ? 0.04 : 0);
    const targetRoll = THREE.MathUtils.clamp(lateralSpeed * 0.008, -0.08, 0.08);

    this.bodyPitch = THREE.MathUtils.damp(this.bodyPitch, targetPitch, 9, dt);
    this.bodyRoll = THREE.MathUtils.damp(this.bodyRoll, targetRoll, 9, dt);
    this.playerRig.bodyPivot.rotation.x = this.bodyPitch;
    this.playerRig.bodyPivot.rotation.z = this.bodyRoll;

    this.wheelSpin -= (forwardSpeed / 0.36) * dt;
    this.playerRig.wheelSpinGroups.forEach((wg) => (wg.rotation.x = this.wheelSpin));
    this.playerRig.frontSteerPivots.forEach((sp) => (sp.rotation.y = this.steerAngle * 0.85));
    this.playerRig.steeringWheel.rotation.z = this.steerAngle * 2.4;

    const braking = (input.backward && forwardSpeed > 0.5) || input.handbrake;
    this.playerRig.tailLightMaterial.emissiveIntensity = braking ? 3.5 : 1.0;
    this.playerRig.nitroFlames[0].visible = nitroActive;
    this.playerRig.nitroFlames[1].visible = nitroActive;
    if (nitroActive) {
      const pulse = 0.85 + Math.random() * 0.45;
      this.playerRig.nitroFlames[0].scale.set(1, 1, pulse);
      this.playerRig.nitroFlames[1].scale.set(1, 1, pulse);
    }

    const sirenIntensity =
      this.wantedLevel > 0 && this.police.length > 0 && !this.policePaused
        ? THREE.MathUtils.clamp(
            1 - Math.min(...this.police.map((p) => Math.hypot(p.x - this.carX, p.z - this.carZ))) / 140,
            0.15,
            1
          )
        : 0;

    this.sound.updateVehicleAudio({
      driving: !raceLocked,
      rpm: this.rpm,
      maxRpm: 8500,
      throttle: throttleActive,
      slipRatio: this.isDrifting ? Math.max(0.4, slipRatio) : 0,
      nitroActive,
      hornActive: input.horn,
      sirenIntensity,
    });
  }

  private updateWalkingPhysics(dt: number, input: InputState): void {
    this.sound.updateVehicleAudio({
      driving: false,
      rpm: 0,
      maxRpm: 8500,
      throttle: false,
      slipRatio: 0,
      nitroActive: false,
      hornActive: false,
      sirenIntensity: 0,
    });

    const turnInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.walkHeading += turnInput * 2.6 * dt;

    const moveDir = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    const speed = input.handbrake ? 9.5 : 5.2;

    if (moveDir !== 0) {
      const nx = this.walkX - Math.sin(this.walkHeading) * moveDir * speed * dt;
      const nz = this.walkZ - Math.cos(this.walkHeading) * moveDir * speed * dt;
      const bound = WORLD_RADIUS - 30;
      this.walkX = THREE.MathUtils.clamp(nx, -bound, bound);
      this.walkZ = THREE.MathUtils.clamp(nz, -bound, bound);
      this.walkAnimPhase += dt * (input.handbrake ? 14 : 9);
    } else {
      this.walkAnimPhase = THREE.MathUtils.damp(this.walkAnimPhase, 0, 8, dt);
    }

    const gy = groundHeightAt(this.walkX, this.walkZ);
    this.charRig.root.position.set(this.walkX, gy, this.walkZ);
    this.charRig.root.rotation.y = this.walkHeading;

    const swing = moveDir !== 0 ? Math.sin(this.walkAnimPhase) * 0.65 : 0;
    this.charRig.leftArm.rotation.x = swing;
    this.charRig.rightArm.rotation.x = -swing;
    this.charRig.leftLeg.rotation.x = -swing;
    this.charRig.rightLeg.rotation.x = swing;
  }

  private updateTraffic(dt: number, elapsedSec: number): void {
    if (this.adminOverrides.trafficDisabled) return;
    const flash = Math.floor(elapsedSec * 7) % 2 === 0;
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      const fwdX = -Math.sin(t.heading);
      const fwdZ = -Math.cos(t.heading);
      let targetSpeed = t.baseSpeed;

      // Yield behind player car if directly ahead
      const toPx = this.carX - t.x;
      const toPz = this.carZ - t.z;
      const pFwd = toPx * fwdX + toPz * fwdZ;
      const pLat = Math.abs(toPx * fwdZ - toPz * fwdX);
      if (pFwd > 0 && pFwd < 14 && pLat < 3.0) {
        targetSpeed = pFwd < 6.8 ? 0 : t.baseSpeed * 0.28;
      }

      // Yield behind other traffic cars in front or crossing ahead
      for (let j = 0; j < this.traffic.length; j++) {
        if (i === j) continue;
        const o = this.traffic[j];
        const dx = o.x - t.x;
        const dz = o.z - t.z;
        const f = dx * fwdX + dz * fwdZ;
        const l = Math.abs(dx * fwdZ - dz * fwdX);
        if (f > 0 && f < 11.5 && l < 2.8) {
          targetSpeed = Math.min(targetSpeed, f < 6.4 ? 0 : Math.min(o.speed * 0.9, t.baseSpeed * 0.35));
        }
      }

      // Obey downtown traffic lights!
      if (!t.isAmbulance) {
        for (let l = 0; l < this.trafficLightRigs.length; l++) {
          const tl = this.trafficLightRigs[l];
          const isRed = t.axis === 'z' ? !this.nsGreen : this.nsGreen;
          if (isRed && Math.hypot(t.x - tl.x, t.z - tl.z) < 18) {
            targetSpeed = 0;
            break;
          }
        }
      }

      t.speed = THREE.MathUtils.damp(t.speed, targetSpeed, 7, dt);

      if (t.axis === 'z') {
        t.z += t.dir * t.speed * dt;
        if (t.z > 235) {
          const clear = !this.traffic.some(
            (o, idx) => idx !== i && Math.abs(o.x - t.x) < 3 && Math.abs(o.z - -235) < 8
          );
          if (clear) t.z = -235;
          else {
            t.z = 235;
            t.speed = 0;
          }
        }
        if (t.z < -235) {
          const clear = !this.traffic.some(
            (o, idx) => idx !== i && Math.abs(o.x - t.x) < 3 && Math.abs(o.z - 235) < 8
          );
          if (clear) t.z = 235;
          else {
            t.z = -235;
            t.speed = 0;
          }
        }
      } else {
        t.x += t.dir * t.speed * dt;
        if (t.x > 235) {
          const clear = !this.traffic.some(
            (o, idx) => idx !== i && Math.abs(o.z - t.z) < 3 && Math.abs(o.x - -235) < 8
          );
          if (clear) t.x = -235;
          else {
            t.x = 235;
            t.speed = 0;
          }
        }
        if (t.x < -235) {
          const clear = !this.traffic.some(
            (o, idx) => idx !== i && Math.abs(o.z - t.z) < 3 && Math.abs(o.x - 235) < 8
          );
          if (clear) t.x = 235;
          else {
            t.x = -235;
            t.speed = 0;
          }
        }
      }

      if ((t.isAmbulance || t.isPatrol) && t.rig.policeBarLeft && t.rig.policeBarRight) {
        (t.rig.policeBarLeft.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 4 : 0.4;
        (t.rig.policeBarRight.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.4 : 4;
      }

      t.rig.wheelSpinGroups.forEach((w) => (w.rotation.x -= t.speed * dt * 2.2));
    }
  }

  private updatePedestrians(dt: number): void {
    this.pedestrians.forEach((p) => {
      p.phase += dt * 5;
      p.x -= Math.sin(p.heading) * p.speed * dt;
      p.z -= Math.cos(p.heading) * p.speed * dt;
      if (Math.hypot(p.x, p.z) > 480) p.heading += Math.PI * 0.85;
      p.rig.root.position.set(p.x, groundHeightAt(p.x, p.z), p.z);
      p.rig.root.rotation.y = p.heading;
      const s = Math.sin(p.phase) * 0.45;
      p.rig.leftLeg.rotation.x = s;
      p.rig.rightLeg.rotation.x = -s;
      p.rig.leftArm.rotation.x = -s;
      p.rig.rightArm.rotation.x = s;
    });
  }

  private triggerWanted(level: number, charge: string): void {
    if (this.adminOverrides.noPolice) return;
    this.pendingCharges.add(charge);
    if (level > this.wantedLevel) {
      this.wantedLevel = level;
      this.showToast(`WANTED ${level}★ — ${charge}`, 3.0);
    }
    this.wantedCooldown = 14;
    this.syncPoliceCount();
  }

  private syncPoliceCount(): void {
    const desired = Math.min(3, this.wantedLevel);
    const cruiserSpec = CAR_CATALOG[4];
    while (this.police.length < desired) {
      const rig = buildCompositeCar(
        cruiserSpec,
        {
          paintColor: '#18181b',
          finish: 'gloss',
          rimColor: '#e4e4e7',
          spoiler: false,
          underglowColor: null,
        },
        this.textures.contactShadow,
        { isPolice: true, isTraffic: true }
      );
      const angle = Math.random() * Math.PI * 2;
      const sx = THREE.MathUtils.clamp(
        this.carX + Math.cos(angle) * 65,
        -WORLD_RADIUS + 40,
        WORLD_RADIUS - 40
      );
      const sz = THREE.MathUtils.clamp(
        this.carZ + Math.sin(angle) * 65,
        -WORLD_RADIUS + 40,
        WORLD_RADIUS - 40
      );
      rig.root.position.set(sx, groundHeightAt(sx, sz), sz);
      this.scene.add(rig.root);
      this.police.push({
        rig,
        x: sx,
        z: sz,
        heading: 0,
        speed: 24,
        halfW: cruiserSpec.width * 0.5,
        halfL: cruiserSpec.length * 0.5,
      });
    }
  }

  private updatePolice(dt: number, elapsedSec: number): void {
    if (this.policePaused) return;
    if (this.wantedLevel === 0 || this.adminOverrides.noPolice) {
      if (this.police.length > 0) this.clearPolice();
      this.wantedLevel = 0;
      this.bustTimer = 0;
      return;
    }

    const px = this.playerMode === 'driving' ? this.carX : this.walkX;
    const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
    let closestDist = Infinity;
    const flash = Math.floor(elapsedSec * 8) % 2 === 0;

    this.police.forEach((p) => {
      const dx = px - p.x;
      const dz = pz - p.z;
      const dist = Math.hypot(dx, dz);
      closestDist = Math.min(closestDist, dist);

      const targetHeading = Math.atan2(-dx, -dz);
      let diff = targetHeading - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += THREE.MathUtils.clamp(diff, -2.5 * dt, 2.5 * dt);

      const pursueSpeed = 30 + this.wantedLevel * 4.5;
      p.speed = pursueSpeed;
      p.x -= Math.sin(p.heading) * pursueSpeed * dt;
      p.z -= Math.cos(p.heading) * pursueSpeed * dt;

      const bRes = this.resolveBuildingColliders(p.x, p.z, p.halfW);
      p.x = bRes.x;
      p.z = bRes.z;

      p.rig.wheelSpinGroups.forEach((w) => (w.rotation.x -= pursueSpeed * dt * 2));

      if (p.rig.policeBarLeft && p.rig.policeBarRight) {
        (p.rig.policeBarLeft.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 4.5 : 0.3;
        (p.rig.policeBarRight.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.3 : 4.5;
      }
    });

    const playerSpeed = this.playerMode === 'driving' ? Math.hypot(this.velX, this.velZ) : 4;
    if (closestDist < 10.5 && playerSpeed < 4.5) {
      this.bustTimer += dt;
      if (this.bustTimer >= 3.2) {
        this.policePaused = true;
        this.velX = 0;
        this.velZ = 0;
        this.pendingCharges.add('Failure to Yield to Law Enforcement');
        this.callbacks.onPoliceStop(Array.from(this.pendingCharges), this.wantedLevel);
        return;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 1.5);
    }

    if (closestDist > 130) {
      this.wantedCooldown -= dt;
      if (this.wantedCooldown <= 0) {
        const reward = this.wantedLevel * 90;
        this.resolvePoliceStop();
        this.callbacks.onEscapedPolice(reward);
        this.showToast(`ESCAPED POLICE! +${reward} REP`, 3.0);
      }
    } else {
      this.wantedCooldown = 14;
    }
  }

  private resolveBuildingColliders(
    x: number,
    z: number,
    radius: number,
    bouncePlayer = true
  ): { x: number; z: number; impact: number } {
    let rx = x;
    let rz = z;
    let impact = 0;
    for (let i = 0; i < this.colliders.length; i++) {
      const b = this.colliders[i];
      const closestX = THREE.MathUtils.clamp(rx, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, b.minZ, b.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = radius - dist;
        rx += nx * overlap;
        rz += nz * overlap;
        if (bouncePlayer) {
          const impactDot = this.velX * nx + this.velZ * nz;
          if (impactDot < -2) {
            impact = Math.max(impact, Math.abs(impactDot) / 15);
            this.velX -= 1.4 * impactDot * nx;
            this.velZ -= 1.4 * impactDot * nz;
            this.velX *= 0.65;
            this.velZ *= 0.65;
          }
        }
      }
    }
    return { x: rx, z: rz, impact };
  }

  // Exact 2D Oriented Bounding Box (SAT) overlap test returning Minimum Translation Vector (B -> A)
  private testCarOBB(
    ax: number,
    az: number,
    aHead: number,
    aHw: number,
    aHl: number,
    bx: number,
    bz: number,
    bHead: number,
    bHw: number,
    bHl: number
  ): { nx: number; nz: number; overlap: number } | null {
    const dx = ax - bx;
    const dz = az - bz;
    const maxR = aHl + aHw + bHl + bHw;
    if (dx * dx + dz * dz > maxR * maxR) return null;

    const afx = -Math.sin(aHead);
    const afz = -Math.cos(aHead);
    const arx = Math.cos(aHead);
    const arz = -Math.sin(aHead);

    const bfx = -Math.sin(bHead);
    const bfz = -Math.cos(bHead);
    const brx = Math.cos(bHead);
    const brz = -Math.sin(bHead);

    let minPen = Infinity;
    let bestNx = 0;
    let bestNz = 0;

    const axes: Array<[number, number]> = [
      [afx, afz],
      [arx, arz],
      [bfx, bfz],
      [brx, brz],
    ];

    for (let k = 0; k < 4; k++) {
      const ux = axes[k][0];
      const uz = axes[k][1];
      const distProj = Math.abs(dx * ux + dz * uz);
      const rA = aHl * Math.abs(afx * ux + afz * uz) + aHw * Math.abs(arx * ux + arz * uz);
      const rB = bHl * Math.abs(bfx * ux + bfz * uz) + bHw * Math.abs(brx * ux + brz * uz);
      const pen = rA + rB - distProj;
      if (pen <= 0) return null;
      if (pen < minPen) {
        minPen = pen;
        const sign = dx * ux + dz * uz >= 0 ? 1 : -1;
        bestNx = ux * sign;
        bestNz = uz * sign;
      }
    }

    if (minPen <= 0 || !Number.isFinite(minPen)) return null;
    return { nx: bestNx, nz: bestNz, overlap: minPen };
  }

  private resolveAllVehicleCollisions(elapsedSec: number): void {
    const pHw = this.activeSpec.width * 0.5;
    const pHl = this.activeSpec.length * 0.5;
    const playerDriving = this.playerMode === 'driving';
    const trafficEnabled = !this.adminOverrides.trafficDisabled;
    let maxCrashSpeed = 0;

    // 3 iterative passes cleanly resolve multi-car pileups & side-by-side contact
    for (let iter = 0; iter < 3; iter++) {
      // 1. Player Car vs AI Traffic
      if (trafficEnabled) {
        for (let i = 0; i < this.traffic.length; i++) {
          const t = this.traffic[i];
          const hit = this.testCarOBB(
            this.carX,
            this.carZ,
            this.carHeading,
            pHw,
            pHl,
            t.x,
            t.z,
            t.heading,
            t.halfW,
            t.halfL
          );
          if (!hit) continue;
          const pShare = playerDriving ? 0.55 : 0.05;
          const tShare = 1 - pShare;
          this.carX += hit.nx * hit.overlap * pShare;
          this.carZ += hit.nz * hit.overlap * pShare;
          t.x -= hit.nx * hit.overlap * tShare;
          t.z -= hit.nz * hit.overlap * tShare;

          if (iter === 0 && playerDriving) {
            const tvx = -Math.sin(t.heading) * t.speed;
            const tvz = -Math.cos(t.heading) * t.speed;
            const rvn = (this.velX - tvx) * hit.nx + (this.velZ - tvz) * hit.nz;
            if (rvn < -0.5) {
              const impulse = -1.35 * rvn * 0.6;
              this.velX += hit.nx * impulse;
              this.velZ += hit.nz * impulse;
              this.velX *= 0.84;
              this.velZ *= 0.84;
              t.speed = Math.max(0, t.speed * 0.2);
              const relSpeed = Math.abs(rvn);
              maxCrashSpeed = Math.max(maxCrashSpeed, relSpeed);
              if (relSpeed > 12 && !this.activeRace && !this.policePaused && !this.adminOverrides.noPolice) {
                this.triggerWanted(
                  Math.min(5, Math.max(1, this.wantedLevel + 1)),
                  t.isPatrol ? 'Ramming a Police Cruiser' : 'Reckless Traffic Collision'
                );
              }
            }
          }
        }
      }

      // 2. Player Car vs Police Cruisers
      for (let i = 0; i < this.police.length; i++) {
        const p = this.police[i];
        const hit = this.testCarOBB(
          this.carX,
          this.carZ,
          this.carHeading,
          pHw,
          pHl,
          p.x,
          p.z,
          p.heading,
          p.halfW,
          p.halfL
        );
        if (!hit) continue;
        const pShare = playerDriving ? 0.5 : 0.1;
        this.carX += hit.nx * hit.overlap * pShare;
        this.carZ += hit.nz * hit.overlap * pShare;
        p.x -= hit.nx * hit.overlap * (1 - pShare);
        p.z -= hit.nz * hit.overlap * (1 - pShare);

        if (iter === 0 && playerDriving) {
          const pvx = -Math.sin(p.heading) * p.speed;
          const pvz = -Math.cos(p.heading) * p.speed;
          const rvn = (this.velX - pvx) * hit.nx + (this.velZ - pvz) * hit.nz;
          if (rvn < -0.5) {
            const impulse = -1.3 * rvn * 0.55;
            this.velX += hit.nx * impulse;
            this.velZ += hit.nz * impulse;
            this.velX *= 0.86;
            this.velZ *= 0.86;
            maxCrashSpeed = Math.max(maxCrashSpeed, Math.abs(rvn));
          }
        }
      }

      // 3. Player Car vs AI Race Opponents
      for (let i = 0; i < this.racers.length; i++) {
        const r = this.racers[i];
        const hit = this.testCarOBB(
          this.carX,
          this.carZ,
          this.carHeading,
          pHw,
          pHl,
          r.x,
          r.z,
          r.heading,
          r.halfW,
          r.halfL
        );
        if (!hit) continue;
        const pShare = playerDriving ? 0.5 : 0.05;
        this.carX += hit.nx * hit.overlap * pShare;
        this.carZ += hit.nz * hit.overlap * pShare;
        r.x -= hit.nx * hit.overlap * (1 - pShare);
        r.z -= hit.nz * hit.overlap * (1 - pShare);

        if (iter === 0 && playerDriving) {
          const rvx = -Math.sin(r.heading) * r.speed;
          const rvz = -Math.cos(r.heading) * r.speed;
          const rvn = (this.velX - rvx) * hit.nx + (this.velZ - rvz) * hit.nz;
          if (rvn < -0.5) {
            const impulse = -1.25 * rvn * 0.5;
            this.velX += hit.nx * impulse;
            this.velZ += hit.nz * impulse;
            r.speed = Math.max(4, r.speed * 0.85);
            maxCrashSpeed = Math.max(maxCrashSpeed, Math.abs(rvn));
          }
        }
      }

      // 4. Player Car vs Remote Online Multiplayer Cars
      this.remotePeers.forEach((peer) => {
        const rx = peer.rig.root.position.x;
        const rz = peer.rig.root.position.z;
        const rHead = peer.rig.root.rotation.y;
        const hit = this.testCarOBB(
          this.carX,
          this.carZ,
          this.carHeading,
          pHw,
          pHl,
          rx,
          rz,
          rHead,
          peer.halfW,
          peer.halfL
        );
        if (!hit) return;
        this.carX += hit.nx * hit.overlap;
        this.carZ += hit.nz * hit.overlap;
        if (iter === 0 && playerDriving) {
          const rvx = -Math.sin(rHead) * (peer.speedKmh / 3.6);
          const rvz = -Math.cos(rHead) * (peer.speedKmh / 3.6);
          const rvn = (this.velX - rvx) * hit.nx + (this.velZ - rvz) * hit.nz;
          if (rvn < -0.5) {
            const impulse = -1.3 * rvn;
            this.velX += hit.nx * impulse;
            this.velZ += hit.nz * impulse;
            this.velX *= 0.85;
            this.velZ *= 0.85;
            maxCrashSpeed = Math.max(maxCrashSpeed, Math.abs(rvn));
          }
        }
      });

      // 5. AI Traffic vs AI Traffic
      if (trafficEnabled) {
        for (let i = 0; i < this.traffic.length; i++) {
          const a = this.traffic[i];
          for (let j = i + 1; j < this.traffic.length; j++) {
            const b = this.traffic[j];
            const hit = this.testCarOBB(a.x, a.z, a.heading, a.halfW, a.halfL, b.x, b.z, b.heading, b.halfW, b.halfL);
            if (!hit) continue;
            a.x += hit.nx * hit.overlap * 0.5;
            a.z += hit.nz * hit.overlap * 0.5;
            b.x -= hit.nx * hit.overlap * 0.5;
            b.z -= hit.nz * hit.overlap * 0.5;
            if (iter === 0) {
              a.speed = Math.min(a.speed, 2);
              b.speed = Math.min(b.speed, 2);
            }
          }

          // Traffic vs Police
          for (let k = 0; k < this.police.length; k++) {
            const p = this.police[k];
            const hit = this.testCarOBB(a.x, a.z, a.heading, a.halfW, a.halfL, p.x, p.z, p.heading, p.halfW, p.halfL);
            if (!hit) continue;
            a.x += hit.nx * hit.overlap * 0.65;
            a.z += hit.nz * hit.overlap * 0.65;
            p.x -= hit.nx * hit.overlap * 0.35;
            p.z -= hit.nz * hit.overlap * 0.35;
            if (iter === 0) a.speed = Math.min(a.speed, 3);
          }

          // Traffic vs Racers
          for (let k = 0; k < this.racers.length; k++) {
            const r = this.racers[k];
            const hit = this.testCarOBB(a.x, a.z, a.heading, a.halfW, a.halfL, r.x, r.z, r.heading, r.halfW, r.halfL);
            if (!hit) continue;
            a.x += hit.nx * hit.overlap * 0.65;
            a.z += hit.nz * hit.overlap * 0.65;
            r.x -= hit.nx * hit.overlap * 0.35;
            r.z -= hit.nz * hit.overlap * 0.35;
            if (iter === 0) a.speed = Math.min(a.speed, 3);
          }
        }
      }

      // 6. Police vs Police
      for (let i = 0; i < this.police.length; i++) {
        for (let j = i + 1; j < this.police.length; j++) {
          const a = this.police[i];
          const b = this.police[j];
          const hit = this.testCarOBB(a.x, a.z, a.heading, a.halfW, a.halfL, b.x, b.z, b.heading, b.halfW, b.halfL);
          if (!hit) continue;
          a.x += hit.nx * hit.overlap * 0.5;
          a.z += hit.nz * hit.overlap * 0.5;
          b.x -= hit.nx * hit.overlap * 0.5;
          b.z -= hit.nz * hit.overlap * 0.5;
        }
      }

      // 7. Racers vs Racers
      for (let i = 0; i < this.racers.length; i++) {
        for (let j = i + 1; j < this.racers.length; j++) {
          const a = this.racers[i];
          const b = this.racers[j];
          const hit = this.testCarOBB(a.x, a.z, a.heading, a.halfW, a.halfL, b.x, b.z, b.heading, b.halfW, b.halfL);
          if (!hit) continue;
          a.x += hit.nx * hit.overlap * 0.5;
          a.z += hit.nz * hit.overlap * 0.5;
          b.x -= hit.nx * hit.overlap * 0.5;
          b.z -= hit.nz * hit.overlap * 0.5;
        }
      }

      // Keep player outside buildings if pushed by another vehicle
      const clampedPlayer = this.resolveBuildingColliders(this.carX, this.carZ, pHw * 1.04, false);
      this.carX = clampedPlayer.x;
      this.carZ = clampedPlayer.z;
    }

    if (maxCrashSpeed > 2.2 && elapsedSec - this.lastVehicleCrashTime > 0.28) {
      this.lastVehicleCrashTime = elapsedSec;
      this.sound.playCollision(maxCrashSpeed / 16);
      if (!this.adminOverrides.godMode && maxCrashSpeed > 8) {
        const dmg = Math.min(12, maxCrashSpeed * 0.35);
        this.activeOwned.condition = Math.max(0, this.activeOwned.condition - dmg);
        this.callbacks.onConsumptionUpdate(0, -dmg, 0);
      }
    }
  }

  private syncVehicleMeshes(): void {
    this.playerRig.root.position.set(this.carX, groundHeightAt(this.carX, this.carZ), this.carZ);
    this.playerRig.root.rotation.y = this.carHeading;

    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      t.rig.root.position.set(t.x, groundHeightAt(t.x, t.z), t.z);
    }

    for (let i = 0; i < this.police.length; i++) {
      const p = this.police[i];
      p.rig.root.position.set(p.x, groundHeightAt(p.x, p.z), p.z);
      p.rig.root.rotation.y = p.heading;
    }

    for (let i = 0; i < this.racers.length; i++) {
      const r = this.racers[i];
      r.rig.root.position.set(r.x, groundHeightAt(r.x, r.z), r.z);
      r.rig.root.rotation.y = r.heading;
    }
  }

  private updateRaceLogic(dt: number, raceLocked: boolean): void {
    if (!this.activeRace || !this.activeRace.active || !this.activeRaceDef) return;
    const race = this.activeRaceDef;
    const state = this.activeRace;

    if (!raceLocked) {
      this.racers.forEach((r, idx) => {
        if (r.finished) return;
        const wp = race.waypoints[r.waypointIdx];
        const dx = wp.x - r.x;
        const dz = wp.z - r.z;
        const dist = Math.hypot(dx, dz);

        const targetHeading = Math.atan2(-dx, -dz);
        let diff = targetHeading - r.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        r.heading += THREE.MathUtils.clamp(diff, -3.2 * dt, 3.2 * dt);

        const aiTopSpeed = (race.type === 'drag' ? 54 : 38) + idx * 2.2;
        r.speed = THREE.MathUtils.damp(r.speed, aiTopSpeed, 1.8, dt);
        r.x -= Math.sin(r.heading) * r.speed * dt;
        r.z -= Math.cos(r.heading) * r.speed * dt;
        r.rig.wheelSpinGroups.forEach((w) => (w.rotation.x -= r.speed * dt * 2));

        if (dist < 14) {
          r.waypointIdx++;
          if (r.waypointIdx >= race.waypoints.length) {
            if (r.lap < race.laps) {
              r.lap++;
              r.waypointIdx = 0;
            } else {
              r.finished = true;
            }
          }
        }
        r.progressScore = r.lap * 10000 + r.waypointIdx * 500 - dist;
      });
    }

    const currentWp = race.waypoints[state.checkpointIndex];
    const playerDist = Math.hypot(currentWp.x - this.carX, currentWp.z - this.carZ);
    const playerScore = state.lap * 10000 + state.checkpointIndex * 500 - playerDist;

    let aheadCount = 0;
    this.racers.forEach((r) => {
      if (r.finished || r.progressScore > playerScore) aheadCount++;
    });
    state.position = aheadCount + 1;

    if (playerDist < 15) {
      this.sound.playChime('checkpoint');
      if (state.checkpointIndex + 1 < race.waypoints.length) {
        state.checkpointIndex++;
      } else if (state.lap < race.laps) {
        state.lap++;
        state.checkpointIndex = 0;
        this.showToast(`Lap ${state.lap} / ${race.laps}`, 1.8);
      } else {
        state.active = false;
        state.finished = true;
        let place = state.position;
        if (race.type === 'drift' && race.targetDriftScore) {
          place = state.driftScore >= race.targetDriftScore ? 1 : 3;
        }
        state.resultPlace = place;
        const prize =
          place === 1
            ? race.prizeFirst
            : place === 2
            ? race.prizeSecond
            : place === 3
            ? race.prizeThird
            : 0;
        const rep = place <= 3 ? Math.round(race.repReward / place) : 25;
        state.prizeWon = prize;
        state.repWon = rep;
        this.sound.playChime('cash');
        this.checkpointMesh.visible = false;
        this.clearRaceOpponents();
        this.callbacks.onRaceFinished({ ...state });
        this.activeRace = null;
        this.activeRaceDef = null;
        return;
      }

      const nextWp = race.waypoints[state.checkpointIndex];
      this.checkpointMesh.position.set(
        nextWp.x,
        groundHeightAt(nextWp.x, nextWp.z),
        nextWp.z
      );
    }
  }

  private updateJobLogic(dt: number): void {
    if (!this.activeJob || !this.activeJobDef) return;
    const job = this.activeJob;
    job.remainingSec -= dt;

    if (job.remainingSec <= 0) {
      const title = job.title;
      this.activeJob = null;
      this.activeJobDef = null;
      if (!this.activeRace) this.checkpointMesh.visible = false;
      this.clearGpsTarget();
      this.callbacks.onJobFinished(false, 0, 0, title);
      this.showToast(`Job Failed: Time Expired on ${title}`, 3.0);
      return;
    }

    const px = this.playerMode === 'driving' ? this.carX : this.walkX;
    const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
    const dist = Math.hypot(px - job.targetX, pz - job.targetZ);

    if (dist < 14) {
      if (job.stage === 'pickup') {
        this.sound.playChime('checkpoint');
        job.stage = 'dropoff';
        job.targetX = this.activeJobDef.dropoff.x;
        job.targetZ = this.activeJobDef.dropoff.z;
        job.targetLabel = this.activeJobDef.dropoff.label;
        this.checkpointMesh.position.set(
          job.targetX,
          groundHeightAt(job.targetX, job.targetZ),
          job.targetZ
        );
        this.setGpsTarget(job.targetX, job.targetZ, job.targetLabel);
        this.showToast(`Picked up! Deliver to ${job.targetLabel}`);
      } else {
        this.sound.playChime('cash');
        const payout = job.payout;
        const rep = job.repReward;
        const title = job.title;
        this.activeJob = null;
        this.activeJobDef = null;
        if (!this.activeRace) this.checkpointMesh.visible = false;
        this.clearGpsTarget();
        this.callbacks.onJobFinished(true, payout, rep, title);
        this.showToast(`Job Complete! +$${payout.toLocaleString()} · +${rep} REP`, 3.5);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      } else {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        const t = p.life / p.maxLife;
        p.mesh.scale.setScalar(1 + t * 2.2);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
      }
    }
  }

  private updateCamera(dt: number): void {
    const speedKmh = Math.hypot(this.velX, this.velZ) * 3.6;

    if (this.playerMode === 'walking') {
      const backDist = 5.2;
      const desiredX = this.walkX + Math.sin(this.walkHeading) * backDist;
      const desiredZ = this.walkZ + Math.cos(this.walkHeading) * backDist;
      const desiredY = groundHeightAt(this.walkX, this.walkZ) + 2.8;
      _v1.set(desiredX, desiredY, desiredZ);
      this.camPos.lerp(_v1, 1 - Math.exp(-8 * dt));
      _v2.set(this.walkX, groundHeightAt(this.walkX, this.walkZ) + 1.4, this.walkZ);
      this.camTarget.lerp(_v2, 1 - Math.exp(-12 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camTarget);
      this.currentFov = THREE.MathUtils.damp(this.currentFov, 60, 6, dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.cameraMode === 'cockpit') {
      this.playerRig.cockpitAnchor.getWorldPosition(_v1);
      this.playerRig.cockpitLookAt.getWorldPosition(_v2);
      this.camera.position.copy(_v1);
      this.camera.lookAt(_v2);
      const targetFov = 68 + Math.min(14, speedKmh * 0.05);
      this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 6, dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.cameraMode === 'hood') {
      this.playerRig.hoodAnchor.getWorldPosition(_v1);
      this.playerRig.hoodLookAt.getWorldPosition(_v2);
      this.camera.position.copy(_v1);
      this.camera.lookAt(_v2);
      const targetFov = 66 + Math.min(16, speedKmh * 0.06);
      this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 6, dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
      return;
    }

    const backDist = this.cameraMode === 'far' ? 11.2 : 7.6;
    const heightOff = this.cameraMode === 'far' ? 4.4 : 3.05;
    const desiredX = this.carX + Math.sin(this.carHeading) * backDist;
    const desiredZ = this.carZ + Math.cos(this.carHeading) * backDist;
    const groundY = groundHeightAt(this.carX, this.carZ);
    const desiredY = Math.max(groundHeightAt(desiredX, desiredZ) + 1.5, groundY + heightOff);

    _v1.set(desiredX, desiredY, desiredZ);
    this.camPos.lerp(_v1, 1 - Math.exp(-7.5 * dt));

    const lookAhead = 6;
    _v3.set(
      this.carX - Math.sin(this.carHeading) * lookAhead,
      groundY + 1.25,
      this.carZ - Math.cos(this.carHeading) * lookAhead
    );
    this.camTarget.lerp(_v3, 1 - Math.exp(-12 * dt));

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    const targetFov = 60 + Math.min(18, speedKmh * 0.065);
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 5, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }

  private findNearbyPrompt(): HudTelemetry['nearbyPrompt'] {
    const px = this.playerMode === 'driving' ? this.carX : this.walkX;
    const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;

    if (this.playerMode === 'walking') {
      const carDist = Math.hypot(px - this.carX, pz - this.carZ);
      if (carDist < 5.5) {
        return { label: `Enter ${this.activeSpec.name}`, actionType: 'vehicle' };
      }
    }

    for (let i = 0; i < WORLD_LANDMARKS.length; i++) {
      const lm = WORLD_LANDMARKS[i];
      if (lm.type === 'hidden') continue;
      if (Math.hypot(px - lm.x, pz - lm.z) < 11.5) {
        return { label: lm.name, actionType: lm.type, landmarkId: lm.id };
      }
    }
    return null;
  }

  private emitTelemetry(): void {
    const speedKmh =
      this.playerMode === 'driving' ? Math.round(Math.hypot(this.velX, this.velZ) * 3.6) : 0;
    const px = this.playerMode === 'driving' ? this.carX : this.walkX;
    const pz = this.playerMode === 'driving' ? this.carZ : this.walkZ;
    const heading = this.playerMode === 'driving' ? this.carHeading : this.walkHeading;

    const entities: MinimapEntity[] = [];
    this.traffic.forEach((t) =>
      entities.push({
        x: t.x,
        z: t.z,
        kind: t.isAmbulance ? 'ambulance' : t.isPatrol ? 'police' : 'traffic',
      })
    );
    this.police.forEach((p) => entities.push({ x: p.x, z: p.z, kind: 'police' }));
    this.racers.forEach((r) => entities.push({ x: r.x, z: r.z, kind: 'racer' }));
    this.remotePeers.forEach((peer) =>
      entities.push({ x: peer.targetX, z: peer.targetZ, kind: 'remotePlayer', color: '#22d3ee' })
    );
    WORLD_LANDMARKS.forEach((lm) =>
      entities.push({ x: lm.x, z: lm.z, kind: 'landmark', color: lm.color, label: lm.name })
    );

    this.callbacks.onTelemetry({
      speedKmh,
      rpm: Math.round(this.rpm),
      maxRpm: 8500,
      gear: this.gear,
      nitro: Math.round(this.nitro),
      isDrifting: this.isDrifting,
      currentDriftPoints: this.currentDriftPoints,
      playerMode: this.playerMode,
      cameraMode: this.cameraMode,
      playerX: px,
      playerY: groundHeightAt(px, pz),
      playerZ: pz,
      playerHeading: heading,
      surface: getSurfaceType(px, pz),
      wantedLevel: this.wantedLevel,
      wantedCooldownPct:
        this.wantedLevel > 0 ? Math.round((this.wantedCooldown / 14) * 100) : 0,
      bustProgressPct: Math.round((this.bustTimer / 3.2) * 100),
      nearbyPrompt: this.findNearbyPrompt(),
      gpsTarget: this.gpsTarget,
      activeRace: this.activeRace ? { ...this.activeRace } : null,
      activeJob: this.activeJob ? { ...this.activeJob } : null,
      activeRandomEvent: this.activeRandomEvent ? { ...this.activeRandomEvent } : null,
      minimapEntities: entities,
      clockHour: this.clockHour,
      weather: this.graphics.weather,
      toastMessage: this.toastMessage,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
