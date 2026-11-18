// Tuning detection (Frank's roadmap #6/#7, 2026-11-18): every note in a tuned
// song sits the same distance off the standard grid — measure the notes and
// take the vote. Harmonics vote like their fundamentals (exact multiples), so
// even noisy peaks land on the same histogram. Pure math, no dependencies —
// analyzeTuning runs on plain arrays so node can test it (the synth suite).

export interface Tuning {
  cents: number;       // the source's offset from the 440 grid, [-50, 50)
  confidence: number;  // the peak's vote share, 0..1
}

// iterative radix-2 FFT, in place
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + half] * cr - im[i + k + half] * ci;
        const vi = re[i + k + half] * ci + im[i + k + half] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + half] = ur - vr; im[i + k + half] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export function analyzeTuning(samples: Float32Array, sampleRate: number, maxFrames = 240): Tuning {
  const size = 4096;          // the analysis window
  const FFT = size * 4;       // zero-padded 4x: bin centers are ~2.7Hz apart
  const frames = Math.min(maxFrames, Math.floor(samples.length / size));
  const hist = new Float64Array(100); // cents -50..+49
  let total = 0;
  const hop = frames > 1 ? Math.floor((samples.length - size) / (frames - 1)) : 0;

  for (let i = 0; i < frames; i++) {
    const start = i * hop;
    const re = new Float64Array(FFT);
    const im = new Float64Array(FFT);
    for (let s = 0; s < size; s++) {
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * s) / (size - 1));
      re[s] = samples[start + s] * hann;
    }
    fft(re, im);

    const half = FFT >> 1;
    const mags = new Float64Array(half);
    let max = 0;
    for (let b = 2; b < half; b++) {
      mags[b] = Math.hypot(re[b], im[b]);
      if (mags[b] > max) max = mags[b];
    }
    if (max <= 0) continue;
    const thresh = max * 0.06;

    // local maxima, strongest 8 per frame
    const peaks: Array<[number, number]> = [];
    for (let b = 2; b < half - 1; b++) {
      if (mags[b] > thresh && mags[b] > mags[b - 1] && mags[b] >= mags[b + 1]) {
        peaks.push([b, mags[b]]);
      }
    }
    peaks.sort((a, b) => b[1] - a[1]);
    for (const [b, m] of peaks.slice(0, 8)) {
      // parabolic interpolation between bins (log-magnitude) — bin centers
      // quantize to whole bins and that cost ±5c at the low end
      const eps = 1e-12;
      const a = Math.log(mags[b - 1] + eps);
      const bb = Math.log(mags[b] + eps);
      const c = Math.log(mags[b + 1] + eps);
      const den = a - 2 * bb + c;
      const delta = den !== 0 ? 0.5 * (a - c) / den : 0;
      const f = ((b + delta) * sampleRate) / FFT;
      if (f < 110 || f > 2500) continue; // low notes vote through their harmonics
      const midi = 69 + 12 * Math.log2(f / 440);
      const residual = midi - Math.round(midi); // the off-grid part
      const c2 = Math.round(residual * 100);
      const bin = (((c2 + 50) % 100) + 100) % 100; // wrap to [-50, 50)
      hist[bin] += m;
      total += m;
    }
  }

  if (total <= 0) return { cents: 0, confidence: 0 };

  // smooth ±2 cents, then the peak = the tuning they agree on
  const smooth = new Float64Array(100);
  for (let i = 0; i < 100; i++) {
    let s = 0;
    for (let d = -2; d <= 2; d++) s += hist[(((i + d) % 100) + 100) % 100];
    smooth[i] = s;
  }
  let best = 0;
  for (let i = 1; i < 100; i++) if (smooth[i] > smooth[best]) best = i;

  let near = 0;
  for (let d = -2; d <= 2; d++) near += hist[(((best + d) % 100) + 100) % 100];
  return { cents: best - 50, confidence: near / total };
}

export function analyzeTuningFromBuffer(buffer: AudioBuffer): Tuning {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const mono = new Float32Array(ch0.length);
  if (ch1) {
    for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5;
  } else {
    mono.set(ch0);
  }
  return analyzeTuning(mono, buffer.sampleRate);
}

// the human-readable verdict for a track badge
export function tuningLabel(t: Tuning | null | undefined): string {
  if (!t || t.confidence <= 0.25) return "?"; // songs vote 0.97+, noise 0.11
  if (Math.abs(t.cents - (-31.766)) <= 4) return "432";
  if (Math.abs(t.cents) <= 4) return "440";
  return (t.cents > 0 ? "+" : "") + t.cents + "c";
}
