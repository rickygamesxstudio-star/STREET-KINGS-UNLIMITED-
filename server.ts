import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface RoomPlayerState {
  playerId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  speedKmh: number;
  steerAngle: number;
  specId: string;
  paintColor: string;
  finish: string;
  rimColor: string;
  spoiler: boolean;
  underglowColor: string | null;
  isDrifting: boolean;
  nitroActive: boolean;
  hornActive: boolean;
  playerMode: 'driving' | 'walking';
  cashReported: number;
  lastUpdateMs: number;
  warnings: number;
}

interface RoomRaceState {
  active: boolean;
  raceId: string;
  raceName: string;
  startTimeMs: number;
  countdownEndsMs: number;
  finishedOrder: Array<{ playerId: string; name: string; elapsedMs: number }>;
}

interface TradeOffer {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  offerCash: number;
  requestCash: number;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

interface MultiplayerRoom {
  code: string;
  name: string;
  isPublic: boolean;
  hostId: string;
  weather: string;
  timeOfDay: string;
  carMeet: { x: number; z: number; label: string; hostName: string } | null;
  race: RoomRaceState | null;
  players: Map<string, RoomPlayerState>;
  sockets: Map<string, WebSocket>;
  trades: Map<string, TradeOffer>;
}

const rooms = new Map<string, MultiplayerRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function createRoom(code: string, name: string, isPublic: boolean, hostId: string): MultiplayerRoom {
  const room: MultiplayerRoom = {
    code,
    name,
    isPublic,
    hostId,
    weather: 'clear',
    timeOfDay: 'auto',
    carMeet: null,
    race: null,
    players: new Map(),
    sockets: new Map(),
    trades: new Map(),
  };
  rooms.set(code, room);
  return room;
}

// Seed persistent Jamaica public lobbies
createRoom('KGN001', 'Kingston & Half Way Tree Hub', true, 'system');
createRoom('OCHI01', 'Ocho Rios Beach & Car Meet', true, 'system');
createRoom('PAL001', 'Palisadoes Airport Drag Strip', true, 'system');

function broadcastRoom(room: MultiplayerRoom, payload: unknown, excludeId?: string): void {
  const msg = JSON.stringify(payload);
  room.sockets.forEach((sock, pid) => {
    if (pid !== excludeId && sock.readyState === WebSocket.OPEN) {
      sock.send(msg);
    }
  });
}

function sendSafe(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function serializeRoomSummary(room: MultiplayerRoom) {
  return {
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    playerCount: room.players.size,
    carMeet: room.carMeet,
    raceActive: Boolean(room.race?.active),
  };
}

// Built-in searchable embed-safe full-length music catalog for instant search
const CURATED_MUSIC_LIBRARY = [
  { id: 'cur_yt_1', title: 'Lofi Hip Hop Beats to Drive To', artist: 'Lofi Girl', genre: 'hiphop', bpm: 85, youtubeId: 'jfKfPfyJRdk', youtubeUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg' },
  { id: 'cur_yt_2', title: 'Synthwave Radio - Chill Synth / Retro', artist: 'Lofi Girl Synthwave', genre: 'rnb', bpm: 108, youtubeId: '4xDzrJKXOOY', youtubeUrl: 'https://www.youtube.com/watch?v=4xDzrJKXOOY', thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/mqdefault.jpg' },
  { id: 'cur_yt_3', title: 'Reggae Roots & Kingston Dub Classics', artist: 'Irie Sound System', genre: 'reggae', bpm: 78, youtubeId: '5qap5aO4i9A', youtubeUrl: 'https://www.youtube.com/watch?v=5qap5aO4i9A', thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/mqdefault.jpg' },
  { id: 'cur_yt_4', title: 'Midnight Tokyo Drift Phonk & Bass', artist: 'NightDrive Collective', genre: 'hiphop', bpm: 126, youtubeId: 'MVPTGNGiI-4', youtubeUrl: 'https://www.youtube.com/watch?v=MVPTGNGiI-4', thumbnail: 'https://i.ytimg.com/vi/MVPTGNGiI-4/mqdefault.jpg' },
  { id: 'cur_yt_5', title: 'Afrobeats Summer Cruise Vibes', artist: 'Island Pulse Radio', genre: 'afrobeats', bpm: 112, youtubeId: 'rUxyKA_-grg', youtubeUrl: 'https://www.youtube.com/watch?v=rUxyKA_-grg', thumbnail: 'https://i.ytimg.com/vi/rUxyKA_-grg/mqdefault.jpg' },
  { id: 'cur_yt_6', title: 'Dark R&B Late Night Highway Mix', artist: 'Velvet Sessions', genre: 'rnb', bpm: 88, youtubeId: 'DWcJFNfaw9c', youtubeUrl: 'https://www.youtube.com/watch?v=DWcJFNfaw9c', thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/mqdefault.jpg' },
  { id: 'cur_yt_7', title: 'Caribbean Reggae & Dancehall Beach Mix', artist: 'Kingston Yardsmen', genre: 'dancehall', bpm: 100, youtubeId: '6uddGul0o5E', youtubeUrl: 'https://www.youtube.com/watch?v=6uddGul0o5E', thumbnail: 'https://i.ytimg.com/vi/6uddGul0o5E/mqdefault.jpg' },
  { id: 'cur_yt_8', title: 'NoCopyrightSounds (NCS) High-Speed Drive Mix', artist: 'NCS Arcade', genre: 'hiphop', bpm: 128, youtubeId: '7NOSDKb0HlU', youtubeUrl: 'https://www.youtube.com/watch?v=7NOSDKb0HlU', thumbnail: 'https://i.ytimg.com/vi/7NOSDKb0HlU/mqdefault.jpg' },
];

let sharedGenAi: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!sharedGenAi) {
    sharedGenAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return sharedGenAi;
}

interface GroundingPlaceLink {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

function extractGroundingLinks(response: unknown): GroundingPlaceLink[] {
  const r = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          maps?: {
            uri?: string;
            title?: string;
            placeId?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{ content?: string }>;
            };
          };
        }>;
      };
    }>;
  };
  const chunks = r?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const results: GroundingPlaceLink[] = [];
  const seen = new Set<string>();
  for (const ch of chunks) {
    const uri = ch?.maps?.uri;
    const title = ch?.maps?.title;
    if (!uri) continue;
    const dedupeKey = `${uri}::${title || ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const snippets = (ch?.maps?.placeAnswerSources?.reviewSnippets || [])
      .map((s) => s?.content)
      .filter((s): s is string => Boolean(s));
    results.push({
      title: title || 'View on Google Maps',
      uri,
      placeId: ch?.maps?.placeId,
      reviewSnippets: snippets.length > 0 ? snippets : undefined,
    });
  }
  return results;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err || 'Gemini API request failed.');
  const lower = msg.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Gemini API quota reached or rate-limited (429 RESOURCE_EXHAUSTED). Please wait a moment or check your key billing tier in Settings > Secrets.',
    };
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message:
        'Gemini API access denied (403 PERMISSION_DENIED). Please check your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (lower.includes('api_key_invalid') || lower.includes('400')) {
    return {
      status: 400,
      message:
        'Gemini API request or key was rejected (400). Verify GEMINI_API_KEY in Settings > Secrets and request format.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: `Requested Gemini model was not found (404): ${msg}`,
    };
  }
  return { status: 502, message: msg };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const getExpectedAdminCode = (): string =>
    (process.env.ADMIN_CODE || 'KING2025').trim().toUpperCase();

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      rooms: rooms.size,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post('/api/admin/verify', (req, res) => {
    const submitted = String((req.body as { code?: string })?.code || '')
      .trim()
      .toUpperCase();
    if (!submitted) {
      res.status(400).json({ error: 'Please enter an admin code.' });
      return;
    }
    if (submitted !== getExpectedAdminCode()) {
      res.status(401).json({ error: 'Invalid Admin Code. Access denied.' });
      return;
    }
    res.json({
      ok: true,
      role: 'MASTER_ADMIN',
      message: 'Admin privileges unlocked.',
    });
  });

  // Multi-turn Gemini Co-Pilot Chat (gemini-4-hydrogen & gemini-3.1-flash-lite)
  app.post('/api/gemini/chat', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable AI Co-Pilot.',
      });
      return;
    }

    const body = (req.body || {}) as {
      model?: string;
      reasoningMode?: 'fast' | 'standard' | 'deep' | 'maps';
      systemInstruction?: string;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
      message?: string;
      location?: { lat: number; lng: number } | null;
    };

    const userMessage = String(body.message || '').trim();
    if (!userMessage) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const mode = body.reasoningMode || 'standard';
    const selectedModel =
      mode === 'fast' || body.model === 'gemini-3.1-flash-lite'
        ? 'gemini-3.1-flash-lite'
        : 'gemini-4-hydrogen';

    const thinkingLevel =
      selectedModel === 'gemini-3.1-flash-lite'
        ? ThinkingLevel.MINIMAL
        : mode === 'deep'
        ? ThinkingLevel.XHIGH
        : ThinkingLevel.HIGH;

    const formattedHistory = Array.isArray(body.history)
      ? body.history
          .filter((h) => h && (h.role === 'user' || h.role === 'model') && String(h.text || '').trim())
          .slice(-24)
          .map((h) => ({
            role: h.role,
            parts: [{ text: String(h.text) }],
          }))
      : [];

    const config: Record<string, unknown> = {
      systemInstruction:
        String(body.systemInstruction || '').trim() ||
        'You are the Street Kings: Unlimited Race Strategist, Automotive Tuner, and Navigation Co-Pilot.',
      thinkingConfig: { thinkingLevel },
    };

    if (mode === 'maps' && selectedModel === 'gemini-4-hydrogen') {
      config.tools = [{ googleMaps: {} }];
      if (
        body.location &&
        Number.isFinite(body.location.lat) &&
        Number.isFinite(body.location.lng)
      ) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: body.location.lat,
              longitude: body.location.lng,
            },
          },
        };
      }
    }

    try {
      const chat = ai.chats.create({
        model: selectedModel,
        config,
        history: formattedHistory,
      });

      const response = await chat.sendMessage({ message: userMessage });
      const groundingLinks = mode === 'maps' ? extractGroundingLinks(response) : [];
      res.json({
        text: (response.text || '').trim(),
        model: selectedModel,
        thinkingLevel,
        groundingLinks,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Google Maps Grounding Explorer (gemini-4-hydrogen + { googleMaps: {} })
  app.post('/api/gemini/maps-grounding', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable Maps Grounding.',
      });
      return;
    }

    const body = (req.body || {}) as {
      query?: string;
      location?: { lat: number; lng: number } | null;
    };

    const query = String(body.query || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Search query is required for Maps Grounding.' });
      return;
    }

    const config: Record<string, unknown> = {
      tools: [{ googleMaps: {} }],
      systemInstruction:
        'You are an automotive cruise & location scout. Answer clearly in Markdown with real verified places, distances, and helpful driving context.',
    };

    if (
      body.location &&
      Number.isFinite(body.location.lat) &&
      Number.isFinite(body.location.lng)
    ) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: body.location.lat,
            longitude: body.location.lng,
          },
        },
      };
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: query,
        config,
      });
      const groundingLinks = extractGroundingLinks(response);
      res.json({
        text: (response.text || '').trim(),
        groundingLinks,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Microphone Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/gemini/transcribe', async (req, res) => {
    const ai = getGenAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable Audio Transcription.',
      });
      return;
    }

    const body = (req.body || {}) as {
      audioBase64?: string;
      mimeType?: string;
      prompt?: string;
    };

    const audioBase64 = String(body.audioBase64 || '').trim();
    const mimeType = String(body.mimeType || 'audio/webm').split(';')[0].trim();
    if (!audioBase64) {
      res.status(400).json({ error: 'Audio payload is empty.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text:
                String(body.prompt || '').trim() ||
                'Transcribe the spoken audio accurately. Output only the spoken transcript.',
            },
          ],
        },
      });
      res.json({ text: (response.text || '').trim() });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/servers', (_req, res) => {
    const list = Array.from(rooms.values())
      .filter((r) => r.isPublic)
      .map(serializeRoomSummary);
    res.json({ servers: list });
  });

  // Official YouTube oEmbed metadata lookup (zero scraping, zero restriction bypass)
  app.get('/api/music/oembed', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    try {
      const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
      const resp = await fetch(oembedEndpoint, { signal: AbortSignal.timeout(4500) });
      if (!resp.ok) {
        res.status(resp.status).json({
          error: resp.status === 401 || resp.status === 403
            ? 'Embedding is disabled or restricted by the YouTube video owner.'
            : 'Could not retrieve metadata for this YouTube link.',
        });
        return;
      }
      const data = await resp.json() as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      res.json({
        title: data.title || 'YouTube Track',
        artist: data.author_name || 'YouTube Channel',
        thumbnail: data.thumbnail_url || null,
        embeddable: true,
      });
    } catch {
      res.status(502).json({
        error: 'Could not reach YouTube oEmbed metadata service from this environment.',
      });
    }
  });

  // Song / Artist Search: Full-Length YouTube (if YOUTUBE_API_KEY set) + Curated YouTube + Audius Full-Length Streams + iTunes 30s Preview Fallback
  app.get('/api/music/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.json({ curated: CURATED_MUSIC_LIBRARY, fullTracks: [], results: [] });
      return;
    }
    const qLower = query.toLowerCase();
    const curatedMatches = [...CURATED_MUSIC_LIBRARY.filter(
      (item) =>
        item.title.toLowerCase().includes(qLower) ||
        item.artist.toLowerCase().includes(qLower) ||
        item.genre.toLowerCase().includes(qLower)
    )];

    // Official YouTube Data API v3 search if YOUTUBE_API_KEY is configured
    const ytKey = process.env.YOUTUBE_API_KEY;
    if (ytKey) {
      try {
        const ytApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=${encodeURIComponent(query)}&key=${encodeURIComponent(ytKey)}`;
        const ytResp = await fetch(ytApiUrl, { signal: AbortSignal.timeout(4500) });
        if (ytResp.ok) {
          const ytJson = (await ytResp.json()) as {
            items?: Array<{
              id?: { videoId?: string };
              snippet?: {
                title?: string;
                channelTitle?: string;
                thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
              };
            }>;
          };
          (ytJson.items || []).forEach((item) => {
            const vid = item.id?.videoId;
            if (!vid || curatedMatches.some((c) => c.youtubeId === vid)) return;
            curatedMatches.push({
              id: `yt_api_${vid}`,
              title: item.snippet?.title || 'YouTube Track',
              artist: item.snippet?.channelTitle || 'YouTube',
              genre: 'youtube',
              bpm: 100,
              youtubeId: vid,
              youtubeUrl: `https://www.youtube.com/watch?v=${vid}`,
              thumbnail:
                item.snippet?.thumbnails?.medium?.url ||
                item.snippet?.thumbnails?.default?.url ||
                `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
            });
          });
        }
      } catch {
        // continue gracefully
      }
    }

    // Official Audius Open API (Full-length tracks, not 30s previews)
    let fullTracks: Array<{
      id: string;
      title: string;
      artist: string;
      album: string;
      artwork: string;
      previewUrl: string;
      durationSec: number;
      source: string;
    }> = [];

    try {
      const audiusUrl = `https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=StreetKingsJamaica`;
      const audiusResp = await fetch(audiusUrl, { signal: AbortSignal.timeout(4000) });
      if (audiusResp.ok) {
        const audiusJson = (await audiusResp.json()) as {
          data?: Array<{
            id?: string;
            title?: string;
            duration?: number;
            user?: { name?: string };
            artwork?: { '150x150'?: string; '480x480'?: string };
            is_streamable?: boolean;
          }>;
        };
        fullTracks = (audiusJson.data || [])
          .filter((t) => t.id && t.is_streamable !== false)
          .slice(0, 8)
          .map((t) => ({
            id: `audius_${t.id}`,
            title: t.title || 'Untitled Track',
            artist: t.user?.name || 'Independent Artist',
            album: 'Full Song Stream',
            artwork:
              t.artwork?.['480x480'] ||
              t.artwork?.['150x150'] ||
              '',
            previewUrl: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(t.id!)}/stream?app_name=StreetKingsJamaica`,
            durationSec: Number(t.duration) || 0,
            source: 'Full Song (Audius)',
          }));
      }
    } catch {
      // continue gracefully
    }

    let itunesResults: Array<{
      id: string;
      title: string;
      artist: string;
      album: string;
      artwork: string;
      previewUrl: string;
      source: string;
    }> = [];

    try {
      const apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=8`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
      if (resp.ok) {
        const json = await resp.json() as {
          results?: Array<{
            trackId: number;
            trackName: string;
            artistName: string;
            collectionName: string;
            artworkUrl100: string;
            previewUrl?: string;
          }>;
        };
        itunesResults = (json.results || [])
          .filter((r) => Boolean(r.previewUrl))
          .map((r) => ({
            id: `itunes_${r.trackId}`,
            title: r.trackName,
            artist: r.artistName,
            album: r.collectionName || 'Single',
            artwork: r.artworkUrl100,
            previewUrl: r.previewUrl || '',
            source: '30s Preview (iTunes)',
          }));
      }
    } catch {
      // Offline / sandbox fallback safely returns curated matches
    }

    res.json({ curated: curatedMatches, fullTracks, results: itunesResults });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentRoom: MultiplayerRoom | null = null;
    let currentPlayerId = '';

    const leaveCurrentRoom = () => {
      if (!currentRoom || !currentPlayerId) return;
      currentRoom.players.delete(currentPlayerId);
      currentRoom.sockets.delete(currentPlayerId);
      broadcastRoom(currentRoom, {
        type: 'player:left',
        playerId: currentPlayerId,
      });
      // Clean up empty private rooms after disconnect
      if (!currentRoom.isPublic && currentRoom.players.size === 0) {
        rooms.delete(currentRoom.code);
      } else if (currentRoom.hostId === currentPlayerId && currentRoom.players.size > 0) {
        const nextHost = currentRoom.players.keys().next().value;
        if (nextHost) currentRoom.hostId = nextHost;
      }
      currentRoom = null;
    };

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room:create') {
        leaveCurrentRoom();
        const playerId = String(msg.playerId || `p_${Date.now()}_${Math.floor(Math.random() * 999)}`);
        const playerName = String(msg.name || 'StreetRacer').slice(0, 22);
        const roomName = String(msg.roomName || `${playerName}'s Cruise`).slice(0, 36);
        const isPublic = Boolean(msg.isPublic);
        const code = generateRoomCode();
        const room = createRoom(code, roomName, isPublic, playerId);

        currentRoom = room;
        currentPlayerId = playerId;
        room.sockets.set(playerId, ws);

        const initPlayer: RoomPlayerState = {
          playerId,
          name: playerName,
          x: Number(msg.x) || 0,
          y: Number(msg.y) || 0,
          z: Number(msg.z) || 24,
          heading: Number(msg.heading) || 0,
          speedKmh: 0,
          steerAngle: 0,
          specId: String(msg.specId || 'vortex_gtr'),
          paintColor: String(msg.paintColor || '#e11d48'),
          finish: String(msg.finish || 'metallic'),
          rimColor: String(msg.rimColor || '#e4e4e7'),
          spoiler: Boolean(msg.spoiler),
          underglowColor: msg.underglowColor ? String(msg.underglowColor) : null,
          isDrifting: false,
          nitroActive: false,
          hornActive: false,
          playerMode: 'driving',
          cashReported: Math.max(0, Math.min(50000000, Number(msg.cash) || 0)),
          lastUpdateMs: Date.now(),
          warnings: 0,
        };
        room.players.set(playerId, initPlayer);

        sendSafe(ws, {
          type: 'room:joined',
          room: {
            code: room.code,
            name: room.name,
            isPublic: room.isPublic,
            hostId: room.hostId,
            carMeet: room.carMeet,
            race: room.race,
          },
          players: Array.from(room.players.values()),
        });
        return;
      }

      if (type === 'room:join') {
        const code = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendSafe(ws, {
            type: 'room:error',
            error: `No active room found with code "${code}". Check the 6-character code and try again.`,
          });
          return;
        }
        leaveCurrentRoom();
        const playerId = String(msg.playerId || `p_${Date.now()}_${Math.floor(Math.random() * 999)}`);
        const playerName = String(msg.name || 'StreetRacer').slice(0, 22);
        currentRoom = room;
        currentPlayerId = playerId;
        room.sockets.set(playerId, ws);

        const initPlayer: RoomPlayerState = {
          playerId,
          name: playerName,
          x: Number(msg.x) || 0,
          y: Number(msg.y) || 0,
          z: Number(msg.z) || 24,
          heading: Number(msg.heading) || 0,
          speedKmh: 0,
          steerAngle: 0,
          specId: String(msg.specId || 'vortex_gtr'),
          paintColor: String(msg.paintColor || '#e11d48'),
          finish: String(msg.finish || 'metallic'),
          rimColor: String(msg.rimColor || '#e4e4e7'),
          spoiler: Boolean(msg.spoiler),
          underglowColor: msg.underglowColor ? String(msg.underglowColor) : null,
          isDrifting: false,
          nitroActive: false,
          hornActive: false,
          playerMode: 'driving',
          cashReported: Math.max(0, Math.min(50000000, Number(msg.cash) || 0)),
          lastUpdateMs: Date.now(),
          warnings: 0,
        };
        room.players.set(playerId, initPlayer);

        sendSafe(ws, {
          type: 'room:joined',
          room: {
            code: room.code,
            name: room.name,
            isPublic: room.isPublic,
            hostId: room.hostId,
            carMeet: room.carMeet,
            race: room.race,
          },
          players: Array.from(room.players.values()),
        });

        broadcastRoom(
          room,
          { type: 'player:joined', player: initPlayer },
          playerId
        );
        return;
      }

      if (type === 'room:leave') {
        leaveCurrentRoom();
        sendSafe(ws, { type: 'room:left' });
        return;
      }

      if (!currentRoom || !currentPlayerId) return;
      const pState = currentRoom.players.get(currentPlayerId);
      if (!pState) return;

      if (type === 'player:state') {
        const now = Date.now();
        const dtSec = Math.max(0.02, (now - pState.lastUpdateMs) / 1000);
        const nx = Number(msg.x);
        const ny = Number(msg.y);
        const nz = Number(msg.z);
        const speedKmh = Math.max(0, Math.min(480, Number(msg.speedKmh) || 0));

        // Anti-Cheat: reject impossible teleportation jumps without fast-travel flag
        const distMoved = Math.hypot(nx - pState.x, nz - pState.z);
        const impliedKmh = (distMoved / dtSec) * 3.6;
        const fastTravel = Boolean(msg.fastTravel);

        if (!fastTravel && dtSec < 1.2 && impliedKmh > 560 && distMoved > 40) {
          pState.warnings += 1;
          sendSafe(ws, {
            type: 'anticheat:warning',
            reason: 'Abnormal movement speed detected; position reconciled to server state.',
            x: pState.x,
            z: pState.z,
          });
          return;
        }

        pState.x = Math.max(-1100, Math.min(1100, nx));
        pState.y = Math.max(-20, Math.min(200, ny));
        pState.z = Math.max(-1100, Math.min(1100, nz));
        pState.heading = Number(msg.heading) || 0;
        pState.speedKmh = speedKmh;
        pState.steerAngle = Number(msg.steerAngle) || 0;
        pState.specId = String(msg.specId || pState.specId);
        pState.paintColor = String(msg.paintColor || pState.paintColor);
        pState.finish = String(msg.finish || pState.finish);
        pState.rimColor = String(msg.rimColor || pState.rimColor);
        pState.spoiler = Boolean(msg.spoiler);
        pState.underglowColor = msg.underglowColor ? String(msg.underglowColor) : null;
        pState.isDrifting = Boolean(msg.isDrifting);
        pState.nitroActive = Boolean(msg.nitroActive);
        pState.hornActive = Boolean(msg.hornActive);
        pState.playerMode = msg.playerMode === 'walking' ? 'walking' : 'driving';
        pState.lastUpdateMs = now;

        broadcastRoom(
          currentRoom,
          { type: 'player:update', player: pState },
          currentPlayerId
        );
        return;
      }

      if (type === 'room:chat') {
        const text = String(msg.text || '').trim().slice(0, 180);
        if (!text) return;
        broadcastRoom(currentRoom, {
          type: 'room:chat',
          fromId: currentPlayerId,
          fromName: pState.name,
          text,
          timestamp: Date.now(),
        });
        return;
      }

      if (type === 'room:car_meet') {
        const meet = {
          x: Number(msg.x) || pState.x,
          z: Number(msg.z) || pState.z,
          label: String(msg.label || `${pState.name}'s Car Meet`).slice(0, 40),
          hostName: pState.name,
        };
        currentRoom.carMeet = meet;
        broadcastRoom(currentRoom, { type: 'room:car_meet', carMeet: meet });
        return;
      }

      if (type === 'room:race_start') {
        const raceId = String(msg.raceId || 'race_downtown_sprint');
        const raceName = String(msg.raceName || 'Multiplayer Street Race');
        const now = Date.now();
        currentRoom.race = {
          active: true,
          raceId,
          raceName,
          startTimeMs: now,
          countdownEndsMs: now + 3500,
          finishedOrder: [],
        };
        broadcastRoom(currentRoom, {
          type: 'room:race_start',
          race: currentRoom.race,
          starterName: pState.name,
        });
        return;
      }

      if (type === 'room:race_finish') {
        if (!currentRoom.race || !currentRoom.race.active) return;
        const already = currentRoom.race.finishedOrder.some(
          (f) => f.playerId === currentPlayerId
        );
        if (!already) {
          currentRoom.race.finishedOrder.push({
            playerId: currentPlayerId,
            name: pState.name,
            elapsedMs: Date.now() - currentRoom.race.countdownEndsMs,
          });
          broadcastRoom(currentRoom, {
            type: 'room:race_update',
            race: currentRoom.race,
          });
        }
        return;
      }

      // Secure P2P Trade Escrow
      if (type === 'trade:offer') {
        const toId = String(msg.toId || '');
        const targetPlayer = currentRoom.players.get(toId);
        const targetSocket = currentRoom.sockets.get(toId);
        if (!targetPlayer || !targetSocket) {
          sendSafe(ws, { type: 'trade:error', error: 'Target player is no longer in the room.' });
          return;
        }
        const offerCash = Math.max(0, Math.floor(Number(msg.offerCash) || 0));
        const requestCash = Math.max(0, Math.floor(Number(msg.requestCash) || 0));
        // Anti-cheat validation against player's reported session balance
        if (offerCash > pState.cashReported || offerCash > 5000000) {
          sendSafe(ws, { type: 'trade:error', error: 'Trade rejected by server anti-cheat: insufficient verified cash.' });
          return;
        }
        const trade: TradeOffer = {
          id: `tr_${Date.now()}_${Math.floor(Math.random() * 999)}`,
          fromId: currentPlayerId,
          fromName: pState.name,
          toId,
          toName: targetPlayer.name,
          offerCash,
          requestCash,
          status: 'pending',
        };
        currentRoom.trades.set(trade.id, trade);
        sendSafe(targetSocket, { type: 'trade:incoming', trade });
        sendSafe(ws, { type: 'trade:sent', trade });
        return;
      }

      if (type === 'trade:respond') {
        const tradeId = String(msg.tradeId || '');
        const accept = Boolean(msg.accept);
        const trade = currentRoom.trades.get(tradeId);
        if (!trade || trade.toId !== currentPlayerId || trade.status !== 'pending') {
          return;
        }
        const fromSock = currentRoom.sockets.get(trade.fromId);
        const fromPlayer = currentRoom.players.get(trade.fromId);
        if (!accept || !fromPlayer) {
          trade.status = 'declined';
          if (fromSock) sendSafe(fromSock, { type: 'trade:resolved', trade });
          sendSafe(ws, { type: 'trade:resolved', trade });
          return;
        }
        if (trade.requestCash > pState.cashReported) {
          trade.status = 'cancelled';
          sendSafe(ws, { type: 'trade:error', error: 'Insufficient cash to complete trade.' });
          return;
        }
        // Authoritative balance transfer
        fromPlayer.cashReported = fromPlayer.cashReported - trade.offerCash + trade.requestCash;
        pState.cashReported = pState.cashReported + trade.offerCash - trade.requestCash;
        trade.status = 'accepted';
        if (fromSock) sendSafe(fromSock, { type: 'trade:resolved', trade });
        sendSafe(ws, { type: 'trade:resolved', trade });
        return;
      }

      // Authorized Room Admin Commands (verified against ADMIN_CODE)
      if (type.startsWith('admin:')) {
        const suppliedCode = String(msg.adminCode || '').trim().toUpperCase();
        if (!suppliedCode || suppliedCode !== getExpectedAdminCode()) {
          sendSafe(ws, { type: 'room:error', error: 'Unauthorized admin command rejected.' });
          return;
        }

        if (type === 'admin:announce') {
          const text = String(msg.text || '').trim().slice(0, 180);
          if (!text) return;
          broadcastRoom(currentRoom, {
            type: 'admin:broadcast',
            adminName: pState.name,
            text,
          });
          broadcastRoom(currentRoom, {
            type: 'room:chat',
            fromId: currentPlayerId,
            fromName: `[ADMIN] ${pState.name}`,
            text,
            timestamp: Date.now(),
          });
          return;
        }

        if (type === 'admin:weather') {
          const weather = String(msg.weather || 'clear');
          const timeOfDay = String(msg.timeOfDay || 'auto');
          currentRoom.weather = weather;
          currentRoom.timeOfDay = timeOfDay;
          broadcastRoom(currentRoom, {
            type: 'admin:weather',
            adminName: pState.name,
            weather,
            timeOfDay,
          });
          return;
        }

        if (type === 'admin:kick') {
          const targetId = String(msg.targetPlayerId || '');
          if (!targetId || targetId === currentPlayerId) return;
          const targetSock = currentRoom.sockets.get(targetId);
          currentRoom.players.delete(targetId);
          currentRoom.sockets.delete(targetId);
          if (targetSock) {
            sendSafe(targetSock, {
              type: 'admin:kicked',
              reason: `Removed from room ${currentRoom.code} by Admin (${pState.name}).`,
            });
          }
          broadcastRoom(currentRoom, {
            type: 'player:left',
            playerId: targetId,
          });
        }
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom();
    });
  });

  if (IS_PROD) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`STREET KINGS: JAMAICA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
