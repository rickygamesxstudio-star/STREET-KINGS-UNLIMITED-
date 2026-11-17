import {
  MultiplayerRoomInfo,
  RemotePlayerState,
  TradeOfferPayload,
} from '../types/game';

export interface MultiplayerEvents {
  onConnectionChange: (connected: boolean) => void;
  onRoomJoined: (room: MultiplayerRoomInfo, players: RemotePlayerState[]) => void;
  onRoomLeft: () => void;
  onRoomError: (err: string) => void;
  onPlayerJoined: (player: RemotePlayerState) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerUpdate: (player: RemotePlayerState) => void;
  onChat: (msg: { fromId: string; fromName: string; text: string; timestamp: number }) => void;
  onCarMeet: (meet: { x: number; z: number; label: string; hostName: string }) => void;
  onRaceStart: (race: MultiplayerRoomInfo['race'], starterName: string) => void;
  onRaceUpdate: (race: MultiplayerRoomInfo['race']) => void;
  onTradeIncoming: (trade: TradeOfferPayload) => void;
  onTradeResolved: (trade: TradeOfferPayload) => void;
  onTradeError: (err: string) => void;
  onAntiCheatWarning: (reason: string, x: number, z: number) => void;
  onAdminBroadcast?: (text: string, adminName: string) => void;
  onAdminWeather?: (weather: string, timeOfDay: string, adminName: string) => void;
  onAdminKicked?: (reason: string) => void;
}

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private events: MultiplayerEvents;
  private playerId: string;
  private intentionalClose = false;
  private reconnectTimer: number | null = null;

  constructor(playerId: string, events: MultiplayerEvents) {
    this.playerId = playerId;
    this.events = events;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.intentionalClose = false;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.events.onConnectionChange(true);
    };

    ws.onclose = () => {
      this.events.onConnectionChange(false);
      if (!this.intentionalClose) {
        this.reconnectTimer = window.setTimeout(() => this.connect(), 3000);
      }
    };

    ws.onerror = () => {
      this.events.onConnectionChange(false);
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }

      const type = String(msg.type || '');
      if (type === 'room:joined') {
        this.events.onRoomJoined(
          msg.room as MultiplayerRoomInfo,
          (msg.players as RemotePlayerState[]) || []
        );
      } else if (type === 'room:left') {
        this.events.onRoomLeft();
      } else if (type === 'room:error') {
        this.events.onRoomError(String(msg.error || 'Room error'));
      } else if (type === 'player:joined') {
        this.events.onPlayerJoined(msg.player as RemotePlayerState);
      } else if (type === 'player:left') {
        this.events.onPlayerLeft(String(msg.playerId));
      } else if (type === 'player:update') {
        this.events.onPlayerUpdate(msg.player as RemotePlayerState);
      } else if (type === 'room:chat') {
        this.events.onChat(
          msg as unknown as { fromId: string; fromName: string; text: string; timestamp: number }
        );
      } else if (type === 'room:car_meet') {
        this.events.onCarMeet(
          msg.carMeet as { x: number; z: number; label: string; hostName: string }
        );
      } else if (type === 'room:race_start') {
        this.events.onRaceStart(
          msg.race as MultiplayerRoomInfo['race'],
          String(msg.starterName || 'Host')
        );
      } else if (type === 'room:race_update') {
        this.events.onRaceUpdate(msg.race as MultiplayerRoomInfo['race']);
      } else if (type === 'trade:incoming') {
        this.events.onTradeIncoming(msg.trade as TradeOfferPayload);
      } else if (type === 'trade:resolved') {
        this.events.onTradeResolved(msg.trade as TradeOfferPayload);
      } else if (type === 'trade:error') {
        this.events.onTradeError(String(msg.error || 'Trade error'));
      } else if (type === 'anticheat:warning') {
        this.events.onAntiCheatWarning(
          String(msg.reason || 'Movement reconciled'),
          Number(msg.x) || 0,
          Number(msg.z) || 0
        );
      } else if (type === 'admin:broadcast') {
        this.events.onAdminBroadcast?.(
          String(msg.text || ''),
          String(msg.adminName || 'Admin')
        );
      } else if (type === 'admin:weather') {
        this.events.onAdminWeather?.(
          String(msg.weather || 'clear'),
          String(msg.timeOfDay || 'auto'),
          String(msg.adminName || 'Admin')
        );
      } else if (type === 'admin:kicked') {
        this.events.onAdminKicked?.(String(msg.reason || 'Removed by Admin.'));
        this.events.onRoomLeft();
      }
    };
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public createRoom(params: {
    name: string;
    roomName: string;
    isPublic: boolean;
    x: number;
    y: number;
    z: number;
    heading: number;
    specId: string;
    paintColor: string;
    finish: string;
    rimColor: string;
    spoiler: boolean;
    underglowColor: string | null;
    cash: number;
  }): void {
    this.connect();
    const attempt = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'room:create', playerId: this.playerId, ...params });
      } else {
        window.setTimeout(attempt, 120);
      }
    };
    attempt();
  }

  public joinRoom(params: {
    code: string;
    name: string;
    x: number;
    y: number;
    z: number;
    heading: number;
    specId: string;
    paintColor: string;
    finish: string;
    rimColor: string;
    spoiler: boolean;
    underglowColor: string | null;
    cash: number;
  }): void {
    this.connect();
    const attempt = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'room:join', playerId: this.playerId, ...params });
      } else {
        window.setTimeout(attempt, 120);
      }
    };
    attempt();
  }

  public leaveRoom(): void {
    this.send({ type: 'room:leave' });
  }

  public sendState(state: Omit<RemotePlayerState, 'playerId' | 'name'> & { fastTravel?: boolean }): void {
    this.send({ type: 'player:state', ...state });
  }

  public sendChat(text: string): void {
    this.send({ type: 'room:chat', text });
  }

  public hostCarMeet(x: number, z: number, label: string): void {
    this.send({ type: 'room:car_meet', x, z, label });
  }

  public startRoomRace(raceId: string, raceName: string): void {
    this.send({ type: 'room:race_start', raceId, raceName });
  }

  public notifyRaceFinished(): void {
    this.send({ type: 'room:race_finish' });
  }

  public sendTradeOffer(toId: string, offerCash: number, requestCash: number): void {
    this.send({ type: 'trade:offer', toId, offerCash, requestCash });
  }

  public respondTrade(tradeId: string, accept: boolean): void {
    this.send({ type: 'trade:respond', tradeId, accept });
  }

  public sendAdminAnnounce(adminCode: string, text: string): void {
    this.send({ type: 'admin:announce', adminCode, text });
  }

  public sendAdminWeather(adminCode: string, weather: string, timeOfDay: string): void {
    this.send({ type: 'admin:weather', adminCode, weather, timeOfDay });
  }

  public sendAdminKick(adminCode: string, targetPlayerId: string): void {
    this.send({ type: 'admin:kick', adminCode, targetPlayerId });
  }

  public dispose(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
