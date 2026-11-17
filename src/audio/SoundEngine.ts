import { RadioGenre } from '../types/game';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private radioGain: GainNode | null = null;

  // Engine nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Tire screech nodes
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;

  // Nitro nodes
  private nitroGain: GainNode | null = null;

  // Horn nodes
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;

  // Police siren
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  private initialized = false;
  private sfxMuted = false;

  // Radio sequencer state
  private radioPlaying = false;
  private radioVolume = 0.55;
  private radioGenre: RadioGenre = 'hiphop';
  private radioBpm = 94;
  private radioStep = 0;
  private radioTimer: number | null = null;

  public ensureInit(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(ctx.destination);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.masterGain);

      this.radioGain = ctx.createGain();
      this.radioGain.gain.value = this.radioVolume;
      this.radioGain.connect(this.masterGain);

      // Engine synthesizer
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 260;
      this.engineFilter.Q.value = 3.2;

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.engineOsc1 = ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 48;

      this.engineOsc2 = ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 96;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // Noise buffer for tire screech & nitro
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const screechSrc = ctx.createBufferSource();
      screechSrc.buffer = noiseBuffer;
      screechSrc.loop = true;

      this.screechFilter = ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1150;
      this.screechFilter.Q.value = 4.5;

      this.screechGain = ctx.createGain();
      this.screechGain.gain.value = 0;

      screechSrc.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.sfxGain);
      screechSrc.start();

      const nitroSrc = ctx.createBufferSource();
      nitroSrc.buffer = noiseBuffer;
      nitroSrc.loop = true;

      const nitroFilter = ctx.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.value = 620;
      nitroFilter.Q.value = 1.4;

      this.nitroGain = ctx.createGain();
      this.nitroGain.gain.value = 0;

      nitroSrc.connect(nitroFilter);
      nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.sfxGain);
      nitroSrc.start();

      // Dual-tone horn
      this.hornGain = ctx.createGain();
      this.hornGain.gain.value = 0;
      this.hornOsc1 = ctx.createOscillator();
      this.hornOsc1.type = 'sawtooth';
      this.hornOsc1.frequency.value = 392; // G4
      this.hornOsc2 = ctx.createOscillator();
      this.hornOsc2.type = 'sawtooth';
      this.hornOsc2.frequency.value = 493.88; // B4

      const hornFilter = ctx.createBiquadFilter();
      hornFilter.type = 'lowpass';
      hornFilter.frequency.value = 1400;

      this.hornOsc1.connect(hornFilter);
      this.hornOsc2.connect(hornFilter);
      hornFilter.connect(this.hornGain);
      this.hornGain.connect(this.sfxGain);
      this.hornOsc1.start();
      this.hornOsc2.start();

      // Police siren
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 680;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.sfxGain);
      this.sirenOsc.start();

      this.initialized = true;
    } catch {
      // Ignore Web Audio failures in restricted environments
    }
  }

  public setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  public updateVehicleAudio(params: {
    driving: boolean;
    rpm: number;
    maxRpm: number;
    throttle: boolean;
    slipRatio: number;
    nitroActive: boolean;
    hornActive: boolean;
    sirenIntensity: number; // 0..1
  }): void {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (!params.driving || this.sfxMuted) {
      this.engineGain?.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain?.gain.setTargetAtTime(0, now, 0.06);
      this.nitroGain?.gain.setTargetAtTime(0, now, 0.06);
      this.hornGain?.gain.setTargetAtTime(0, now, 0.03);
      this.sirenGain?.gain.setTargetAtTime(0, now, 0.1);
      return;
    }

    const rpmRatio = Math.min(1.15, Math.max(0.08, params.rpm / params.maxRpm));
    const baseFreq = 36 + rpmRatio * 135;

    this.engineOsc1?.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.engineOsc2?.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.04);
    this.engineFilter?.frequency.setTargetAtTime(
      (params.throttle ? 420 : 210) + rpmRatio * 950,
      now,
      0.05
    );
    this.engineGain?.gain.setTargetAtTime(
      params.throttle ? 0.14 + rpmRatio * 0.08 : 0.07,
      now,
      0.06
    );

    // Tire screech
    const screechLevel = Math.min(0.16, Math.max(0, (params.slipRatio - 0.18) * 0.35));
    this.screechGain?.gain.setTargetAtTime(screechLevel, now, 0.04);
    if (this.screechFilter) {
      this.screechFilter.frequency.setTargetAtTime(980 + params.slipRatio * 480, now, 0.05);
    }

    // Nitro
    this.nitroGain?.gain.setTargetAtTime(params.nitroActive ? 0.18 : 0, now, 0.04);

    // Horn
    this.hornGain?.gain.setTargetAtTime(params.hornActive ? 0.14 : 0, now, 0.02);

    // Siren wail
    if (params.sirenIntensity > 0.02 && this.sirenOsc && this.sirenGain) {
      const wail = 660 + Math.sin(now * 6.5) * 240;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.08 * params.sirenIntensity, now, 0.1);
    } else {
      this.sirenGain?.gain.setTargetAtTime(0, now, 0.1);
    }
  }

  public playCollision(strength: number): void {
    if (!this.initialized || !this.ctx || !this.sfxGain || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110 + Math.min(80, strength * 30), now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);

    const vol = Math.min(0.45, 0.12 + strength * 0.15);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playChime(type: 'checkpoint' | 'countdown' | 'go' | 'cash'): void {
    if (!this.initialized || !this.ctx || !this.sfxGain || this.sfxMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'countdown') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    } else if (type === 'go') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.setValueAtTime(1046.5, now + 0.08);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    } else if (type === 'cash') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1318.5, now + 0.07);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // --- Built-in Synth Radio Engine ---
  public setRadioState(playing: boolean, genre: RadioGenre, bpm: number, volume: number): void {
    this.radioVolume = volume;
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }

    const shouldPlaySynth = playing && genre !== 'youtube' && genre !== 'preview';
    const configChanged = this.radioGenre !== genre || this.radioBpm !== bpm;
    this.radioGenre = genre;
    this.radioBpm = bpm || 96;

    if (!shouldPlaySynth) {
      this.stopRadioTimer();
      this.radioPlaying = false;
      return;
    }

    if (!this.radioPlaying || configChanged) {
      this.radioPlaying = true;
      this.startRadioTimer();
    }
  }

  private stopRadioTimer(): void {
    if (this.radioTimer !== null) {
      window.clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
  }

  private startRadioTimer(): void {
    this.stopRadioTimer();
    // 16th-note step interval
    const stepMs = Math.max(85, Math.round((60 / this.radioBpm / 4) * 1000));
    this.radioTimer = window.setInterval(() => {
      if (!this.radioPlaying || !this.ctx || !this.radioGain) return;
      if (this.ctx.state === 'suspended') return;
      this.triggerRadioStep(this.radioStep % 16);
      this.radioStep++;
    }, stepMs);
  }

  private triggerRadioStep(step: number): void {
    if (!this.ctx || !this.radioGain) return;
    const now = this.ctx.currentTime;

    // Genre patterns (16 steps = 1 bar)
    let kickSteps: number[] = [];
    let snareSteps: number[] = [];
    let hatSteps: number[] = [];
    let chordSteps: number[] = [];
    let bassNotes: Record<number, number> = {};
    let chordFreqs: number[] = [220, 261.63, 329.63]; // Am

    switch (this.radioGenre) {
      case 'reggae':
        // One-drop reggae groove
        kickSteps = [8];
        snareSteps = [8];
        hatSteps = [0, 2, 4, 6, 8, 10, 12, 14];
        chordSteps = [2, 6, 10, 14]; // Off-beat skank!
        bassNotes = { 0: 55, 3: 65.41, 6: 73.42, 10: 65.41, 12: 49 };
        chordFreqs = [220, 261.63, 329.63, 392];
        break;
      case 'dancehall':
        // Dembow syncopation
        kickSteps = [0, 4, 8, 12];
        snareSteps = [3, 6, 11, 14];
        hatSteps = [0, 2, 4, 6, 8, 10, 12, 14];
        chordSteps = [0, 6, 12];
        bassNotes = { 0: 65.41, 3: 65.41, 6: 77.78, 8: 65.41, 11: 58.27, 14: 73.42 };
        chordFreqs = [261.63, 311.13, 392];
        break;
      case 'rnb':
        kickSteps = [0, 7, 10];
        snareSteps = [4, 12];
        hatSteps = [0, 2, 4, 6, 8, 10, 12, 14, 15];
        chordSteps = [0, 8];
        bassNotes = { 0: 65.41, 6: 73.42, 8: 58.27, 14: 55 };
        chordFreqs = [261.63, 329.63, 392, 493.88]; // Cmaj7
        break;
      case 'hiphop':
        kickSteps = [0, 3, 8, 10, 14];
        snareSteps = [4, 12];
        hatSteps = [0, 2, 4, 5, 6, 8, 10, 11, 12, 14, 15];
        chordSteps = [0, 10];
        bassNotes = { 0: 49, 3: 49, 8: 58.27, 10: 55, 14: 65.41 };
        chordFreqs = [196, 233.08, 293.66]; // Gm
        break;
      case 'afrobeats':
        // 3-2 clave / log drum groove
        kickSteps = [0, 3, 6, 10, 12];
        snareSteps = [4, 12, 15];
        hatSteps = [0, 2, 4, 6, 8, 10, 12, 14];
        chordSteps = [0, 3, 6, 10];
        bassNotes = { 0: 73.42, 3: 82.41, 6: 98, 10: 82.41, 12: 65.41 };
        chordFreqs = [293.66, 349.23, 440, 523.25]; // Dm7
        break;
      default:
        break;
    }

    if (kickSteps.includes(step)) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
      g.gain.setValueAtTime(0.42, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(g);
      g.connect(this.radioGain);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    if (snareSteps.includes(step)) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(g);
      g.connect(this.radioGain);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    if (hatSteps.includes(step)) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(6200, now);
      g.gain.setValueAtTime(0.035, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(g);
      g.connect(this.radioGain);
      osc.start(now);
      osc.stop(now + 0.04);
    }

    if (bassNotes[step] !== undefined) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = this.radioGenre === 'afrobeats' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(bassNotes[step], now);
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.radioGain);
      osc.start(now);
      osc.stop(now + 0.26);
    }

    if (chordSteps.includes(step)) {
      const dur = this.radioGenre === 'rnb' ? 0.55 : this.radioGenre === 'reggae' ? 0.12 : 0.18;
      chordFreqs.forEach((f) => {
        if (!this.ctx || !this.radioGain) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = this.radioGenre === 'rnb' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f, now);
        filter.type = 'lowpass';
        filter.frequency.value = 1400;
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(filter);
        filter.connect(g);
        g.connect(this.radioGain);
        osc.start(now);
        osc.stop(now + dur + 0.02);
      });
    }
  }

  public dispose(): void {
    this.stopRadioTimer();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.initialized = false;
  }
}
