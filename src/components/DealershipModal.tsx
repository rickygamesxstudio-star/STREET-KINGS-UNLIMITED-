import React from 'react';
import { Car, Check, Lock, X } from 'lucide-react';
import { CAR_CATALOG } from '../data/worldData';
import { CarSpec, PlayerEconomyState } from '../types/game';

interface DealershipModalProps {
  economy: PlayerEconomyState;
  onClose: () => void;
  onBuyCar: (spec: CarSpec) => void;
  onSelectOwnedCar: (instanceId: string) => void;
}

export const DealershipModal: React.FC<DealershipModalProps> = ({
  economy,
  onClose,
  onBuyCar,
  onSelectOwnedCar,
}) => {
  const totalFunds = economy.cash + economy.bank;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Car className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Apex Motors Dealership & Collection
              </h2>
              <p className="text-xs text-zinc-400">
                Available Funds: ${totalFunds.toLocaleString()} (Cash + Bank) · Rep:{' '}
                {economy.reputation}
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

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAR_CATALOG.map((car) => {
            const ownedInstance = economy.ownedCars.find((o) => o.specId === car.id);
            const isActive =
              ownedInstance && ownedInstance.instanceId === economy.activeCarInstanceId;
            const repLocked = economy.reputation < car.repRequired;
            const canAfford = totalFunds >= car.price;

            return (
              <div
                key={car.id}
                className={`flex flex-col justify-between rounded-xl border p-4 ${
                  isActive
                    ? 'border-amber-400 bg-zinc-900'
                    : 'border-white/10 bg-zinc-900/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-telemetry uppercase text-amber-400">
                      {car.brand} · {car.category}
                    </span>
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-white/25"
                      style={{ backgroundColor: car.defaultColor }}
                    />
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold text-white">
                    {car.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                    {car.description}
                  </p>

                  {/* Spec Bars */}
                  <div className="mt-3 space-y-1.5 text-[11px] font-telemetry">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Top Speed</span>
                      <span className="text-white">{car.baseSpeedKmh} km/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Acceleration</span>
                      <span className="text-emerald-400">{car.baseAccel}/10</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Handling / Drift</span>
                      <span className="text-cyan-400">
                        {car.baseHandling} / {car.baseDrift}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Off-Road Rating</span>
                      <span className="text-amber-300">{car.offroadRating}/10</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  {ownedInstance ? (
                    ownedInstance.impounded ? (
                      <div className="w-full rounded-lg border border-red-500/40 bg-red-950/30 py-2 text-center text-xs font-semibold text-red-300">
                        Impounded (Redeem in Phone → Garage)
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isActive}
                        onClick={() => onSelectOwnedCar(ownedInstance.instanceId)}
                        className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-zinc-100 text-zinc-950 hover:bg-white cursor-pointer'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Active Vehicle
                          </>
                        ) : (
                          'Drive This Car'
                        )}
                      </button>
                    )
                  ) : repLocked ? (
                    <div className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-zinc-950 py-2 text-xs text-zinc-400">
                      <Lock className="h-3.5 w-3.5" /> Requires {car.repRequired} REP
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyCar(car)}
                      className={`w-full rounded-lg py-2 text-xs font-bold ${
                        canAfford
                          ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      Buy · ${car.price.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
