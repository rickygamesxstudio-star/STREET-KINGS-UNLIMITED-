import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ControlsModalProps {
  onClose: () => void;
}

const KEY_BINDINGS = [
  ['W / ↑', 'Accelerate (or Walk Forward)'],
  ['S / ↓', 'Brake / Reverse (or Walk Backward)'],
  ['A / D', 'Steer Left / Right (or Turn on Foot)'],
  ['SPACE', 'Handbrake / Drift (or Sprint on Foot)'],
  ['SHIFT', 'Nitro Boost'],
  ['C', 'Cycle Camera (Chase · Far · Cockpit · Hood)'],
  ['E', 'Enter / Exit Car or Open Nearby Shop/Race'],
  ['R', 'Reset Car Upright onto Roadway'],
  ['M', 'Open Jamaica GPS & Real-World Google Maps Hub'],
  ['G', 'Open Gemini AI Co-Pilot & Voice Strategist'],
  ['P', 'Open In-Game Smartphone (Apps, GPS, Multiplayer, Settings)'],
  ['~ / F9', 'Open Admin Control Console (Enter Admin Code)'],
  ['H', 'Sound Car Horn'],
];

export const ControlsModal: React.FC<ControlsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-white">
              Driving & Exploration Controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {KEY_BINDINGS.map(([key, action]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-zinc-900/70 px-3 py-2 text-xs"
            >
              <span className="rounded bg-zinc-800 border border-white/15 px-2 py-0.5 font-telemetry font-bold text-amber-400">
                {key}
              </span>
              <span className="text-zinc-200">{action}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          On mobile or touchscreens, tap the Gamepad icon in the bottom dock to enable on-screen steering and pedals.
        </p>
      </div>
    </div>
  );
};
