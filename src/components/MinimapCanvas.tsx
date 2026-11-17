import React, { useEffect, useRef } from 'react';
import { HudTelemetry } from '../types/game';

interface MinimapCanvasProps {
  telemetry: HudTelemetry;
  onOpenFullMap: () => void;
}

export const MinimapCanvas: React.FC<MinimapCanvasProps> = ({
  telemetry,
  onOpenFullMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 168;
    const half = size / 2;
    const scale = 0.28;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(telemetry.playerHeading);
    ctx.translate(-telemetry.playerX * scale, -telemetry.playerZ * scale);

    // Ocean / Beach
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(-1050 * scale, 320 * scale, 2100 * scale, 700 * scale);
    ctx.fillRect(560 * scale, -1050 * scale, 500 * scale, 2100 * scale);

    ctx.fillStyle = '#786240';
    ctx.fillRect(-500 * scale, 280 * scale, 1080 * scale, 45 * scale);

    // Mountains NW
    ctx.fillStyle = '#263529';
    ctx.fillRect(-750 * scale, -750 * scale, 620 * scale, 460 * scale);

    // City Roads Grid
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4;
    const gridCoords = [-240, -160, -80, 0, 80, 160, 240];
    gridCoords.forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(c * scale, -260 * scale);
      ctx.lineTo(c * scale, 245 * scale);
      ctx.stroke();

      if (c !== -240) {
        ctx.beginPath();
        ctx.moveTo(-250 * scale, c * scale);
        ctx.lineTo(250 * scale, c * scale);
        ctx.stroke();
      }
    });

    // Highways, Luxury/Suburb roads, Tunnel & Airport Runway
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 6;
    const drawSeg = (x1: number, z1: number, x2: number, z2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1 * scale, z1 * scale);
      ctx.lineTo(x2 * scale, z2 * scale);
      ctx.stroke();
    };
    drawSeg(-380, -260, 480, -260);
    drawSeg(-520, 240, 480, 240);
    drawSeg(-310, -260, -310, 245);
    drawSeg(310, -420, 310, 245);
    drawSeg(400, -420, 400, 240);
    drawSeg(-240, -540, -240, -250);
    drawSeg(0, 240, 0, 345);

    // Airport Runway
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 10;
    drawSeg(-730, 160, -340, 160);

    // GPS Route Line
    if (telemetry.gpsTarget?.routePoints && telemetry.gpsTarget.routePoints.length > 1) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      telemetry.gpsTarget.routePoints.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x * scale, pt.z * scale);
        else ctx.lineTo(pt.x * scale, pt.z * scale);
      });
      ctx.stroke();
    }

    // Entities
    telemetry.minimapEntities.forEach((ent) => {
      const ex = ent.x * scale;
      const ez = ent.z * scale;
      if (ent.kind === 'landmark') {
        ctx.fillStyle = ent.color || '#f59e0b';
        ctx.beginPath();
        ctx.arc(ex, ez, 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.kind === 'traffic') {
        ctx.fillStyle = '#a1a1aa';
        ctx.fillRect(ex - 1.5, ez - 1.5, 3, 3);
      } else if (ent.kind === 'ambulance') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(ex - 2, ez - 2, 4, 4);
      } else if (ent.kind === 'racer') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(ex, ez, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.kind === 'remotePlayer') {
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(ex, ez, 3.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.kind === 'police') {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ez, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Random World Event Marker
    if (telemetry.activeRandomEvent) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(
        telemetry.activeRandomEvent.x * scale,
        telemetry.activeRandomEvent.z * scale,
        5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // GPS Pin
    if (telemetry.gpsTarget) {
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(telemetry.gpsTarget.x * scale, telemetry.gpsTarget.z * scale, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Player Center Arrow
    ctx.save();
    ctx.translate(half, half);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [telemetry]);

  return (
    <button
      type="button"
      onClick={onOpenFullMap}
      title="Open Zoomable World Map (M)"
      className="relative group rounded-xl overflow-hidden border border-white/15 bg-zinc-950/90 shadow-lg cursor-pointer"
      style={{ width: 168, height: 168 }}
    >
      <canvas ref={canvasRef} width={168} height={168} className="block w-full h-full" />
      <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-telemetry uppercase tracking-wider text-zinc-300 pointer-events-none">
        <span>{telemetry.surface}</span>
        <span className="text-amber-400">Map [M]</span>
      </div>
      {telemetry.gpsTarget && (
        <div className="absolute bottom-1.5 left-2 right-2 truncate text-[10px] font-medium text-cyan-300 bg-zinc-950/85 px-1.5 py-0.5 rounded pointer-events-none">
          GPS: {telemetry.gpsTarget.label}
        </div>
      )}
    </button>
  );
};
