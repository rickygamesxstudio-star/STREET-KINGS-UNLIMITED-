import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Compass,
  ExternalLink,
  Loader2,
  Mic,
  MicOff,
  Send,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { CarSpec, HudTelemetry, OwnedCar, PlayerEconomyState } from '../types/game';

interface GroundingLink {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  groundingLinks?: GroundingLink[];
}

type ReasoningMode = 'fast' | 'standard' | 'deep' | 'maps';

interface GeminiCopilotModalProps {
  economy: PlayerEconomyState;
  telemetry: HudTelemetry;
  activeSpec: CarSpec;
  activeCar: OwnedCar;
  onClose: () => void;
}

const PERSONA_PRESETS: Array<{ id: string; label: string; instruction: string }> = [
  {
    id: 'strategist',
    label: 'Crew Chief & Race Strategist',
    instruction:
      'You are the Street Kings Jamaica Crew Chief & Race Strategist. Give punchy, practical race strategy across New Kingston, Highway 2000, Palisadoes Strip, Hellshire, and Blue Mountains, plus JCF evasion and bankroll advice.',
  },
  {
    id: 'tuner',
    label: 'Knutsford Master Tuner',
    instruction:
      'You are Jax, Head Engineer at Knutsford Customs Kingston. Analyze engine/turbo/tire/suspension balance, drift angles, drag gearing, and maintenance with crisp automotive expertise.',
  },
  {
    id: 'scout',
    label: 'Jamaica Road Trip Scout',
    instruction:
      'You are a Jamaican automotive road-trip navigator. Recommend real driving roads across Kingston, Ocho Rios, Montego Bay, Negril, and the Blue Mountains with scenic viewpoints and food stops clearly.',
  },
  {
    id: 'dj',
    label: 'Radio DJ & Track Curator',
    instruction:
      'You are the underground FM Radio DJ for Street Kings Jamaica. Suggest driving playlists across Reggae, Dancehall, R&B, Hip-Hop, and Afrobeats.',
  },
];

const MODE_OPTIONS: Array<{
  id: ReasoningMode;
  label: string;
  modelBadge: string;
  desc: string;
}> = [
  {
    id: 'fast',
    label: 'Quick Flash Lite',
    modelBadge: 'gemini-3.1-flash-lite',
    desc: 'Ultra-fast quick answers while cruising',
  },
  {
    id: 'standard',
    label: 'Co-Pilot Standard',
    modelBadge: 'gemini-4-hydrogen',
    desc: 'Balanced everyday strategy & car tuning',
  },
  {
    id: 'deep',
    label: 'Deep Strategy (XHIGH)',
    modelBadge: 'gemini-4-hydrogen (XHIGH)',
    desc: 'Maximum reasoning depth for multi-factor tuning & economy planning',
  },
  {
    id: 'maps',
    label: 'Maps Grounded',
    modelBadge: 'gemini-4-hydrogen + Maps',
    desc: 'Answers grounded with live Google Maps place links & reviews',
  },
];

