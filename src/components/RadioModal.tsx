import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  ListMusic,
  Music2,
  Pause,
  Play,
  Plus,
  Radio as RadioIcon,
  Search,
  SkipBack,
  SkipForward,
  Star,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { RadioStation, RadioTrack } from '../types/game';

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayerInstance }) => void;
            onStateChange?: (e: { data: number }) => void;
            onError?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
  loadVideoById: (id: string) => void;
  cuePlaylist: (opts: { listType: string; list: string }) => void;
  loadPlaylist: (opts: { listType: string; list: string }) => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  getPlayerState?: () => number;
  destroy: () => void;
}

interface SearchCuratedItem {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  youtubeId: string;
  youtubeUrl: string;
  thumbnail: string;
}

interface SearchFullTrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  previewUrl: string;
  durationSec: number;
  source: string;
}

interface SearchItunesItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  previewUrl: string;
  source: string;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseYouTubeInput(
  rawUrl: string
): { videoId?: string; playlistId?: string } | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { videoId: trimmed };
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '');
    if (
      host !== 'youtube.com' &&
      host !== 'm.youtube.com' &&
      host !== 'music.youtube.com' &&
      host !== 'youtu.be' &&
      host !== 'youtube-nocookie.com'
    ) {
      return null;
    }

    const listParam = url.searchParams.get('list') || undefined;
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      if (id && id.length >= 10) return { videoId: id, playlistId: listParam };
    }

    const vParam = url.searchParams.get('v');
    if (vParam && vParam.length >= 10) {
      return { videoId: vParam, playlistId: listParam };
    }

    const shortsMatch = url.pathname.match(/\/(shorts|embed|live)\/([a-zA-Z0-9_-]{10,})/);
    if (shortsMatch) {
      return { videoId: shortsMatch[2], playlistId: listParam };
    }

    if (listParam) {
      return { playlistId: listParam };
    }
    return null;
  } catch {
    return null;
  }
}

function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return 'Invalid YouTube video ID or malformed parameters.';
    case 5:
      return 'The HTML5 YouTube player encountered a playback issue in this browser.';
    case 100:
      return 'This video was removed or marked private by its uploader.';
    case 101:
    case 150:
      return (
        'Embedded playback is disabled by the video owner/copyright holder (Error ' +
        code +
        '). Street Kings strictly respects YouTube embed permissions and does not bypass restrictions.'
      );
    default:
      return 'YouTube could not play this link inside an embedded frame.';
  }
}

interface RadioModalProps {
  open: boolean;
  stations: RadioStation[];
  activeStationId: string;
  activeTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  favorites: RadioTrack[];
  playerMode: 'driving' | 'walking';
  playingOnPhone: boolean;
  onSetPlayingOnPhone: (enabled: boolean) => void;
  onClose: () => void;
  onSelectStation: (stationId: string) => void;
  onSelectTrack: (index: number) => void;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onVolumeChange: (vol: number) => void;
  onAddYouTubeTrack: (track: RadioTrack, playNow?: boolean) => void;
  onRemoveYouTubeTrack: (trackId: string) => void;
  onToggleFavorite: (track: RadioTrack) => void;
  onPlayExternalTrack: (track: RadioTrack) => void;
}

