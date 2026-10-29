import type { SpellingRule } from './types';

// Reusable agreed spelling decisions.
const native: [string, string[]][] = [
  ['unya', ['nya']], ['tan-awon', ['tan-awn']], ['juy', ['gyuy']],
  ['resulta', ['risulta']], ['trabahoon', ['trabahuon']], ['buhaton', ['bahaton']],
  ['mangutana', ['magutana']], ['tika', ['tikaw']], ['kabuok', ['ka buok']],
  ['mo-ingon', ['moingon', 'mo ingon']], ['mag-himo', ['maghimo', 'mag himo']],
  ['ka-hibaw', ['kahibaw', 'kabaw']], ['maka-hibaw', ['makahibaw', 'makabaw']],
  ['bag-o', ['bago']], ['bag-ong', ['bagong']],
  ...['na pud', 'ra pud', 'na lang', 'pa ka', 'na kay', 'ra man'].map(s => [s, [s.replace(' ', '')]] as [string, string[]]),
  ...['trabaho', 'himo', 'himoan', 'kuha', 'palit', 'suwat', 'tawag', 'gamit'].map(s => [`gi-${s}`, [`gi${s}`, `gi ${s}`]] as [string, string[]]),
];
const english: [string, string[]][] = [
  ['flowchart', ['flow chart']], ['estimate-tan', ['estimatetan', 'estimate tan']],
  ['schedule-lon', ['schedulelon', 'schedule lon']], ['study-hi', ['studyhi', 'study hi']],
  ['ma-agree-han', ['maagreehan', 'ma-agreehan']], ['fill-in-an', ['fillinan', 'fill-inan']],
];
export const englishStems = ['check', 'post', 'deploy', 'send', 'approve', 'handle', 'achieve', 'estimate', 'schedule', 'study', 'agree', 'fill', 'follow', 'step', 'tie', 'present', 'discuss', 'design', 'develop', 'implement', 'manage', 'update', 'review', 'work', 'plan', 'create', 'use', 'open', 'close', 'start', 'finish', 'test', 'confirm', 'explain', 'compute', 'encode'];
const prefixForms: [string, string[]][] = englishStems.map(s => [`i-${s}`, [`e-${s}`, `e ${s}`]]);
for (const prefix of ['gi', 'i', 'gina', 'na', 'mag', 'mo', 'ma', 'nag', 'naka']) {
  for (const stem of englishStems) {
    // A real English word can resemble a local prefix + English stem.
    if (`${prefix}${stem}` === 'mouse') continue;
    prefixForms.push([`${prefix}-${stem}`, [`${prefix}${stem}`]]);
  }
}
export const projectRules: SpellingRule[] = [
  ...native.map(([preferred, variants]) => ({ preferred, variants, language: 'Bisaya' as const })),
  { preferred: 'na man', variants: ['naman'], language: 'Bisaya' as const },
  { preferred: 'diyan', variants: ['dyan', 'jan'], language: 'Tagalog' as const },
  ...[...english, ...prefixForms].map(([preferred, variants]) => ({ preferred, variants, language: 'All' as const })),
].map(r => ({ ...r, id: `project:${r.language}:${r.preferred}`, explanation: 'Use the agreed project spelling.' }));
