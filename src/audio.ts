import { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import processorUrl from "@soundtouchjs/audio-worklet/processor?url";

// The engine (Frank 2026-11-18): time-stretch from day one — pitch and tempo
// travel independently. 432 = the pitch side (A=432 ≈ −31.77 cents), ±bpm =
// the tempo side (source rate + node rate move together = pitch compensated).
const CENTS_432 = -31.766;

export class Engine {
  private ctx: AudioContext | null = null;
  master: GainNode | null = null; // public: keeps the graph head referenced
  private lane: GainNode | null = null;
  private node: SoundTouchNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startedAt = 0;

  offset = 0;
  playing = false;
  keySemis = 0;
  is432 = true;
  tempo = 1;
  onEnded: (() => void) | null = null;

  private async ensure(): Promise<void> {
    if (!this.ctx) {
      const ctx = new AudioContext();
      await SoundTouchNode.register(ctx, processorUrl);
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const node = new SoundTouchNode({ context: ctx });
      node.connect(master);
      const lane = ctx.createGain();
      lane.connect(node);
      this.ctx = ctx; this.master = master; this.node = node; this.lane = lane;
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  async load(blob: Blob): Promise<void> {
    await this.ensure();
    this.buffer = await this.ctx!.decodeAudioData(await blob.arrayBuffer());
    this.offset = 0;
  }

  get duration(): number { return this.buffer?.duration ?? 0; }

  get position(): number {
    if (!this.ctx || !this.buffer) return 0;
    const wall = this.playing ? this.ctx.currentTime - this.startedAt : 0;
    return Math.min(this.offset + wall * this.tempo, this.duration);
  }

  private applyTuning(): void {
    if (!this.node) return;
    const cents = this.keySemis * 100 + (this.is432 ? CENTS_432 : 0);
    this.node.pitch.value = Math.pow(2, cents / 1200);
    this.node.playbackRate.value = this.tempo;
  }

  private stopSource(): void {
    if (this.src) {
      this.src.onended = null;
      try { this.src.stop(); } catch { /* already stopped */ }
      this.src.disconnect();
      this.src = null;
    }
  }

  play(): void {
    if (!this.ctx || !this.buffer) return;
    this.stopSource();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.tempo;
    src.connect(this.lane!);
    src.onended = () => {
      if (this.playing && this.position >= this.duration - 0.3) this.onEnded?.();
    };
    src.start(0, this.offset);
    this.src = src;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    this.applyTuning();
  }

  pause(): void {
    this.offset = this.position;
    this.stopSource();
    this.playing = false;
  }

  seek(sec: number): void {
    this.offset = Math.max(0, Math.min(sec, this.duration));
    if (this.playing) this.play();
  }

  // fade out, act, fade in — "fade in out between songs" (the roadmap's own words)
  async swap(action: () => Promise<void> | void): Promise<void> {
    const lane = this.lane;
    if (lane && this.playing) {
      const t = this.ctx!.currentTime;
      lane.gain.cancelScheduledValues(t);
      lane.gain.setValueAtTime(lane.gain.value, t);
      lane.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      await new Promise((r) => setTimeout(r, 520));
    }
    this.pause();
    await action();
    if (lane) {
      const t = this.ctx!.currentTime;
      lane.gain.cancelScheduledValues(t);
      lane.gain.setValueAtTime(0.0001, t);
      lane.gain.linearRampToValueAtTime(1, t + 0.5);
    }
    this.play();
  }

  setKey(semis: number): void { this.keySemis = Math.max(-12, Math.min(12, semis)); this.applyTuning(); }
  setTempo(t: number): void {
    this.tempo = Math.max(0.75, Math.min(1.5, t));
    if (this.src) this.src.playbackRate.value = this.tempo;
    this.applyTuning();
  }
  set432(on: boolean): void { this.is432 = on; this.applyTuning(); }
}
