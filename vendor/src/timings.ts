import { speakerLabelPattern } from './speakers';

export interface TimingCue { from: number; to: number; start: number; end: number }
export interface TimingData { version: 1; quality: 'approximate'; referenceText: string; cues: TimingCue[] }
interface Token { value: string; from: number; to: number }

function tokens(text: string): Token[] {
  const metadata = new RegExp(`^Language:[^\\r\\n]*|${speakerLabelPattern.source}|\\[(?:unclear|noise|laughs|crosstalk)\\]`, 'gm');
  const masked = text.replace(metadata, m => ' '.repeat(m.length));
  return [...masked.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map(m => ({
    value: m[0].normalize('NFC').toLowerCase().replaceAll('’', "'"), from: m.index!, to: m.index! + m[0].length,
  }));
}

export function parseTimings(value: unknown): TimingData | null {
  const data = value as TimingData | null;
  if (!data || data.version !== 1 || data.quality !== 'approximate' || typeof data.referenceText !== 'string' || data.referenceText.length > 2_000_000 || !Array.isArray(data.cues) || data.cues.length > 100_000) return null;
  let lastTo = 0, lastStart = 0;
  for (const cue of data.cues) {
    if (!cue || !Number.isInteger(cue.from) || !Number.isInteger(cue.to) || cue.from < lastTo || cue.to <= cue.from || cue.to > data.referenceText.length ||
        !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < lastStart || cue.end < cue.start) return null;
    lastTo = cue.to; lastStart = cue.start;
  }
  return data;
}

// Match unchanged token sequences, never substitute recognition wording. Work is
// bounded for heavily edited/repetitive text; unmatched text simply has no cue.
export function remapTimings(data: TimingData, body: string): TimingCue[] {
  if (data.referenceText === body) return data.cues;
  const a = tokens(data.referenceText), b = tokens(body), mapping = new Map<number, number>();
  const index = new Map<string, number[]>();
  b.forEach((token, i) => { const list = index.get(token.value) || []; list.push(i); index.set(token.value, list); });
  const tasks = [[0, a.length, 0, b.length]];
  let budget = 2_000_000;
  while (tasks.length && budget > 0) {
    let [a0, a1, b0, b1] = tasks.pop()!;
    while (a0 < a1 && b0 < b1 && a[a0].value === b[b0].value) { mapping.set(a[a0++].from, b0++); }
    while (a0 < a1 && b0 < b1 && a[a1 - 1].value === b[b1 - 1].value) { mapping.set(a[--a1].from, --b1); }
    let bestA = a0, bestB = b0, size = 0, previous = new Map<number, number>();
    for (let i = a0; i < a1 && budget > 0; i++) {
      const next = new Map<number, number>();
      for (const j of index.get(a[i].value) || []) {
        if (--budget <= 0) break;
        if (j < b0 || j >= b1) continue;
        const length = (previous.get(j - 1) || 0) + 1;
        next.set(j, length);
        if (length > size) { size = length; bestA = i - length + 1; bestB = j - length + 1; }
      }
      previous = next;
    }
    if (size < 3) continue;
    for (let i = 0; i < size; i++) mapping.set(a[bestA + i].from, bestB + i);
    if (bestA > a0 && bestB > b0) tasks.push([a0, bestA, b0, bestB]);
    if (bestA + size < a1 && bestB + size < b1) tasks.push([bestA + size, a1, bestB + size, b1]);
  }
  const originals = new Map(a.map(t => [t.from, t]));
  return data.cues.flatMap(cue => {
    const i = mapping.get(cue.from), original = originals.get(cue.from);
    return i === undefined || original?.to !== cue.to ? [] : [{ ...cue, from: b[i].from, to: b[i].to }];
  });
}

export function cueAt(cues: readonly TimingCue[], position: number): TimingCue | undefined {
  let lo = 0, hi = cues.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (cues[mid].from <= position) lo = mid + 1; else hi = mid; }
  const cue = cues[lo - 1];
  return cue && position <= cue.to ? cue : undefined;
}
