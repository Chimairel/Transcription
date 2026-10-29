import type { Language } from './types';

const words = {
  English: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  Mixed: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  Bisaya: ['usa', 'duha', 'tulo', 'upat', 'lima', 'unom', 'pito', 'walo', 'siyam', 'napulo'],
  Tagalog: ['isa', 'dalawa', 'tatlo', 'apat', 'lima', 'anim', 'pito', 'walo', 'siyam', 'sampu'],
};
const months = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Enero|Pebrero|Marso|Abril|Mayo|Hunyo|Hulyo|Agosto|Setyembre|Oktubre|Nobyembre|Disyembre)';
// Amounts, percentages, dates, clock times, fractions and decimal values retain digits.
const exceptions = [
  /\b\d+(?:[.,]\d+)+(?:[.:]\d+)*\b/g,
  /(?<!\w)(?:\d+\s*\/\s*\d+(?:\s*\/\s*\d+)?|\d{4}-\d{1,2}-\d{1,2})(?!\w)/g,
  /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?m\.?)?/gi,
  /(?:[$₱€£]\s*\d+(?:[.,]\d+)*|\b(?:PHP|USD|EUR|GBP|pesos?|dollars?|alas)\s+\d+(?:[.,]\d+)*|\b\d+(?:[.,]\d+)*\s*(?:%|percent\b|pesos?\b|dollars?\b|PHP\b|USD\b|[ap]\.?m\.?\b|o['’]clock\b))/gi,
  /\b\d+\s+(?:hundred|thousand|million|billion|mil|libo|milyon)(?:\s+(?:pesos?|dollars?))?\b/gi,
  new RegExp(`\\b(?:${months}\\.?\\s+\\d{1,2}|\\d{1,2}\\s+${months}\\.?)(?:,?\\s+\\d{4})?\\b`, 'gi'),
];
export function smallNumbers(text: string, language: Language) {
  const ranges = exceptions.flatMap(re => [...text.matchAll(re)]
    .filter(m => {
      // Tagalog “may” means “there is/are”; “May 3 sako” is a count, not a date.
      if (!/^may\s+\d/i.test(m[0])) return true;
      if (/^\s+(?:ka|sako|tao|araw|client|tasks?|people|items?)\b/i.test(text.slice(m.index! + m[0].length))) return false;
      return language !== 'Tagalog' || /\b(?:sa|noong|ngayong|on)\s*$/i.test(text.slice(0, m.index!)) || /\d{4}/.test(m[0]);
    })
    .map(m => [m.index!, m.index! + m[0].length]));
  return [...text.matchAll(/(?<![\p{L}\p{N}_.,])(?:10|[1-9])(?![\p{L}\p{N}_]|[.,]\d)/gu)]
    .filter(m => !ranges.some(([a, b]) => m.index! >= a && m.index! < b))
    .map(m => ({ from: m.index!, to: m.index! + m[0].length, replacement: words[language][Number(m[0]) - 1] }));
}
