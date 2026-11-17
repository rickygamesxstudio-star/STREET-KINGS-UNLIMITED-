import React, { useEffect, useState } from 'react';
import { AlertTriangle, Gavel, Scale, ShieldAlert } from 'lucide-react';
import {
  OwnedCar,
  PlayerEconomyState,
  PoliceStopEvent,
} from '../types/game';

interface PoliceModalProps {
  stopEvent: PoliceStopEvent;
  economy: PlayerEconomyState;
  activeCar: OwnedCar;
  onPayFine: (fine: number) => void;
  onServeJail: (reducedFine: number) => void;
  onAppealCharges: () => { dismissed: boolean; newFine: number; note: string };
  onConfiscateVehicle: () => void;
}

export const PoliceModal: React.FC<PoliceModalProps> = ({
  stopEvent,
  economy,
  onPayFine,
  onServeJail,
  onAppealCharges,
  onConfiscateVehicle,
}) => {
  const [servingSeconds, setServingSeconds] = useState<number | null>(null);
  const [appealNote, setAppealNote] = useState<string | null>(null);
  const [currentFine, setCurrentFine] = useState(stopEvent.escalatedFine);
  const [appealUsed, setAppealUsed] = useState(false);

  const totalFunds = economy.cash + economy.bank;
  const jailTimeSec = stopEvent.isThirdJailEscalation ? 7 : 4;
  const jailReducedFine = Math.round(currentFine * 0.2);

  useEffect(() => {
    if (servingSeconds === null) return;
    if (servingSeconds <= 0) {
      onServeJail(Math.min(totalFunds, jailReducedFine));
      return;
    }
    const t = window.setTimeout(() => setServingSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [servingSeconds, onServeJail, totalFunds, jailReducedFine]);

  const handleAppeal = () => {
    if (appealUsed) return;
    const res = onAppealCharges();
    setAppealUsed(true);
    setAppealNote(res.note);
    if (!res.dismissed) {
      setCurrentFine(res.newFine);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-xl rounded-2xl border border-red-500/40 bg-zinc-950 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-400 shrink-0" />
            <div>
              <div className="text-[11px] font-telemetry uppercase text-red-400">
                Metro Police Traffic Stop · Badge #{stopEvent.badgeNumber}
              </div>
              <h2 className="font-display text-xl font-bold text-white">
                {stopEvent.officerName} — Citation & Detention Notice
              </h2>
            </div>
          </div>
          <span className="font-telemetry text-xs text-amber-400">
            {'★'.repeat(stopEvent.wantedLevel)}
          </span>
        </div>

        {/* Officer Explanation & Charges */}
        <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/70 p-4 space-y-2">
          <div className="text-xs font-semibold text-zinc-300">
            Recorded Offences & Penalty Breakdown
          </div>
          <ul className="list-disc pl-4 text-xs text-zinc-200 space-y-1">
            {stopEvent.charges.map((ch) => (
              <li key={ch}>{ch}</li>
            ))}
          </ul>
          <div className="pt-2 border-t border-white/10 flex flex-wrap justify-between gap-2 text-xs font-telemetry">
            <span className="text-zinc-400">
              Total Fine: <strong className="text-red-400">${currentFine.toLocaleString()}</strong>
            </span>
            <span className="text-zinc-400">
              Police Busts: <strong className="text-amber-300">{economy.policeRecord.busts}</strong> (Next: #{stopEvent.nextBustCount})
            </span>
            <span className="text-zinc-400">
              Jail Sentences: <strong className="text-cyan-300">{economy.policeRecord.jailSentences}</strong>
            </span>
          </div>
        </div>

        {/* 3-Bust Threshold & 3-Jail Threshold Legal Warnings */}
        {stopEvent.isThirdBustConfiscationRisk && (
          <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-950/35 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300">
                3-Bust Vehicle Confiscation Threshold Reached (Bust #{stopEvent.nextBustCount})
              </div>
              <p className="mt-1 text-zinc-300">
                Under Metro Street Racing Code §408, reaching every 3rd police bust authorizes officers to confiscate your vehicle unless you settle the full citation immediately or have multiple vehicles in your garage.
              </p>
            </div>
          </div>
        )}

        {stopEvent.isThirdJailEscalation && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-950/30 p-3.5 text-xs text-red-200 flex items-start gap-2.5">
            <Gavel className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-300">
                Habitual Offender Escalation (3+ Jail Sentences)
              </div>
              <p className="mt-1 text-zinc-300">
                Because your record shows {economy.policeRecord.jailSentences} prior jail sentences, a 3rd+ sentence triggers doubled processing time and +50% aggravated fine multipliers.
              </p>
            </div>
          </div>
        )}

        {appealNote && (
          <div className="mt-3 rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3 text-xs text-cyan-200">
            <strong>Legal Review Result:</strong> {appealNote}
          </div>
        )}

        {/* Serving Jail Timer */}
        {servingSeconds !== null ? (
          <div className="mt-5 rounded-xl border border-white/15 bg-zinc-900 p-5 text-center">
            <div className="text-xs font-telemetry uppercase text-zinc-400">
              Serving Precinct Detention Sentence
            </div>
            <div className="mt-2 font-display text-4xl font-bold text-amber-400">
              {servingSeconds}s
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Sentence tracked separately from busts. Releasing upon completion...
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              disabled={totalFunds < currentFine}
              onClick={() => onPayFine(currentFine)}
              className="w-full flex items-center justify-between rounded-xl bg-emerald-500 px-4 py-3 text-left text-xs font-bold text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
            >
              <div>
                <div className="text-sm">Pay Citation Fine & Release</div>
                <div className="font-normal text-zinc-900">
                  Clears warrant without adding a jail sentence (records Bust #{stopEvent.nextBustCount})
                </div>
              </div>
              <span className="font-telemetry text-sm">${currentFine.toLocaleString()}</span>
            </button>

            <button
              type="button"
              onClick={() => setServingSeconds(jailTimeSec)}
              className="w-full flex items-center justify-between rounded-xl border border-white/15 bg-zinc-900 px-4 py-3 text-left text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
            >
              <div>
                <div className="text-sm">Serve Jail Sentence ({jailTimeSec}s)</div>
                <div className="font-normal text-zinc-400">
                  Reduces cash penalty by 80% (${jailReducedFine.toLocaleString()}) · Increments Jail Record (#{stopEvent.nextJailCount})
                </div>
              </div>
              <span className="font-telemetry text-amber-400">JAIL</span>
            </button>

            <button
              type="button"
              disabled={appealUsed}
              onClick={handleAppeal}
              className="w-full flex items-center justify-between rounded-xl border border-cyan-500/40 bg-zinc-900/70 px-4 py-2.5 text-left text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-45 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                <span>Request Legal Review / Appeal Citation</span>
              </div>
              <span className="text-[11px]">
                {appealUsed ? 'Reviewed' : `REP ${economy.reputation}`}
              </span>
            </button>

            {(stopEvent.isThirdBustConfiscationRisk || totalFunds < currentFine) && (
              <button
                type="button"
                onClick={onConfiscateVehicle}
                className="w-full rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-900/40 cursor-pointer"
              >
                Surrender Vehicle to Police Confiscation / Impound (Waives Cash Fine)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
