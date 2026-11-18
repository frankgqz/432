import "./style.css";
import { Engine } from "./audio";
import { allTracks, addTrack, type Track } from "./library";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const engine = new Engine();

let tracks: Track[] = [];
let index = -1;

// ---------- the list ----------
async function refreshList(): Promise<void> {
  tracks = await allTracks();
  const list = $("list");
  list.innerHTML = "";
  tracks.forEach((t, i) => {
    const li = document.createElement("li");
    li.textContent = t.name.replace(/\.[a-z0-9]+$/i, "");
    if (i === index) li.classList.add("active");
    li.onclick = () => void playIndex(i);
    list.appendChild(li);
  });
}

// ---------- playback ----------
async function playIndex(i: number, viaSwap = true): Promise<void> {
  if (i < 0 || i >= tracks.length) return;
  const start = async () => {
    index = i;
    await engine.load(tracks[i].blob);
    $("title").textContent = tracks[i].name.replace(/\.[a-z0-9]+$/i, "");
    setMedia();
  };
  if (viaSwap && engine.playing) await engine.swap(start);
  else { await start(); engine.play(); }
  updatePlayBtn();
  refreshActive();
}

function updatePlayBtn(): void {
  $("play").innerHTML = engine.playing ? "&#10073;&#10073;" : "&#9654;";
}

function refreshActive(): void {
  [...$("list").children].forEach((li, i) => li.classList.toggle("active", i === index));
}

function next(): void { void playIndex((index + 1) % tracks.length); }
function prev(): void {
  if (engine.position > 3) { engine.seek(0); return; }
  void playIndex((index - 1 + tracks.length) % tracks.length);
}

engine.onEnded = next;

// ---------- controls ----------
$("t432").onclick = () => {
  const on = $("t432").getAttribute("aria-pressed") !== "true";
  $("t432").setAttribute("aria-pressed", String(on));
  engine.set432(on);
};
$("keyUp").onclick = () => { engine.setKey(engine.keySemis + 1); $("keyVal").textContent = fmtKey(); };
$("keyDown").onclick = () => { engine.setKey(engine.keySemis - 1); $("keyVal").textContent = fmtKey(); };
$("bpmUp").onclick = () => { engine.setTempo(engine.tempo + 0.05); $("bpmVal").textContent = fmtBpm(); };
$("bpmDown").onclick = () => { engine.setTempo(engine.tempo - 0.05); $("bpmVal").textContent = fmtBpm(); };
$("play").onclick = () => {
  if (index < 0) { void playIndex(0); return; }
  if (engine.playing) { engine.pause(); } else { engine.play(); }
  updatePlayBtn();
};
$("next").onclick = next;
$("prev").onclick = prev;

function fmtKey(): string { return engine.keySemis > 0 ? "+" + engine.keySemis : String(engine.keySemis); }
function fmtBpm(): string { return Math.round(engine.tempo * 100) + "%"; }

// ---------- progress (tap the bar to seek) ----------
const fill = $("fill") as HTMLDivElement;
function tick(): void {
  const d = engine.duration;
  fill.style.width = d ? (engine.position / d) * 100 + "%" : "0%";
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
$("bar").onclick = (e) => {
  const d = engine.duration;
  if (!d) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  engine.seek(((e.clientX - rect.left) / rect.width) * d);
};

// ---------- import ----------
$("import").onclick = () => $("fileInput").click();
($("fileInput") as HTMLInputElement).onchange = async (e) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  for (const f of files) await addTrack(f.name, f);
  await refreshList();
  ($("fileInput") as HTMLInputElement).value = "";
};

// ---------- car buttons (MediaSession) ----------
function setMedia(): void {
  if (!("mediaSession" in navigator) || index < 0) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: tracks[index].name.replace(/\.[a-z0-9]+$/i, ""), artist: "432" });
  navigator.mediaSession.setActionHandler("play", () => { engine.play(); updatePlayBtn(); });
  navigator.mediaSession.setActionHandler("pause", () => { engine.pause(); updatePlayBtn(); });
  navigator.mediaSession.setActionHandler("previoustrack", prev);
  navigator.mediaSession.setActionHandler("nexttrack", next);
}

void refreshList();