export const GeminiCopilotModal: React.FC<GeminiCopilotModalProps> = ({
  economy,
  telemetry,
  activeSpec,
  activeCar,
  onClose,
}) => {
  const [mode, setMode] = useState<ReasoningMode>('standard');
  const [personaId, setPersonaId] = useState<string>(PERSONA_PRESETS[0].id);
  const [customInstruction, setCustomInstruction] = useState<string>(
    PERSONA_PRESETS[0].instruction
  );
  const [includeContext, setIncludeContext] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Radio check, ${economy.character.name}. Co-Pilot online — your ${activeSpec.brand} ${activeSpec.name} is tuned and ready. Ask for upgrade builds, race strategy, real-world Google Maps driving routes, or tap the mic to speak!`,
      modelUsed: 'gemini-4-hydrogen',
    },
  ]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLatLng, setUserLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (mode === 'maps' && !userLatLng && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Safe ignore
        }
      );
    }
  }, [mode, userLatLng]);

  const voice = useVoiceRecorder(
    useCallback((transcript: string) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }, [])
  );

  const buildSystemPrompt = () => {
    if (!includeContext) return customInstruction;
    const ctx = [
      `Active Driver: ${economy.character.name} (${economy.reputation} REP)`,
      `Cash Wallet: $${economy.cash.toLocaleString()}, Pacific Bank: $${economy.bank.toLocaleString()}`,
      `Active Car: ${activeSpec.brand} ${activeSpec.name} (${activeSpec.category}), Condition ${Math.round(activeCar.condition)}%, Fuel ${Math.round(activeCar.fuel)}%`,
      `Upgrades: Engine L${activeCar.upgrades.engine}, Turbo L${activeCar.upgrades.turbo}, Tires L${activeCar.upgrades.tires}, Suspension L${activeCar.upgrades.suspension}, Brakes L${activeCar.upgrades.brakes}, Trans L${activeCar.upgrades.transmission}`,
      `Police Record: ${economy.policeRecord.busts} busts, ${economy.policeRecord.jailSentences} jail sentences, current wanted stars: ${telemetry.wantedLevel}`,
      `Speed: ${telemetry.speedKmh} km/h, Surface: ${telemetry.surface}, Weather: ${telemetry.weather}`,
    ].join(' | ');
    return `${customInstruction}\n\n[Live Driver Telemetry Context]: ${ctx}`;
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!overrideText) setInput('');
    setSending(true);
    setError(null);

    try {
      const historyPayload = nextMessages
        .slice(1, -1) // skip static greeting, exclude current turn
        .map((m) => ({ role: m.role, text: m.text }));

      const resp = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasoningMode: mode,
          systemInstruction: buildSystemPrompt(),
          history: historyPayload,
          message: text,
          location: userLatLng,
        }),
      });

      const data = (await resp.json()) as {
        text?: string;
        model?: string;
        groundingLinks?: GroundingLink[];
        error?: string;
      };

      if (!resp.ok) {
        throw new Error(data.error || `Gemini Co-Pilot error (HTTP ${resp.status}).`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          role: 'model',
          text: data.text || 'No text returned from model.',
          modelUsed: data.model,
          groundingLinks: data.groundingLinks,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Gemini Co-Pilot.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
      <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5 bg-zinc-900/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                AI Co-Pilot & Race Strategist
              </h2>
              <p className="text-[11px] text-zinc-400">
                Multi-turn Gemini Assistant · Voice Transcription · Google Maps Grounding
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                showConfig
                  ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                  : 'border-white/15 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" /> Persona
            </button>
            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    id: 'reset',
                    role: 'model',
                    text: 'Conversation cleared. Ready for your next tactical call.',
                    modelUsed: 'gemini-4-hydrogen',
                  },
                ])
              }
              title="Clear Chat History"
              className="rounded-lg border border-white/15 bg-zinc-900 p-1.5 text-zinc-400 hover:text-white cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Model Mode Strip */}
        <div className="border-b border-white/10 bg-zinc-900/40 px-5 py-2.5 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`rounded-xl border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                  mode === opt.id
                    ? 'border-cyan-400 bg-cyan-500/15'
                    : 'border-white/10 bg-zinc-900/70 hover:bg-zinc-900'
                }`}
              >
                <div className="text-xs font-bold text-white flex items-center justify-between gap-1">
                  <span className="truncate">{opt.label}</span>
                  {opt.id === 'maps' && <Compass className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                </div>
                <div className="text-[10px] font-telemetry text-cyan-300 truncate mt-0.5">
                  {opt.modelBadge}
                </div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-zinc-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              {MODE_OPTIONS.find((m) => m.id === mode)?.desc}
            </span>
            <span>
              Paid-key models (`gemini-4-carbon`, `gemini-4-argon`) disabled — free-tier Gemini 4 Hydrogen & Flash Lite active
            </span>
          </div>
        </div>

        {/* Configurable System Instruction & Persona Panel */}
        {showConfig && (
          <div className="border-b border-white/10 bg-zinc-900/80 px-5 py-3 space-y-2.5 text-xs">
            <div className="flex flex-wrap gap-1.5">
              {PERSONA_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPersonaId(p.id);
                    setCustomInstruction(p.instruction);
                  }}
                  className={`rounded-lg px-2.5 py-1 font-medium cursor-pointer ${
                    personaId === p.id
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'bg-zinc-950 text-zinc-300 border border-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              placeholder="Custom system instruction..."
            />
            <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="accent-cyan-500"
              />
              Include live telemetry, cash, active vehicle, upgrades & police record in system context
            </label>
          </div>
        )}

        {/* Scrollable Chat History */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-cyan-500 text-zinc-950 font-medium'
                    : 'border border-white/10 bg-zinc-900 text-zinc-100'
                }`}
              >
                {m.text}

                {m.groundingLinks && m.groundingLinks.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 space-y-1.5">
                    <div className="text-[10px] font-telemetry uppercase text-amber-400">
                      Google Maps Grounding Sources
                    </div>
                    {m.groundingLinks.map((lnk, idx) => (
                      <a
                        key={`${lnk.uri}_${idx}`}
                        href={lnk.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg border border-cyan-500/30 bg-zinc-950 px-2.5 py-1.5 text-[11px] text-cyan-300 hover:border-cyan-400"
                      >
                        <span className="truncate font-semibold">{lnk.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {m.modelUsed && (
                <span className="mt-1 px-1 text-[10px] font-telemetry text-zinc-500">
                  {m.modelUsed}
                </span>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-cyan-300">
              <Loader2 className="h-4 w-4 animate-spin" /> Co-Pilot analyzing request...
            </div>
          )}

          {(error || voice.error) && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-300">
              {error || voice.error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick Prompts + Composer with Mic Transcription */}
        <div className="border-t border-white/10 bg-zinc-900/60 px-5 py-3 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {[
              'Best next upgrades for my current car & budget?',
              'How should I beat the Airport Highway Drag?',
              'Find cool scenic coastal driving spots near Los Angeles',
            ].map((chip, idx) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  if (idx === 2) setMode('maps');
                  handleSend(chip);
                }}
                className="rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-cyan-400/50 cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={voice.isRecording ? voice.stopRecording : voice.startRecording}
              disabled={voice.isTranscribing}
              title={
                voice.isRecording
                  ? 'Stop Recording & Transcribe'
                  : 'Record Voice Input (gemini-3.5-transcribe)'
              }
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold cursor-pointer shrink-0 ${
                voice.isRecording
                  ? 'border-red-400 bg-red-500/20 text-red-300'
                  : 'border-white/15 bg-zinc-950 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {voice.isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : voice.isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4 text-cyan-400" />
              )}
              <span>
                {voice.isRecording
                  ? 'Stop Mic'
                  : voice.isTranscribing
                  ? 'Transcribing...'
                  : 'Voice'}
              </span>
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your Crew Chief, request race tuning, or speak with Voice..."
              className="flex-1 rounded-xl border border-white/15 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
            />

            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
