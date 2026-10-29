// Reviewed common UI phrases are ordinary spoken words in this project's
// transcripts. This is a warning/suggestion, never an unconditional replacer.
const phrases = [
  'live weights harvested', 'live weight harvested', 'birds harvested', 'live weight',
  'mark as to do', 'add a product', 'receive from', 'settlement bill', 'analytic accounts',
  'confirm order', 'adopt and sign', 'create bill anyway', 'pdf without payment', 'invoice pdf',
  'you need to supply a lot or serial number for products',
];
const singles = ['quantity', 'configuration', 'operations', 'receipts', 'inventory', 'accounting', 'purchase',
  'warehouse', 'internal', 'contact', 'generate', 'receive', 'validate', 'sign', 'done', 'new'];
const knownAcronyms = new Set(['pdf']);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`(?<![\\p{L}\\p{N}_/])(?:${[...phrases, ...singles].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\p{L}\\p{N}_/])`, 'giu');

export function findUiLabelCase(text: string, sentenceStarts: ReadonlySet<number>) {
  const corrections: { from: number; to: number; replacement: string; uncertain: boolean }[] = [];
  for (const match of text.matchAll(pattern)) {
    const from = match.index!, to = from + match[0].length;
    const multiple = match[0].includes(' ');
    if (!multiple) {
      // A capitalized common noun alone is not proof of a UI label, and New
      // York/Sign Smith must not be lowercased as if they were buttons.
      if (sentenceStarts.has(from)) continue;
      const before = text.slice(Math.max(0, from - 100), from), after = text.slice(to);
      if (/\bABT[ \t]+$/.test(before)) continue;
      const uiBefore = /\b(?:click|select|pislit|pindot|pisliton|pinduton|open|choose|adto|didto|balik|menu|button|column|field|status|then|dayon)\b[^.!?\n]{0,70}$/iu.test(before);
      const boundaryAfter = /^[ \t]*(?:[,.;:!?…]|\r?\n|$|(?:na|kay|nga|if|para|lang|ta)\b)/u.test(after);
      const uiAfter = /^[ \t]+(?:(?:nga|na)[ \t]+)?(?:field|column|button|status)\b/iu.test(after);
      if (!(uiBefore && boundaryAfter || uiAfter)) continue;
    }
    let replacement = match[0].replace(/[A-Za-z]+/g, word => knownAcronyms.has(word.toLocaleLowerCase()) ? word : word.toLocaleLowerCase());
    if (sentenceStarts.has(from)) replacement = replacement[0].toLocaleUpperCase() + replacement.slice(1);
    if (replacement !== match[0]) corrections.push({ from, to, replacement, uncertain: !multiple });
  }
  return corrections;
}
