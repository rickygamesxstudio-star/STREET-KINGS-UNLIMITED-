import React, { useRef, useState } from 'react';
import {
  Crosshair,
  Globe,
  MapPin,
  Navigation,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { WORLD_LANDMARKS } from '../data/worldData';
import {
  HudTelemetry,
  LandmarkType,
  RemotePlayerState,
  WorldLandmark,
} from '../types/game';
import { RealWorldMapsPanel } from './RealWorldMapsPanel';

interface WorldMapModalProps {
  initialTab?: 'city' | 'google';
  telemetry: HudTelemetry;
  remotePlayers: RemotePlayerState[];
  discoveredHiddenIds: string[];
  onClose: () => void;
  onSetGps: (x: number, z: number, label: string) => void;
  onFastTravel: (lm: WorldLandmark) => void;
}

const FILTER_OPTIONS: Array<{ id: 'all' | LandmarkType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'race', label: 'Races' },
  { id: 'dealership', label: 'Dealers' },
  { id: 'garage', label: 'Garages' },
  { id: 'gas', label: 'Fuel' },
  { id: 'police', label: 'Police' },
  { id: 'property', label: 'Properties' },
  { id: 'hidden', label: 'Hidden' },
];

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  initialTab = 'city',
  telemetry,
  remotePlayers,
  discoveredHiddenIds,
  onClose,
  onSetGps,
  onFastTravel,
}) => {
  const [mapTab, setMapTab] = useState<'city' | 'google'>(initialTab);
  const [zoom, setZoom] = useState(1.15);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [filter, setFilter] = useState<'all' | LandmarkType>('all');
  const draggingRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number; moved: boolean }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    moved: false,
  });

  const mapSize = 600;
  const worldSpan = 1600; // -800 .. +800
  const toPx = (val: number) => ((val + 800) / worldSpan) * mapSize;
  const toWorld = (px: number) => (px / mapSize) * worldSpan - 800;

  const visibleLandmarks = WORLD_LANDMARKS.filter(
    (lm) => filter === 'all' || lm.type === filter
  );

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingRef.current.moved) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * mapSize;
    const relY = ((e.clientY - rect.top) / rect.height) * mapSize;
    const wx = Math.round(toWorld(relX));
    const wz = Math.round(toWorld(relY));
    onSetGps(wx, wz, `Custom Pin (${wx}, ${wz})`);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-zinc-950 p-5 shadow-2xl max-h-[94vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Jamaica World GPS &amp; Real-World Maps Hub
            </h2>
            <p className="text-xs text-zinc-400">
              Switch between your Street Kings Jamaica 3D GPS radar and live Google Maps Platform routing &amp; AI Grounding
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-zinc-900 p-1 text-xs">
              <button
                type="button"
                onClick={() => setMapTab('city')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                  mapTab === 'city'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" /> City GPS
              </button>
              <button
                type="button"
                onClick={() => setMapTab('google')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                  mapTab === 'google'
                    ? 'bg-cyan-500 text-zinc-950'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> Google Maps & AI
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mapTab === 'google' ? (
          <div className="mt-4">
            <RealWorldMapsPanel />
          </div>
        ) : (
        <>
        {/* Category Filters & Zoom Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  filter === f.id
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
              className="rounded-lg border border-white/10 bg-zinc-900 p-1.5 text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="font-telemetry text-xs text-zinc-300 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3.5, +(z + 0.25).toFixed(2)))}
              className="rounded-lg border border-white/10 bg-zinc-900 p-1.5 text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1.15);
                setPan({ x: 0, y: 0 });
              }}
              className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer flex items-center gap-1"
            >
              <Crosshair className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Draggable Zoomable SVG Map */}
          <div className="lg:col-span-7">
            <div
              className="relative rounded-xl border border-white/15 bg-zinc-900 overflow-hidden w-full aspect-square cursor-grab active:cursor-grabbing"
              onWheel={(e) => {
                e.preventDefault();
                setZoom((z) =>
                  Math.min(3.5, Math.max(0.75, +(z + (e.deltaY < 0 ? 0.15 : -0.15)).toFixed(2)))
                );
              }}
              onPointerDown={(e) => {
                draggingRef.current = {
                  active: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  origX: pan.x,
                  origY: pan.y,
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                if (!draggingRef.current.active) return;
                const dx = e.clientX - draggingRef.current.startX;
                const dy = e.clientY - draggingRef.current.startY;
                if (Math.hypot(dx, dy) > 4) draggingRef.current.moved = true;
                setPan({ x: draggingRef.current.origX + dx, y: draggingRef.current.origY + dy });
              }}
              onPointerUp={() => {
                draggingRef.current.active = false;
              }}
              onPointerLeave={() => {
                draggingRef.current.active = false;
              }}
            >
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  width: '100%',
                  height: '100%',
                }}
              >
                <svg
                  viewBox={`0 0 ${mapSize} ${mapSize}`}
                  className="w-full h-full block"
                  onClick={handleSvgClick}
                >
                  <rect width={mapSize} height={mapSize} fill="#1b3022" />
                  {/* Blue Mountains Range */}
                  <rect x={0} y={0} width={toPx(-60)} height={toPx(-275)} fill="#23402c" />
                  <text x={toPx(-520)} y={toPx(-470)} fill="#a3e635" fontSize="11" fontWeight="700">
                    BLUE MOUNTAINS &amp; FERN GULLY
                  </text>

                  {/* New Kingston Urban Grid */}
                  <rect
                    x={toPx(-265)}
                    y={toPx(-270)}
                    width={toPx(265) - toPx(-265)}
                    height={toPx(255) - toPx(-270)}
                    fill="#18181b"
                  />
                  {/* Beverly Hills & Cherry Gardens / Mona */}
                  <rect
                    x={toPx(270)}
                    y={toPx(-420)}
                    width={toPx(520) - toPx(270)}
                    height={toPx(245) - toPx(-420)}
                    fill="#213b29"
                  />
                  <text x={toPx(295)} y={toPx(-340)} fill="#fbbf24" fontSize="10" fontWeight="700">
                    BEVERLY HILLS
                  </text>
                  <text x={toPx(305)} y={toPx(40)} fill="#cbd5e1" fontSize="10" fontWeight="700">
                    MONA &amp; PAPINE
                  </text>

                  {/* Hellshire Sand & Caribbean Sea */}
                  <rect x={0} y={toPx(280)} width={mapSize} height={mapSize - toPx(280)} fill="#c2a878" />
                  <rect x={toPx(530)} y={0} width={mapSize - toPx(530)} height={mapSize} fill="#c2a878" />
                  <rect x={0} y={toPx(320)} width={mapSize} height={mapSize - toPx(320)} fill="#0e7490" />
                  <rect x={toPx(570)} y={0} width={mapSize - toPx(570)} height={mapSize} fill="#0e7490" />

                  {/* Roads */}
                  {[-240, -160, -80, 0, 80, 160, 240].map((c) => (
                    <g key={c}>
                      <line x1={toPx(c)} y1={toPx(-260)} x2={toPx(c)} y2={toPx(245)} stroke="#3f3f46" strokeWidth="3.5" />
                      {c !== -240 && (
                        <line x1={toPx(-250)} y1={toPx(c)} x2={toPx(250)} y2={toPx(c)} stroke="#3f3f46" strokeWidth="3.5" />
                      )}
                    </g>
                  ))}

                  {/* Highways, Airport, Tunnel, Bridge */}
                  <line x1={toPx(-380)} y1={toPx(-260)} x2={toPx(480)} y2={toPx(-260)} stroke="#52525b" strokeWidth="5.5" />
                  <line x1={toPx(-520)} y1={toPx(240)} x2={toPx(480)} y2={toPx(240)} stroke="#52525b" strokeWidth="5.5" />
                  <line x1={toPx(-310)} y1={toPx(-260)} x2={toPx(-310)} y2={toPx(245)} stroke="#52525b" strokeWidth="5.5" />
                  <line x1={toPx(310)} y1={toPx(-420)} x2={toPx(310)} y2={toPx(245)} stroke="#52525b" strokeWidth="5.5" />
                  <line x1={toPx(400)} y1={toPx(-420)} x2={toPx(400)} y2={toPx(240)} stroke="#52525b" strokeWidth="4" />
                  <line x1={toPx(-240)} y1={toPx(-540)} x2={toPx(-240)} y2={toPx(-250)} stroke="#71717a" strokeWidth="4.5" />
                  <line x1={toPx(0)} y1={toPx(240)} x2={toPx(0)} y2={toPx(345)} stroke="#f59e0b" strokeWidth="4.5" />
                  <line x1={toPx(-730)} y1={toPx(160)} x2={toPx(-340)} y2={toPx(160)} stroke="#64748b" strokeWidth="10" />
                  <text x={toPx(-700)} y={toPx(135)} fill="#38bdf8" fontSize="9.5" fontWeight="700">
                    NORMAN MANLEY (KIN)
                  </text>

                  {/* Calculated GPS Route Line */}
                  {telemetry.gpsTarget?.routePoints && telemetry.gpsTarget.routePoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="3"
                      strokeDasharray="5 4"
                      points={telemetry.gpsTarget.routePoints
                        .map((pt) => `${toPx(pt.x)},${toPx(pt.z)}`)
                        .join(' ')}
                    />
                  )}

                  {/* Landmarks */}
                  {visibleLandmarks.map((lm) => {
                    const isHidden = lm.type === 'hidden';
                    const discovered = discoveredHiddenIds.includes(lm.id);
                    return (
                      <g
                        key={lm.id}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetGps(lm.x, lm.z, lm.name);
                        }}
                      >
                        <circle
                          cx={toPx(lm.x)}
                          cy={toPx(lm.z)}
                          r={isHidden && !discovered ? 4.5 : 5.5}
                          fill={lm.color}
                          stroke="#09090b"
                          strokeWidth="1.5"
                          opacity={isHidden && !discovered ? 0.65 : 1}
                        />
                        <title>{lm.name}</title>
                      </g>
                    );
                  })}

                  {/* Active Random Event */}
                  {telemetry.activeRandomEvent && (
                    <circle
                      cx={toPx(telemetry.activeRandomEvent.x)}
                      cy={toPx(telemetry.activeRandomEvent.z)}
                      r={7}
                      fill="#10b981"
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Multiplayer Remote Players */}
                  {remotePlayers.map((rp) => (
                    <g key={rp.playerId}>
                      <circle cx={toPx(rp.x)} cy={toPx(rp.z)} r={5.5} fill="#22d3ee" stroke="#000" strokeWidth="1.2" />
                      <text x={toPx(rp.x) + 7} y={toPx(rp.z) + 3} fill="#22d3ee" fontSize="9" fontWeight="700">
                        {rp.name}
                      </text>
                    </g>
                  ))}

                  {/* Player Arrow */}
                  <g
                    transform={`translate(${toPx(telemetry.playerX)}, ${toPx(
                      telemetry.playerZ
                    )}) rotate(${(-telemetry.playerHeading * 180) / Math.PI})`}
                  >
                    <polygon points="0,-8 5.5,6 0,2.5 -5.5,6" fill="#f59e0b" stroke="#000" strokeWidth="1" />
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Landmark Directory */}
          <div className="lg:col-span-5 space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {visibleLandmarks.map((lm) => (
              <div
                key={lm.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900/70 p-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: lm.color }} />
                    <span className="truncate text-xs font-semibold text-white">
                      {lm.name}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400 truncate">
                    {lm.district} · {lm.type.toUpperCase()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSetGps(lm.x, lm.z, lm.name)}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/15 cursor-pointer"
                  >
                    <Navigation className="h-3 w-3" /> Route
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onFastTravel(lm);
                      onClose();
                    }}
                    className="flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                  >
                    <Zap className="h-3 w-3" /> Go
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
