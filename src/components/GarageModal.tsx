import React, { useState } from 'react';
import { Wrench, X } from 'lucide-react';
import { PAINT_SWATCHES, UNDERGLOW_SWATCHES } from '../data/worldData';
import {
  CarCustomization,
  CarSpec,
  CarUpgrades,
  OwnedCar,
  PaintFinish,
  PlayerEconomyState,
} from '../types/game';

interface GarageModalProps {
  economy: PlayerEconomyState;
  activeSpec: CarSpec;
  activeCar: OwnedCar;
  onClose: () => void;
  onUpgradePart: (part: keyof CarUpgrades, cost: number) => void;
  onCustomize: (custom: Partial<CarCustomization>, cost: number) => void;
  onRepairAndService: (cost: number) => void;
}

const UPGRADE_PARTS: Array<{
  key: keyof CarUpgrades;
  label: string;
  desc: string;
}> = [
  { key: 'engine', label: 'Engine Block & ECU', desc: 'Boosts top speed and torque' },
  { key: 'turbo', label: 'Twin-Scroll Turbo', desc: 'Stronger acceleration & nitro capacity' },
  { key: 'transmission', label: '6-Speed Sequential', desc: 'Sharper gearing and top-end pull' },
  { key: 'tires', label: 'Semi-Slick Compounds', desc: 'Higher cornering grip & launch traction' },
  { key: 'suspension', label: 'Coilover Suspension', desc: 'Stability over curbs, hills & drifts' },
  { key: 'brakes', label: 'Carbon-Ceramic Brakes', desc: 'Shorter stopping distance into hairpins' },
];

export const GarageModal: React.FC<GarageModalProps> = ({
  economy,
  activeSpec,
  activeCar,
  onClose,
  onUpgradePart,
  onCustomize,
  onRepairAndService,
}) => {
  const [tab, setTab] = useState<'upgrades' | 'visuals' | 'maintenance'>('upgrades');
  const totalFunds = economy.cash + economy.bank;
  const repairCost = Math.round(
    (100 - activeCar.condition) * 18 +
      (100 - activeCar.tireHealth) * 8 +
      (100 - activeCar.oilHealth) * 6
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Wrench className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Velocity Customs — {activeSpec.brand} {activeSpec.name}
              </h2>
              <p className="text-xs text-zinc-400">
                Available Funds: ${totalFunds.toLocaleString()} · Odometer:{' '}
                {activeCar.mileageKm.toFixed(1)} km
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="mt-4 flex gap-2 border-b border-white/10 pb-3">
          {(['upgrades', 'visuals', 'maintenance'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize cursor-pointer ${
                tab === t
                  ? 'bg-cyan-500 text-zinc-950'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'upgrades' && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {UPGRADE_PARTS.map((p) => {
              const lvl = activeCar.upgrades[p.key];
              const isMax = lvl >= 4;
              const cost = lvl * 2400;
              const canAfford = totalFunds >= cost;

              return (
                <div
                  key={p.key}
                  className="rounded-xl border border-white/10 bg-zinc-900/70 p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        {p.label}
                      </span>
                      <span className="font-telemetry text-xs text-cyan-400">
                        LVL {lvl}/4
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{p.desc}</p>
                    <div className="mt-2.5 flex gap-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 flex-1 rounded ${
                            step <= lvl ? 'bg-cyan-400' : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isMax || !canAfford}
                    onClick={() => onUpgradePart(p.key, cost)}
                    className={`rounded-lg py-2 text-xs font-bold ${
                      isMax
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : canAfford
                        ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? 'Maxed Out' : `Upgrade · $${cost.toLocaleString()}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'visuals' && (
          <div className="mt-4 space-y-5">
            <div>
              <div className="text-xs font-semibold text-zinc-300 mb-2">
                Body Paint Color ($350)
              </div>
              <div className="flex flex-wrap gap-2.5">
                {PAINT_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    onClick={() => onCustomize({ paintColor: sw.hex }, 350)}
                    title={sw.name}
                    className={`h-9 w-9 rounded-lg border-2 cursor-pointer ${
                      activeCar.customization.paintColor === sw.hex
                        ? 'border-white scale-110'
                        : 'border-white/20'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-300 mb-2">
                Paint Finish ($450)
              </div>
              <div className="flex gap-2">
                {(['gloss', 'metallic', 'matte'] as PaintFinish[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => onCustomize({ finish: f }, 450)}
                    className={`rounded-lg border px-4 py-2 text-xs font-semibold capitalize cursor-pointer ${
                      activeCar.customization.finish === f
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                        : 'border-white/10 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-300 mb-2">
                Alloy Rim Finish ($400)
              </div>
              <div className="flex gap-2.5">
                {['#e4e4e7', '#18181b', '#f59e0b', '#06b6d4', '#e11d48'].map((rc) => (
                  <button
                    key={rc}
                    type="button"
                    onClick={() => onCustomize({ rimColor: rc }, 400)}
                    className={`h-8 w-8 rounded-full border-2 cursor-pointer ${
                      activeCar.customization.rimColor === rc
                        ? 'border-white scale-110'
                        : 'border-white/25'
                    }`}
                    style={{ backgroundColor: rc }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-zinc-300 mb-2">
                  GT Carbon Rear Wing ($900)
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onCustomize({ spoiler: !activeCar.customization.spoiler }, 900)
                  }
                  className="rounded-lg border border-white/15 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
                >
                  {activeCar.customization.spoiler ? 'Remove Spoiler' : 'Install GT Wing'}
                </button>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-300 mb-2">
                  Underglow Neon Kit ($650)
                </div>
                <div className="flex flex-wrap gap-2">
                  {UNDERGLOW_SWATCHES.map((u) => (
                    <button
                      key={u.name}
                      type="button"
                      onClick={() => onCustomize({ underglowColor: u.hex }, 650)}
                      className={`rounded-lg border px-3 py-1.5 text-xs cursor-pointer ${
                        activeCar.customization.underglowColor === u.hex
                          ? 'border-amber-400 bg-zinc-800 text-white'
                          : 'border-white/10 bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="text-xs text-zinc-400">Chassis Condition</div>
                <div className="mt-1 font-telemetry text-2xl font-bold text-amber-400">
                  {Math.round(activeCar.condition)}%
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="text-xs text-zinc-400">Tire Tread</div>
                <div className="mt-1 font-telemetry text-2xl font-bold text-cyan-400">
                  {Math.round(activeCar.tireHealth)}%
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="text-xs text-zinc-400">Oil & Tune</div>
                <div className="mt-1 font-telemetry text-2xl font-bold text-emerald-400">
                  {Math.round(activeCar.oilHealth)}%
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={repairCost <= 0 || totalFunds < repairCost}
              onClick={() => onRepairAndService(repairCost)}
              className={`w-full rounded-xl py-3 text-sm font-bold ${
                repairCost <= 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : totalFunds >= repairCost
                  ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {repairCost <= 0
                ? 'Vehicle in 100% Mint Condition'
                : `Full Repair & Service · $${repairCost.toLocaleString()}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