export const RadioModal: React.FC<RadioModalProps> = ({
  open,
  stations,
  activeStationId,
  activeTrackIndex,
  isPlaying,
  volume,
  favorites,
  playerMode,
  playingOnPhone,
  onSetPlayingOnPhone,
  onClose,
  onSelectStation,
  onSelectTrack,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onVolumeChange,
  onAddYouTubeTrack,
  onRemoveYouTubeTrack,
  onToggleFavorite,
  onPlayExternalTrack,
}) => {
  const [ytInput, setYtInput] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytApiBlocked, setYtApiBlocked] = useState(false);

  // Music Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [curatedResults, setCuratedResults] = useState<SearchCuratedItem[]>([]);
  const [fullTrackResults, setFullTrackResults] = useState<SearchFullTrackItem[]>([]);
  const [itunesResults, setItunesResults] = useState<SearchItunesItem[]>([]);
  const [activeListTab, setActiveListTab] = useState<'queue' | 'favorites' | 'search'>('queue');

  // Full track playback progress state
  const [trackTimeSec, setTrackTimeSec] = useState(0);
  const [trackDurationSec, setTrackDurationSec] = useState(0);

  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const onNextTrackRef = useRef(onNextTrack);
  onNextTrackRef.current = onNextTrack;

  const station = stations.find((s) => s.id === activeStationId) || stations[0];
  const track = station.tracks[activeTrackIndex] || station.tracks[0];
  const isYoutubeTrack = Boolean(track?.youtubeId || track?.youtubePlaylistId);
  const isAudioStreamTrack = Boolean(track?.previewUrl && !isYoutubeTrack);
  const isFavorite = track ? favorites.some((f) => f.id === track.id) : false;

  // Initial curated load
  useEffect(() => {
    fetch('/api/music/search')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.curated) setCuratedResults(data.curated);
      })
      .catch(() => {});
  }, []);

  // Handle HTML5 Audio playback (Full Audius tracks & fallback previews)
  useEffect(() => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    audio.volume = volume;
    if (!isAudioStreamTrack || !track?.previewUrl) {
      audio.pause();
      return;
    }

    if (audio.src !== track.previewUrl) {
      audio.src = track.previewUrl;
      audio.load();
      setTrackTimeSec(0);
      setTrackDurationSec(track.durationSec || 0);
    }

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isAudioStreamTrack, track?.previewUrl, track?.durationSec, isPlaying, volume]);

  // Load Official YouTube IFrame Player API safely whenever active track has youtubeId or youtubePlaylistId
  useEffect(() => {
    if (!isYoutubeTrack || (!track?.youtubeId && !track?.youtubePlaylistId)) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {
          // ignore
        }
      }
      return;
    }

    let cancelled = false;
    setYtError(null);
    setTrackTimeSec(0);
    setTrackDurationSec(0);

    const loadCurrentInPlayer = (player: YTPlayerInstance) => {
      if (track.youtubeId) {
        player.loadVideoById(track.youtubeId);
      } else if (track.youtubePlaylistId) {
        player.loadPlaylist({ listType: 'playlist', list: track.youtubePlaylistId });
      }
      player.setVolume(Math.round(volume * 100));
      if (!isPlaying) player.pauseVideo();
    };

    const mountPlayer = () => {
      if (cancelled || !playerMountRef.current || !window.YT?.Player) return;

      if (ytPlayerRef.current) {
        try {
          loadCurrentInPlayer(ytPlayerRef.current);
        } catch {
          // fallback re-init
        }
        return;
      }

      ytPlayerRef.current = new window.YT.Player(playerMountRef.current, {
        height: '200',
        width: '100%',
        videoId: track.youtubeId || undefined,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
          ...(track.youtubePlaylistId && !track.youtubeId
            ? { listType: 'playlist', list: track.youtubePlaylistId }
            : {}),
        },
        events: {
          onReady: (ev) => {
            ev.target.setVolume(Math.round(volume * 100));
            if (!track.youtubeId && track.youtubePlaylistId) {
              ev.target.loadPlaylist({ listType: 'playlist', list: track.youtubePlaylistId });
            }
            if (isPlaying) ev.target.playVideo();
          },
          onStateChange: (ev) => {
            // 0 === YT.PlayerState.ENDED -> auto-advance to next track after full song finishes
            if (ev.data === 0) {
              onNextTrackRef.current();
            }
          },
          onError: (ev) => {
            setYtError(describeYouTubeError(ev.data));
          },
        },
      });
    };

    if (window.YT?.Player) {
      mountPlayer();
    } else {
      const existing = document.querySelector('script[data-yt-iframe-api]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.ytIframeApi = '1';
        script.onerror = () => {
          if (!cancelled) {
            setYtApiBlocked(true);
            setYtError(
              'YouTube IFrame Player API could not be reached in this network/sandbox environment.'
            );
          }
        };
        document.head.appendChild(script);
      }

      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevReady?.();
        mountPlayer();
      };
    }

    return () => {
      cancelled = true;
    };
  }, [isYoutubeTrack, track?.youtubeId, track?.youtubePlaylistId]);

  // Sync play/pause & volume with YT player
  useEffect(() => {
    if (!isYoutubeTrack || !ytPlayerRef.current) return;
    try {
      ytPlayerRef.current.setVolume(Math.round(volume * 100));
      if (isPlaying) {
        ytPlayerRef.current.playVideo();
      } else {
        ytPlayerRef.current.pauseVideo();
      }
    } catch {
      // ignore if player not ready
    }
  }, [isPlaying, volume, isYoutubeTrack]);

  // Poll full-song progress for YouTube or HTML5 Audio
  useEffect(() => {
    if (!isYoutubeTrack && !isAudioStreamTrack) {
      setTrackTimeSec(0);
      setTrackDurationSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      if (isYoutubeTrack && ytPlayerRef.current) {
        try {
          const cur = ytPlayerRef.current.getCurrentTime?.() || 0;
          const dur = ytPlayerRef.current.getDuration?.() || 0;
          setTrackTimeSec(cur);
          setTrackDurationSec(dur);
        } catch {
          // ignore
        }
      } else if (isAudioStreamTrack && previewAudioRef.current) {
        const audio = previewAudioRef.current;
        setTrackTimeSec(audio.currentTime || 0);
        setTrackDurationSec(
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : track?.durationSec || 0
        );
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [isYoutubeTrack, isAudioStreamTrack, track?.durationSec]);

  const handleSeek = (sec: number) => {
    setTrackTimeSec(sec);
    if (isYoutubeTrack && ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(sec, true);
    } else if (isAudioStreamTrack && previewAudioRef.current) {
      previewAudioRef.current.currentTime = sec;
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtError(null);
    const parsed = parseYouTubeInput(ytInput);
    if (!parsed || (!parsed.videoId && !parsed.playlistId)) {
      setYtError(
        'Please paste a valid YouTube video or playlist URL (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...).'
      );
      return;
    }

    setYtLoading(true);
    let resolvedTitle =
      ytTitle.trim() ||
      (parsed.videoId
        ? `YouTube Song (${parsed.videoId})`
        : `YouTube Playlist (${parsed.playlistId})`);
    let resolvedArtist = 'Full YouTube Track';
    let resolvedThumb = parsed.videoId
      ? `https://i.ytimg.com/vi/${parsed.videoId}/mqdefault.jpg`
      : undefined;

    try {
      const canonical = parsed.videoId
        ? `https://www.youtube.com/watch?v=${parsed.videoId}`
        : `https://www.youtube.com/playlist?list=${parsed.playlistId}`;
      const resp = await fetch(`/api/music/oembed?url=${encodeURIComponent(canonical)}`);
      if (resp.ok) {
        const meta = await resp.json();
        if (!ytTitle.trim() && meta.title) resolvedTitle = meta.title;
        if (meta.artist) resolvedArtist = meta.artist;
        if (meta.thumbnail) resolvedThumb = meta.thumbnail;
      } else if (resp.status === 401 || resp.status === 403) {
        const errData = await resp.json().catch(() => null);
        setYtError(
          errData?.error ||
            'Owner disabled embedding for this YouTube video. Try another track or switch to an in-game station.'
        );
      }
    } catch {
      // Proceed with fallback metadata; official iframe player will verify embed permission
    } finally {
      setYtLoading(false);
    }

    const newTrack: RadioTrack = {
      id: `yt_${parsed.videoId || parsed.playlistId}_${Date.now()}`,
      title: resolvedTitle,
      artist: resolvedArtist,
      bpm: 100,
      durationSec: 0,
      youtubeId: parsed.videoId,
      youtubePlaylistId: parsed.playlistId,
      youtubeUrl: ytInput.trim(),
      thumbnail: resolvedThumb,
    };
    onAddYouTubeTrack(newTrack, true);
    setYtInput('');
    setYtTitle('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setActiveListTab('search');
    try {
      const resp = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (resp.ok) {
        const data = await resp.json();
        setCuratedResults(data.curated || []);
        setFullTrackResults(data.fullTracks || []);
        setItunesResults(data.results || []);
      }
    } catch {
      // ignore network error
    } finally {
      setSearching(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70 ${
        open ? '' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!open}
    >
      {/* Hidden audio element for full streams & fallback previews */}
      <audio ref={previewAudioRef} onEnded={onNextTrack} />

      <div className="w-full max-w-4xl rounded-2xl border border-white/15 bg-zinc-950 p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <RadioIcon className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                In-Car Sound System, Music Search & YouTube Deck
              </h2>
              <p className="text-xs text-zinc-400">
                Genre stations, song/artist search, favourites & permitted YouTube embedded playback
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

        {/* Station Selector Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stations.map((st) => {
            const active = st.id === station.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  onSelectStation(st.id);
                  setActiveListTab('queue');
                }}
                className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-amber-400 bg-zinc-900'
                    : 'border-white/10 bg-zinc-900/50 hover:border-white/25'
                }`}
              >
                <div
                  className="text-[11px] font-telemetry uppercase"
                  style={{ color: st.accentColor }}
                >
                  {st.frequency}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-white truncate">
                  {st.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Now Playing & Transport Controls */}
        <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/75 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {track?.thumbnail ? (
                <img
                  src={track.thumbnail}
                  alt={track.title}
                  className="h-14 w-14 rounded-lg object-cover border border-white/10 shrink-0"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-zinc-800 shrink-0">
                  <Music2 className="h-6 w-6 text-amber-400" />
                </div>
              )}
              <div className="min-w-0">
                <div
                  className="text-xs font-telemetry uppercase"
                  style={{ color: station.accentColor }}
                >
                  {station.name} ·{' '}
                  {isYoutubeTrack
                    ? 'FULL YOUTUBE PLAYBACK'
                    : isAudioStreamTrack
                    ? track?.durationSec && track.durationSec > 40
                      ? 'FULL SONG STREAM'
                      : 'AUDIO STREAM'
                    : station.genre.toUpperCase()}
                </div>
                <div className="mt-0.5 text-lg font-bold text-white truncate">
                  {track?.title || 'No track selected'}
                </div>
                <div className="text-xs text-zinc-400 truncate">{track?.artist}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {track && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(track)}
                  title={isFavorite ? 'Remove from Favourites' : 'Save to Favourites'}
                  className={`rounded-lg border p-2.5 cursor-pointer ${
                    isFavorite
                      ? 'border-amber-400 bg-amber-500/20 text-amber-400'
                      : 'border-white/10 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={onPrevTrack}
                className="rounded-lg border border-white/10 p-2.5 text-zinc-200 hover:bg-white/10 cursor-pointer"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Play
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onNextTrack}
                className="rounded-lg border border-white/10 p-2.5 text-zinc-200 hover:bg-white/10 cursor-pointer"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>

          {(isYoutubeTrack || isAudioStreamTrack) && (
            <div className="mt-3 flex items-center gap-3">
              <span className="font-telemetry text-[11px] text-zinc-400 w-10">
                {formatDuration(trackTimeSec)}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(trackDurationSec || 100))}
                step={1}
                value={Math.min(trackTimeSec, trackDurationSec || 100)}
                onChange={(e) => handleSeek(Number(e.target.value))}
                disabled={trackDurationSec <= 0}
                className="w-full accent-rose-500 cursor-pointer disabled:opacity-40"
              />
              <span className="font-telemetry text-[11px] text-zinc-400 w-10 text-right">
                {trackDurationSec > 0 ? formatDuration(trackDurationSec) : 'FULL'}
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[180px]">
              <Volume2 className="h-4 w-4 text-zinc-400 shrink-0" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="font-telemetry text-xs text-zinc-300 w-10 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>

            {playerMode !== 'driving' && (
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={playingOnPhone}
                  onChange={(e) => onSetPlayingOnPhone(e.target.checked)}
                  className="accent-rose-500"
                />
                Play on Phone Outside Car
              </label>
            )}
          </div>
        </div>

        {/* Song/Artist Search + YouTube Link Bar */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <form
            onSubmit={handleSearch}
            className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 space-y-2"
          >
            <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-cyan-400" />
              Search Songs or Artists
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Artist, song title, reggae, afrobeats..."
                className="flex-1 rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={searching}
                className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-cyan-400 disabled:opacity-50 cursor-pointer"
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleAddUrl}
            className="rounded-xl border border-rose-500/25 bg-zinc-900/60 p-3 space-y-2"
          >
            <div className="text-xs font-semibold text-zinc-300">
              Paste Supported YouTube Video Link
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
              <input
                type="text"
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
                placeholder="Label (optional)"
                className="w-28 rounded-lg border border-white/15 bg-zinc-950 px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 hidden sm:block"
              />
              <button
                type="submit"
                disabled={ytLoading}
                className="flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> {ytLoading ? '...' : 'Load'}
              </button>
            </div>
          </form>
        </div>

        {/* YouTube Error & Official IFrame Embed Viewport */}
        {ytError && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-300">
                  Cannot Play Embedded YouTube Link
                </div>
                <p className="mt-0.5 text-zinc-300">{ytError}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSelectStation('st_hiphop')}
                className="rounded bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-amber-400 cursor-pointer"
              >
                Switch to Concrete Crown 105.9 (Hip-Hop)
              </button>
              <button
                type="button"
                onClick={() => onSelectStation('st_afrobeats')}
                className="rounded border border-white/15 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/10 cursor-pointer"
              >
                Try Lagos Pulse 107.1 (Afrobeats)
              </button>
              {track?.youtubeUrl && (
                <a
                  href={track.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-white/15 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/10"
                >
                  Open on YouTube <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {!ytApiBlocked && isYoutubeTrack && (track?.youtubeId || track?.youtubePlaylistId) && (
          <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black">
            <div ref={playerMountRef} className="w-full min-h-[200px]" />
          </div>
        )}

        {/* Tabs: Station Queue / Favourites / Search Results */}
        <div className="mt-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-3">
            <button
              type="button"
              onClick={() => setActiveListTab('queue')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                activeListTab === 'queue'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <ListMusic className="h-3.5 w-3.5" /> Station Queue ({station.tracks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab('favorites')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                activeListTab === 'favorites'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Star className="h-3.5 w-3.5" /> Favourites ({favorites.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab('search')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                activeListTab === 'search'
                  ? 'bg-cyan-500 text-zinc-950'
                  : 'text-zinc-300 hover:bg-white/10'
              }`}
            >
              <Search className="h-3.5 w-3.5" /> Search Results (
              {curatedResults.length + fullTrackResults.length + itunesResults.length})
            </button>
          </div>

          {activeListTab === 'queue' && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {station.tracks.map((t, idx) => {
                const selected = idx === activeTrackIndex;
                const fav = favorites.some((f) => f.id === t.id);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                      selected
                        ? 'border-amber-400/50 bg-zinc-900 text-white'
                        : 'border-white/5 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTrack(idx)}
                      className="flex items-center gap-2.5 flex-1 text-left cursor-pointer truncate"
                    >
                      {t.thumbnail && (
                        <img
                          src={t.thumbnail}
                          alt=""
                          className="h-7 w-7 rounded object-cover shrink-0"
                        />
                      )}
                      <span className="truncate">
                        <span className="font-semibold">{t.title}</span>
                        <span className="text-zinc-400"> — {t.artist}</span>
                      </span>
                    </button>
                    <div className="flex items-center gap-2.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(t)}
                        className={`cursor-pointer ${
                          fav ? 'text-amber-400' : 'text-zinc-500 hover:text-amber-300'
                        }`}
                        title="Toggle Favourite"
                      >
                        <Star className={`h-3.5 w-3.5 ${fav ? 'fill-current' : ''}`} />
                      </button>
                      {station.id === 'st_youtube' && station.tracks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveYouTubeTrack(t.id)}
                          className="text-zinc-500 hover:text-red-400 cursor-pointer"
                          title="Remove track"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeListTab === 'favorites' && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {favorites.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-4 text-center text-xs text-zinc-400">
                  No favourite tracks saved yet. Click ★ next to any song or search result.
                </div>
              ) : (
                favorites.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onPlayExternalTrack(t)}
                      className="flex items-center gap-2.5 flex-1 text-left cursor-pointer truncate text-zinc-200 hover:text-white"
                    >
                      {t.thumbnail && (
                        <img
                          src={t.thumbnail}
                          alt=""
                          className="h-7 w-7 rounded object-cover shrink-0"
                        />
                      )}
                      <span className="truncate">
                        <span className="font-semibold">{t.title}</span>
                        <span className="text-zinc-400"> — {t.artist}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(t)}
                      className="text-amber-400 hover:text-red-400 cursor-pointer ml-2"
                      title="Remove Favourite"
                    >
                      <Star className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeListTab === 'search' && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {searchQuery.trim() && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs">
                  <span className="text-zinc-300 truncate">
                    Want the exact full song from YouTube for <strong className="text-white">"{searchQuery.trim()}"</strong>?
                  </span>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery.trim())}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-rose-500 px-2.5 py-1 font-semibold text-white hover:bg-rose-400 shrink-0"
                  >
                    Find on YouTube <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {curatedResults.map((c) => {
                const asTrack: RadioTrack = {
                  id: c.id,
                  title: c.title,
                  artist: c.artist,
                  bpm: c.bpm,
                  durationSec: 0,
                  youtubeId: c.youtubeId,
                  youtubeUrl: c.youtubeUrl,
                  thumbnail: c.thumbnail,
                };
                const fav = favorites.some((f) => f.id === asTrack.id);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={c.thumbnail}
                        alt=""
                        className="h-9 w-12 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{c.title}</div>
                        <div className="text-emerald-400 truncate">
                          {c.artist} · Full YouTube Playback
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(asTrack)}
                        className={`p-1.5 rounded cursor-pointer ${
                          fav ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-300'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${fav ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddYouTubeTrack(asTrack, true)}
                        className="rounded bg-amber-500 px-2.5 py-1 font-semibold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                      >
                        Play Full
                      </button>
                    </div>
                  </div>
                );
              })}

              {fullTrackResults.map((r) => {
                const asTrack: RadioTrack = {
                  id: r.id,
                  title: r.title,
                  artist: r.artist,
                  bpm: 100,
                  durationSec: r.durationSec,
                  previewUrl: r.previewUrl,
                  thumbnail: r.artwork,
                };
                const fav = favorites.some((f) => f.id === asTrack.id);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-zinc-900/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {r.artwork ? (
                        <img
                          src={r.artwork}
                          alt=""
                          className="h-9 w-9 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                          <Music2 className="h-4 w-4 text-emerald-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{r.title}</div>
                        <div className="text-emerald-400 truncate">
                          {r.artist} · {r.source}
                          {r.durationSec > 0 ? ` (${formatDuration(r.durationSec)})` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(asTrack)}
                        className={`p-1.5 rounded cursor-pointer ${
                          fav ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-300'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${fav ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPlayExternalTrack(asTrack)}
                        className="rounded bg-emerald-500 px-2.5 py-1 font-semibold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                      >
                        Play Full
                      </button>
                    </div>
                  </div>
                );
              })}

              {itunesResults.map((r) => {
                const asTrack: RadioTrack = {
                  id: r.id,
                  title: r.title,
                  artist: r.artist,
                  bpm: 100,
                  durationSec: 30,
                  previewUrl: r.previewUrl,
                  thumbnail: r.artwork,
                };
                const fav = favorites.some((f) => f.id === asTrack.id);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={r.artwork}
                        alt=""
                        className="h-9 w-9 rounded object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{r.title}</div>
                        <div className="text-zinc-400 truncate">
                          {r.artist} · {r.source}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(asTrack)}
                        className={`p-1.5 rounded cursor-pointer ${
                          fav ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-300'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${fav ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPlayExternalTrack(asTrack)}
                        className="rounded bg-zinc-700 px-2.5 py-1 font-semibold text-white hover:bg-zinc-600 cursor-pointer"
                      >
                        Preview 30s
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
