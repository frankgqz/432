// The tuning detector's proof bench (2026-11-18): synthetic songs at known
// tunings through analyzeTuning. Exits non-zero on ANY failure.
import { analyzeTuning, tuningLabel } from "../src/tuning.ts";

let fails = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log((ok ? "PASS " : "FAIL ") + name + " | " + detail);
  if (!ok) fails++;
}

// a synthetic "song": chords of sines (+ a harmonic each) at a chosen A4
function song(ref: number, seconds = 6, rate = 44100): Float32Array {
  const out = new Float32Array(rate * seconds);
  const notes = [57, 60, 64, 67, 69, 72, 76, 79, 81, 84]; // A-minor-ish spread
  const chordLen = seconds / 5;
  for (let c = 0; c < 5; c++) {
    for (let n = 0; n < 4; n++) {
      const midi = notes[(c * 2 + n) % notes.length];
      const f = ref * Math.pow(2, (midi - 69) / 12);
      const start = Math.floor(c * chordLen * rate);
      const len = Math.floor(chordLen * rate);
      for (let s = 0; s < len; s++) {
        const env = Math.min(1, s / 800) * Math.min(1, (len - s) / 1200);
        const t = s / rate;
        out[start + s] += env * (0.22 * Math.sin(2 * Math.PI * f * t) + 0.07 * Math.sin(2 * Math.PI * 2 * f * t));
      }
    }
  }
  return out;
}

function noise(seconds = 4, rate = 44100): Float32Array {
  const out = new Float32Array(rate * seconds);
  for (let i = 0; i < out.length; i++) out[i] = (Math.random() - 0.5) * 0.4;
  return out;
}

const CASES: Array<[string, Float32Array, number, number]> = [
  // name, samples, expected cents, min confidence
  ["432-tuned song", song(432), -31.766, 0.3],
  ["440-tuned song", song(440), 0, 0.3],
  ["442-tuned song", song(442), 7.9, 0.3],
  ["436-tuned song", song(436), -15.9, 0.3],
];

for (const [name, samples, expected, minConf] of CASES) {
  const t = analyzeTuning(samples, 44100);
  const near = Math.abs(t.cents - expected) <= 2 || Math.abs(Math.abs(t.cents - expected) - 100) <= 2;
  check(name, near && t.confidence >= minConf,
    `cents ${t.cents} (want ~${expected.toFixed(1)}) · conf ${t.confidence.toFixed(2)} (want >=${minConf}) · label "${tuningLabel(t)}"`);
}

const n = analyzeTuning(noise(), 44100);
check("noise reads as noise", n.confidence < 0.2, `conf ${n.confidence.toFixed(2)} (want < 0.2) · label "${tuningLabel(n)}"`);
check("label: unknown", tuningLabel(undefined) === "?", tuningLabel(undefined));
check("label: 432 band", tuningLabel({ cents: -32, confidence: 0.5 }) === "432", tuningLabel({ cents: -32, confidence: 0.5 }));
check("label: +8c", tuningLabel({ cents: 8, confidence: 0.5 }) === "+8c", tuningLabel({ cents: 8, confidence: 0.5 }));

console.log(fails === 0 ? "ALL PASS" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
