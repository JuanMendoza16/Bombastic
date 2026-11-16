// Simula partidas entre bots y muestra estadísticas por clase (herramienta de balance).
// Uso: npx tsx scripts/balance.ts <ctf|eliminacion|zona|clasica> <cantidad>
import { createMatch, step } from '../src/shared/sim';
import { BotAI } from '../src/shared/ai';
import { MODES } from '../src/shared/balance';
import { CLASS_IDS, type ClassId, type ModeId, type MapId } from '../src/shared/types';
const mode = (process.argv[2] ?? 'ctf') as ModeId;
const N = Number(process.argv[3] ?? 30);
const maps: MapId[] = ['ruinas', 'laberinto', 'fabrica', 'volcan'];
const stat: Record<string, { n: number; w: number; k: number; d: number; pts: number; caps: number }> = {};
for (const c of CLASS_IDS) stat[c] = { n: 0, w: 0, k: 0, d: 0, pts: 0, caps: 0 };
let draws = 0; let totalTime = 0; let caps = 0;
for (let m = 0; m < N; m++) {
  const shuffled = [...CLASS_IDS].sort(() => Math.random() - 0.5);
  const other = [...CLASS_IDS].sort(() => Math.random() - 0.5);
  const size = mode === 'clasica' ? 4 : 3;
  const slots = mode === 'clasica'
    ? Array.from({ length: 4 }, (_, i) => ({ id: i + 1, name: 'b' + i, team: i, cls: shuffled[i], skin: 'base', bot: true, difficulty: 2 as const }))
    : Array.from({ length: size * 2 }, (_, i) => ({ id: i + 1, name: 'b' + i, team: i % 2, cls: (i % 2 ? other : shuffled)[i >> 1], skin: 'base', bot: true, difficulty: 2 as const }));
  const s = createMatch({ mode, map: maps[m % 4], timeLimit: MODES[mode].defaultTime, scoreLimit: MODES[mode].defaultScore, powerups: MODES[mode].powerups, seed: m * 7919 + 1, slots });
  const ai = new BotAI(m + 1);
  let t = 0;
  while (s.phase !== 'ended' && t < 60 * 900) { step(s, ai.inputs(s)); t++; }
  totalTime += s.time;
  if (s.winner === -2) draws++;
  for (const p of s.players) {
    const st = stat[p.cls]; st.n++; if (s.winner === p.team) st.w++; st.k += p.kills; st.d += p.deaths; st.pts += p.points; st.caps += p.caps; caps += p.caps;
  }
}
console.log(mode, 'matches', N, 'draws', draws, 'avg time', (totalTime / N).toFixed(0) + 's', 'avg caps/match', (caps / N).toFixed(2));
for (const c of CLASS_IDS) { const s = stat[c]; console.log(c.padEnd(12), 'win%', (100 * s.w / s.n).toFixed(0).padStart(3), ' K/D', (s.k / Math.max(1, s.d)).toFixed(2), ' kills/m', (s.k / s.n).toFixed(1), ' pts/m', (s.pts / s.n).toFixed(0), ' caps/m', (s.caps / s.n).toFixed(2)); }
