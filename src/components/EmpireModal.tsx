import React, { useState } from 'react';
import { Briefcase, Building2, Landmark, X } from 'lucide-react';
import { JOBS_CATALOG, PROPERTIES_CATALOG } from '../data/worldData';
import { JobDefinition, PlayerEconomyState, PropertyAsset } from '../types/game';

interface EmpireModalProps {
  economy: PlayerEconomyState;
  onClose: () => void;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  onBuyProperty: (prop: PropertyAsset) => void;
  onStartJob: (job: JobDefinition) => void;
}

export const EmpireModal: React.FC<EmpireModalProps> = ({
  economy,
  onClose,
  onDeposit,
  onWithdraw,
  onBuyProperty,
  onStartJob,
}) => {
  const [tab, setTab] = useState<'jobs' | 'properties' | 'bank'>('jobs');
  const [transferInput, setTransferInput] = useState('5000');

  const totalFunds = economy.cash + economy.bank;
  const passivePerMin = PROPERTIES_CATALOG.filter((p) =>
    economy.ownedPropertyIds.includes(p.id)
  ).reduce((acc, p) => acc + p.incomePerMinute, 0);

  const parsedAmount = Math.max(0, Math.floor(Number(transferInput) || 0));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-4xl rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-violet-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Jobs, Real Estate & Pacific Trust Bank
              </h2>
              <p className="text-xs text-zinc-400">
                Cash: ${economy.cash.toLocaleString()} · Bank: ${economy.bank.toLocaleString()} ·
                Passive Income: ${passivePerMin.toLocaleString()}/min
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

        <div className="mt-4 flex gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setTab('jobs')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer ${
              tab === 'jobs'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" /> Street Jobs
          </button>
          <button
            type="button"
            onClick={() => setTab('properties')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer ${
              tab === 'properties'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" /> Properties & Businesses
          </button>
          <button
            type="button"
            onClick={() => setTab('bank')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer ${
              tab === 'bank'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Landmark className="h-3.5 w-3.5" /> Bank Account
          </button>
        </div>

        {tab === 'jobs' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {JOBS_CATALOG.map((job) => (
              <div
                key={job.id}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-900/70 p-4"
              >
                <div>
                  <div className="text-[11px] font-telemetry uppercase text-cyan-400">
                    {job.category} · {job.timeLimitSec}s Limit
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold text-white">
                    {job.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-zinc-400">{job.description}</p>
                  <div className="mt-3 space-y-1 text-xs font-telemetry">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Pickup</span>
                      <span className="text-zinc-200">{job.pickup.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Dropoff</span>
                      <span className="text-zinc-200">{job.dropoff.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Payout</span>
                      <span className="text-emerald-400 font-bold">
                        ${job.payout.toLocaleString()} + {job.repReward} REP
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onStartJob(job);
                    onClose();
                  }}
                  className="mt-4 w-full rounded-lg bg-cyan-500 py-2 text-xs font-bold text-zinc-950 hover:bg-cyan-400 cursor-pointer"
                >
                  Accept Contract
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'properties' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROPERTIES_CATALOG.map((prop) => {
              const owned = economy.ownedPropertyIds.includes(prop.id);
              const canAfford = totalFunds >= prop.price;
              return (
                <div
                  key={prop.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 ${
                    owned
                      ? 'border-emerald-500/40 bg-zinc-900'
                      : 'border-white/10 bg-zinc-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-telemetry uppercase">
                      <span className="text-violet-400">
                        {prop.kind} · {prop.district}
                      </span>
                      <span className="text-emerald-400">
                        +${prop.incomePerMinute}/min
                      </span>
                    </div>
                    <h3 className="mt-1 font-display text-lg font-bold text-white">
                      {prop.name}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400">{prop.description}</p>
                  </div>
                  <div className="mt-4">
                    {owned ? (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 py-2 text-center text-xs font-semibold text-emerald-300">
                        Owned — Paying Income to Bank
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuyProperty(prop)}
                        className={`w-full rounded-lg py-2 text-xs font-bold ${
                          canAfford
                            ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        Purchase · ${prop.price.toLocaleString()}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'bank' && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="text-xs text-zinc-400">Wallet Cash (At risk in Police Busts)</div>
                <div className="mt-1 font-telemetry text-3xl font-bold text-emerald-400">
                  ${economy.cash.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
                <div className="text-xs text-zinc-400">Pacific Trust Bank (Protected)</div>
                <div className="mt-1 font-telemetry text-3xl font-bold text-sky-400">
                  ${economy.bank.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-4 space-y-3">
              <div className="text-xs font-semibold text-zinc-300">
                Transfer Funds Between Cash & Bank
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={transferInput}
                  onChange={(e) => setTransferInput(e.target.value)}
                  className="w-40 rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 font-telemetry text-sm text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  disabled={parsedAmount <= 0 || economy.cash < parsedAmount}
                  onClick={() => onDeposit(Math.min(economy.cash, parsedAmount))}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
                >
                  Deposit to Bank
                </button>
                <button
                  type="button"
                  disabled={economy.cash <= 0}
                  onClick={() => onDeposit(economy.cash)}
                  className="rounded-lg border border-sky-500/40 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/15 disabled:opacity-40 cursor-pointer"
                >
                  Deposit All Cash
                </button>
                <button
                  type="button"
                  disabled={parsedAmount <= 0 || economy.bank < parsedAmount}
                  onClick={() => onWithdraw(Math.min(economy.bank, parsedAmount))}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
                >
                  Withdraw Cash
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
