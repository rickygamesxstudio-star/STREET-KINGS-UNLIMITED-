import React from 'react';
import { Fuel, Wrench, X } from 'lucide-react';
import { OwnedCar, PlayerEconomyState } from '../types/game';

interface GasStationModalProps {
  economy: PlayerEconomyState;
  activeCar: OwnedCar;
  onClose: () => void;
  onRefuel: (cost: number) => void;
  onQuickRepair: (cost: number) => void;
}

export const GasStationModal: React.FC<GasStationModalProps> = ({
  economy,
  activeCar,
  onClose,
  onRefuel,
  onQuickRepair,
}) => {
  const totalFunds = economy.cash + economy.bank;
  const fuelNeeded = Math.max(0, 100 - activeCar.fuel);
  const fuelCost = Math.round(fuelNeeded * 2.5);
  const repairNeeded = Math.max(0, 100 - activeCar.condition);
  const repairCost = Math.round(repairNeeded * 16);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Fuel className="h-5 w-5 text-emerald-400" />
            <h2 className="font-display text-lg font-bold text-white">
              PetroMax Service Station
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

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Fuel Tank Level</span>
              <span className="font-telemetry text-emerald-400 font-bold">
                {Math.round(activeCar.fuel)}%
              </span>
            </div>
            <div className="h-2 rounded bg-zinc-800 overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${Math.round(activeCar.fuel)}%` }}
              />
            </div>
            <button
              type="button"
              disabled={fuelNeeded < 1 || totalFunds < fuelCost}
              onClick={() => onRefuel(fuelCost)}
              className="w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
            >
              {fuelNeeded < 1
                ? 'Tank Full'
                : `Fill Tank · $${fuelCost.toLocaleString()}`}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Roadside Body & Engine Repair</span>
              <span className="font-telemetry text-amber-400 font-bold">
                {Math.round(activeCar.condition)}%
              </span>
            </div>
            <div className="h-2 rounded bg-zinc-800 overflow-hidden mb-3">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.round(activeCar.condition)}%` }}
              />
            </div>
            <button
              type="button"
              disabled={repairNeeded < 1 || totalFunds < repairCost}
              onClick={() => onQuickRepair(repairCost)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
            >
              <Wrench className="h-3.5 w-3.5" />
              {repairNeeded < 1
                ? 'No Repairs Needed'
                : `Quick Repair · $${repairCost.toLocaleString()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
