import React from 'react';
import { Award, Flag, Lock, Trophy, X } from 'lucide-react';
import { RACE_EVENTS } from '../data/worldData';
import { PlayerEconomyState, RaceEvent } from '../types/game';

interface RaceHubModalProps {
  economy: PlayerEconomyState;
  onClose: () => void;
  onStartRace: (race: RaceEvent) => void;
}

export const RaceHubModal: React.FC<RaceHubModalProps> = ({
  economy,
  onClose,
  onStartRace,
}) => {
  const totalFunds = economy.cash + economy.bank;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-5xl rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-red-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Street Kings Racing & Championship Hub
              </h2>
              <p className="text-xs text-zinc-400">
                Street, Drag, Circuit, Drift, Off-Road & Championship · Championship Points:{' '}
                <strong className="text-amber-400">{economy.championshipPoints}</strong>
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
          {RACE_EVENTS.map((race) => {
            const locked = economy.reputation < race.repRequired;
            const completed = economy.completedRaceIds.includes(race.id);
            const canAfford = totalFunds >= race.entryFee;

            return (
              <div
                key={race.id}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/70 p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-telemetry uppercase">
                    <span className="text-amber-400">
                      {race.type} · {race.district}
                    </span>
                    {completed && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Award className="h-3.5 w-3.5" /> Won
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1 font-display text-lg font-bold text-white">
                    {race.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                    {race.description}
                  </p>

                  <div className="mt-3 space-y-1 text-xs font-telemetry">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Format</span>
                      <span className="text-white">
                        {race.laps} {race.laps === 1 ? 'Lap' : 'Laps'} · {race.opponents} Rivals
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">1st Place Prize</span>
                      <span className="text-emerald-400 font-bold">
                        ${race.prizeFirst.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Rep Reward</span>
                      <span className="text-amber-300">+{race.repReward} REP</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10">
                  {locked ? (
                    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-zinc-950 py-2 text-xs text-zinc-400">
                      <Lock className="h-3.5 w-3.5" /> Requires {race.repRequired} REP
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        onStartRace(race);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${
                        canAfford
                          ? 'bg-red-500 text-white hover:bg-red-400 cursor-pointer'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      Start Event (Entry ${race.entryFee})
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
