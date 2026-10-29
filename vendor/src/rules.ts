import type { Decision, Finding, Language, SpellingRule } from './types';
import { approvedTags } from './tags';
import { projectRules } from './projectRules';
import { smallNumbers } from './numberRules';
import { englishWarnings } from './englishSpelling';
import { speakerLabelPattern, speakerWords } from './speakers';
import { libraryRules } from './spellingLibrary';
import { getProjectKnowledge } from './projectKnowledge';
import { findAffixCorrections } from './affixCorrections';
import { findUiLabelCase } from './uiLabelCase';
export { approvedTags } from './tags';

const rows = (language: SpellingRule['language'], values: [string, string[]][], explanation: string): SpellingRule[] =>
  values.map(([preferred, variants]) => ({ id: `spelling:${language}:${preferred}`, preferred, variants, language, explanation }));

const baseRules: SpellingRule[] = [
  ...projectRules,
  ...rows('Bisaya', [
    ['ug', ['og']], ['kaayo', ['kayo', 'kaau']], ['jud', ['gyud', 'gud']], ['pud', ['pod']],
    ['diri', ['dire']], ['karon', ['karun']], ['kuan', ['kwan']], ['naa', ['na-a', "na'a"]],
    ['unsay', ["unsa'y"]], ['unya', ['unja']],
  ], 'Use the agreed Bisaya spelling from the spelling table.'),
  ...rows('Tagalog', [
    ['yung', ["'yung"]], ['di', ["'di"]], ['wag', ["'wag"]], ['kasi', ['kase']],
    ['sige', ['sigi']], ['ganun', ['ganon']],
  ], 'Use the agreed Tagalog spelling. Keep full words when spoken in full.'),
  ...rows('All', [
    ['lang', ['lng']], ['naman', ['nmn']], ['din', ['dn']],
    ['gi-check', ['gitsek', 'gicheck']], ['i-check', ['ichek', 'icheck']], ['gina-check', ['ginacheck']], ['na-check', ['nacheck']], ['i-post', ['ipost']],
    ['mag-meeting', ['magmeeting']], ['na-approve', ['naaprub', 'naapprove']],
    ['i-deploy', ['ideploy']], ['gi-approve', ['giapprove']], ['i-send', ['isend']],
    ['nagche-check', ['nagchechek', 'nag-check-check']],
    ['computer', ['kompyuter']], ['schedule', ['iskedyul']], ['deadline', ['dedlayn']],
    ['Odoo', ['Odu']],
  ], 'Use the spelling prescribed by the transcription rules.'),
  ...['Odoo', 'Facebook', 'Messenger', 'GCash', 'Excel', 'Inopacan', 'Agile Tech', 'GenSan'].map(preferred => ({
    id: `name:${preferred}`, preferred, variants: [preferred], language: 'All' as const,
    explanation: 'Use the official spelling and capitalization for this name.', exactCase: true,
  })),
];
let cachedEntries: ReturnType<typeof getProjectKnowledge>['entries'] | undefined;
let cachedRules: SpellingRule[] = [];
export function getBuiltinRules(): SpellingRule[] {
  const entries = getProjectKnowledge().entries;
  if (entries !== cachedEntries) {
    // Structured current entries supersede duplicate historical spellings in
    // code. Generic structural/affix checks and official-case checks remain.
    const current = libraryRules(entries);
    const overlaps = (a: SpellingRule, b: SpellingRule) => a.language === 'All' || b.language === 'All' || a.language === b.language;
    cachedRules = [...baseRules.map(rule => rule.exactCase ? rule : { ...rule, variants: rule.variants.filter(variant =>
      !current.some(next => overlaps(rule, next) && next.preferred.toLowerCase() !== rule.preferred.toLowerCase() &&
        next.variants.some(v => [variant.toLowerCase(), rule.preferred.toLowerCase()].includes(v.toLowerCase())))) }), ...current];
    cachedEntries = entries;
  }
  return cachedRules;
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");
const normalize = (s: string) => s.toLocaleLowerCase().replaceAll('’', "'").trim();
export const asRules = (decisions: Decision[]): SpellingRule[] => decisions.filter(d => d.variants.length && d.preferred).map(d => ({
  id: `decision:${d.id}`, preferred: d.preferred, variants: d.variants, language: d.language,
  explanation: d.explanation || d.situation, exactCase: /\p{Lu}/u.test(d.preferred),
}));

export function validateDecision(candidate: Decision, existing: Decision[]): string | undefined {
  const builtins = getBuiltinRules();
  if (!candidate.situation.trim()) return 'Describe the word or situation.';
  if (candidate.variants.length && !candidate.preferred.trim()) return 'Enter the preferred spelling for this check.';
  const variants = candidate.variants.map(normalize);
  if (new Set(variants).size !== variants.length) return 'Remove duplicate variants.';
  if (candidate.variants.some(v => !v.trim() || v === candidate.preferred || (normalize(v) === normalize(candidate.preferred) && !/\p{Lu}/u.test(candidate.preferred)))) return 'A variant must differ from the preferred spelling.';
  if (candidate.variants.some(v => v.includes('\n')) || candidate.preferred.includes('\n')) return 'Spellings must stay on one line.';
  const overlap = (a: string, b: string) => a === 'All' || b === 'All' || a === b;
  for (const rule of [...builtins, ...asRules(existing.filter(d => d.id !== candidate.id))]) {
    if (!overlap(rule.language, candidate.language)) continue;
    const rv = rule.variants.map(normalize), preferred = normalize(candidate.preferred), rp = normalize(rule.preferred);
    if (variants.includes(rp) || (rv.includes(preferred) && preferred !== rp) || (rv.some(v => variants.includes(v)) && preferred !== rp)) {
      return `This conflicts with the existing rule for “${rule.preferred}”. Choose a different variant or language scope.`;
    }
  }
  return undefined;
}

const abbreviations = /(?:\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e)|\b[A-Z]|\b[A-Z](?:\.[A-Z])+)[.]$/i;
const urlPattern = /(?:https?:\/\/|www\.)[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b[\w-]+\.(?:com|org|net|ph|io)(?:\/[^\s]*)?/gi;
function languageHeader(text: string) {
  return text.match(/^\uFEFF?(?:[ \t]*\r?\n)*[ \t]*Language:[ \t]*(Bisaya|Tagalog|English|Mixed)[ \t]*(?:\r?\n|$)/);
}

export function checkText(text: string, language: Language, decisions: Decision[] = [], review = false, recordingName?: string): Finding[] {
  const builtins = getBuiltinRules();
  const findings: Finding[] = [];
  const header = languageHeader(text), headerEnd = header?.[0].length || 0;
  if (header && header[1] !== language) {
    const from = header[0].indexOf('Language:'), to = header[0].trimEnd().length;
    findings.push({ id: 'language-header', from, to, severity: 'hint', rule: 'language-header',
      message: `This header says ${header[1]}, but the recording language is ${language}. Checks and the exported header use the selected recording language.`, replacement: `Language: ${language}` });
  }
  const urls = [...text.matchAll(urlPattern)].map(m => [m.index!, m.index! + m[0].replace(/[.!?,]+$/, '').length]);
  const protectedAt = (p: number) => urls.some(([a, b]) => p >= a && p < b);
  const push = (from: number, to: number, severity: Finding['severity'], rule: string, message: string, replacement?: string) => {
    if (from < headerEnd || protectedAt(from)) return;
    if (findings.some(f => f.from === from && f.to === to && (f.rule === rule || replacement !== undefined && f.replacement === replacement))) return;
    findings.push({ id: `${rule}:${from}:${to}`, from, to, severity, rule, message, replacement });
  };
  const preferredCase = (input: string, output: string) => {
    if (input[0] === input[0]?.toUpperCase() && /\p{L}/u.test(input[0])) return output[0].toUpperCase() + output.slice(1);
    return output;
  };
  for (const rule of [...builtins, ...asRules(decisions)]) {
    const applies = rule.language === 'All' || rule.language === language;
    if (!applies && language !== 'Mixed') continue;
    for (const variant of rule.variants) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}_'’\\-])${escape(variant)}(?![\\p{L}\\p{N}_'’\\-])`, 'giu');
      for (const match of text.matchAll(re)) {
        if (rule.exactCase && match[0] === rule.preferred) continue;
        if (rule.language === 'Bisaya' && rule.preferred === 'ron' && variant.toLowerCase() === 'run') {
          // Local shortened karon, not the English verb/noun or an identifier.
          const before = text.slice(Math.max(0, match.index! - 60), match.index!);
          const after = text.slice(match.index! + match[0].length);
          if (match[0] === 'RUN' || /^[ \t]+(?:the|a|an|this|that|report|tests?|program|system|code|batch|task|job|command|script|it|them|away|out|into|for|with)\b/i.test(after)) continue;
          if (!/\b(?:ta|kita|ko|ka|mo|na|pa|ra|lang|pud|sad|diri|didto|unsa|asa|tapad)[ \t]+$/i.test(before) &&
              !/^[ \t]+(?:na|pa|lang|ra|pud|sad)\b/i.test(after)) continue;
        }
        const contextualHabit = rule.language === 'Bisaya' &&
          ['o', 'po', 'na to', 'na ito', 'na itong', 'dito', 'na ito ang', 'nana', 'sud', 'sod', 'run'].includes(variant.toLowerCase());
        // PO is an acronym, and O can be a letter/interjection. Even a Bisaya
        // recording can contain real Tagalog/polite words, so these are hints.
        if (contextualHabit && /^(?:PO|O)$/.test(match[0])) continue;
        const replacement = rule.exactCase ? rule.preferred : preferredCase(match[0], rule.preferred);
        push(match.index!, match.index! + match[0].length, applies && !contextualHabit ? 'error' : 'hint', rule.id,
          `${applies ? '' : `If this is ${rule.language}: `}write “${replacement}”. ${rule.explanation}`, replacement);
      }
    }
  }
  for (const match of text.matchAll(/\[([^\]\n]*)\]/g)) {
    if (!approvedTags.includes(match[1])) {
      const exact = approvedTags.find(t => t === match[1].toLowerCase().trim());
      push(match.index!, match.index! + match[0].length, 'error', 'tags', 'Use only [unclear], [crosstalk], [noise], or [laughs], exactly as written.', exact ? `[${exact}]` : undefined);
    }
  }
  // Recording-specific recognition habits are hints only, outside the global
  // spelling rules/typing allowlist. A matching filename is not audio proof.
  const recordingBase = recordingName?.replace(/\.[^.]+$/, '');
  if (recordingBase && (language === 'Mixed' || language === 'Bisaya')) {
    for (const entry of getProjectKnowledge().entries.filter(e => e.status === 'contextual' && e.scope === recordingBase)) {
      for (const variant of entry.variants) {
        const pattern = new RegExp(`(?<![\\p{L}\\p{N}_'’\\-])${escape(variant)}(?![\\p{L}\\p{N}_'’\\-])`, 'giu');
        for (const match of text.matchAll(pattern)) push(match.index!, match.index! + match[0].length, 'hint', `recording-context:${entry.id}`,
          `In this recording's Bisaya passages, check for “${entry.preferred}”. Keep genuine English. ${entry.context}`, preferredCase(match[0], entry.preferred));
      }
    }
  }
  let offset = 0;
  const labels: [number, number][] = [];
  const sentenceStarts = new Set<number>();
  const names = [...builtins.filter(r => r.exactCase).map(r => r.preferred), ...decisions.map(d => d.preferred).filter(n => /^[\p{Ll}].*\p{Lu}/u.test(n))];
  function capital(at: number) {
    sentenceStarts.add(at);
    const tail = text.slice(at), m = tail.match(/^[\p{Ll}][\p{L}'’\-]*/u);
    if (!m || names.some(n => tail.startsWith(n))) return;
    const word = m[0];
    push(at, at + word.length, 'error', 'capitalization', 'Start the sentence with a capital letter.', word[0].toUpperCase() + word.slice(1));
  }
  for (const line of text.split('\n')) {
    if (line.trim() && offset >= headerEnd) {
      const label = line.match(speakerLabelPattern);
      const standaloneAnnotation = /^[ \t]*\[(?:crosstalk|noise|laughs)\][.!?]?[ \t\r]*$/.test(line);
      if (!label && !standaloneAnnotation) push(offset, offset + Math.min(line.length, 20), 'error', 'speaker', 'Start each speech turn with Speaker one:, Speaker two:, and so on. For a clear outside-call voice, use Outside speaker: or Outside speaker one:, etc. Standalone [crosstalk], [noise] and [laughs] need no speaker label.');
      else if (label) {
        labels.push([offset, offset + label[0].length]);
        if (/^\[crosstalk\][.!?]?[ \t\r]*$/.test(line.slice(label[0].length))) {
          push(offset, offset + line.trimEnd().length, 'error', 'crosstalk-speaker',
            'Use standalone [crosstalk] without assigning the overlapping voices to one speaker.', '[crosstalk]');
        }
        const number = label[1] || label[2];
        if (/^\d+$/.test(number || '') && Number(number) <= 10) {
          push(offset, offset + label[0].trimEnd().length, 'error', 'speaker-spelling',
            'Use the agreed speaker labels written as words.', `${label[2] ? 'Outside speaker' : 'Speaker'} ${speakerWords[Number(number) - 1]}:`);
        }
        const lead = line.slice(label[0].length).match(/^(?:[\s"“'‘(]|\[(?:unclear|crosstalk|noise|laughs)\])*/)?.[0] || '';
        // Unclear speech can occupy the sentence's first word. The next visible
        // word is then a continuation, not another sentence start.
        if (!lead.includes('[unclear]')) capital(offset + label[0].length + lead.length);
        if (review && line.slice(label[0].length).trim() && !/[.!?…]["”'’)\]]*$/.test(line.trim()) && !/\[(?:unclear|crosstalk|noise|laughs)\]$/.test(line.trim())) {
          push(offset + line.trimEnd().length - 1, offset + line.trimEnd().length, 'hint', 'sentence-ending', 'Listen again: does this turn need a period or question mark?');
        }
      }
    }
    offset += line.length + 1;
  }
  for (const m of text.matchAll(/[.!?]["”'’)]*\s+(?:["“'‘(]|\[(?:unclear|crosstalk|noise|laughs)\]\s*)*([\p{L}][\p{L}'’\-]*)/gu)) {
    const at = m.index!;
    if (text[at - 1] === '.' || text[at + 1] === '.' || abbreviations.test(text.slice(Math.max(0, at - 15), at + 1))) continue;
    const index = at + m[0].lastIndexOf(m[1]);
    if (text.slice(at, index).includes('[unclear]')) continue;
    capital(index);
  }
  // Project address style is contextual: standalone miss is lowercase away
  // from sentence starts; Miss before a name stays uppercase. Do not turn
  // this into a word replacement or treat an unclear possible name as known.
  const referenceNames = new Set(getProjectKnowledge().entries.filter(e => e.status === 'name_reference').map(e => e.preferred.toLocaleLowerCase()));
  for (const m of text.matchAll(/(?<![\p{L}\p{N}_'’\-])Miss(?![\p{L}\p{N}_'’\-])/gu)) {
    const at = m.index!;
    if (sentenceStarts.has(at)) continue;
    const tail = text.slice(at + m[0].length);
    const standalone = /^[ \t]*(?:[,.;:!?…]|\r?\n|$)/u.test(tail);
    if (standalone) push(at, at + m[0].length, 'error', 'miss-address-case',
      'Use lowercase “miss” as a standalone address within a sentence. Keep “Miss” before a name or at the start of a sentence.', 'miss');
    else if (/^[ \t]+\[unclear\]/.test(tail)) push(at, at + m[0].length, 'hint', 'miss-address-context',
      'If [unclear] is a name after this title, keep “Miss”. If this is a standalone address, use “miss”. Do not guess the name.');
  }
  for (const m of text.matchAll(/(?<![\p{L}\p{N}_'’\-])miss(?=[ \t]+[\p{L}])/gu)) {
    const at = m.index!, nextWord = text.slice(at + 4).match(/^[ \t]+([\p{L}][\p{L}'’\-]*)/u)?.[1];
    const prefix = text.slice(Math.max(headerEnd, at - 45), at);
    // Only an explicit vocative/local name marker establishes a title here.
    // English "I miss Kim" and the verb in i-miss must remain untouched.
    if (nextWord && referenceNames.has(nextWord.toLocaleLowerCase()) && /(?:,[ \t]*|\b(?:si|ni|kay|kang|kina)[ \t]+)$/.test(prefix)) {
      push(at, at + 4, 'error', 'miss-title-case', 'Use “Miss” as a title before this name.', 'Miss');
    }
  }
  for (const correction of findUiLabelCase(text, sentenceStarts)) {
    push(correction.from, correction.to, correction.uncertain ? 'hint' : 'error', 'ui-label-case',
      correction.uncertain
        ? 'If this is the common button, menu or field label, use ordinary sentence capitalization. Keep actual names, acronyms and codes unchanged.'
        : 'Use ordinary sentence capitalization for common UI labels; screen styling does not make these words proper names. Keep sentence starts and acronyms.',
      correction.replacement);
  }
  for (const m of text.matchAll(/[ \t]+([,.!?;:])/g)) {
    push(m.index!, m.index! + m[0].length, 'error', 'punctuation-spacing', 'Remove the space before this punctuation mark.', m[1]);
  }
  for (const m of text.matchAll(/([,.!?])(?=[\p{L}\p{N}])/gu)) {
    const at = m.index!, mark = m[1];
    if (/[\d]/.test(text[at - 1] || '') && /\d/.test(text[at + 1] || '') && (mark === '.' || mark === ',')) continue;
    if (mark === '.' && (text[at - 1] === '.' || text[at + 1] === '.' || abbreviations.test(text.slice(Math.max(0, at - 15), at + 1)))) continue;
    push(at, at + 1, 'error', 'punctuation-spacing', 'Add a space after this punctuation mark.', `${mark} `);
  }
  for (const m of text.matchAll(/[,!?]{2,}|\.{2,}/g)) {
    if (m[0] === '...') continue;
    const same = new Set(m[0]).size === 1;
    push(m.index!, m.index! + m[0].length, same ? 'error' : 'hint', 'repeated-punctuation', 'Check this repeated punctuation.', same ? m[0][0] : undefined);
  }
  for (const m of text.matchAll(/\p{Extended_Pictographic}/gu)) push(m.index!, m.index! + m[0].length, 'error', 'emoji', 'The transcription rules do not allow emoji.');
  const inLabel = (at: number) => labels.some(([a, b]) => at >= a && at < b);
  for (const n of smallNumbers(text, language)) {
    if (!inLabel(n.from)) push(n.from, n.to, 'error', 'small-number',
      `Write counts from one to ten as words, including numbered days, phases and departments.${language === 'Mixed' ? ' This suggestion is English; keep the language actually spoken.' : ''}`, n.replacement);
  }
  const spellingProtected = (at: number) => at < headerEnd || protectedAt(at) || inLabel(at) || findings.some(f => at >= f.from && at < f.to && f.rule !== 'capitalization');
  for (const correction of findAffixCorrections(text)) {
    if (!spellingProtected(correction.from)) push(correction.from, correction.to, 'hint', 'local-english-affix',
      'Separate the local prefix, English stem and attached local suffix with hyphens. Confirm this is the intended affix and English word.', correction.replacement);
  }
  // Reference/protected entries have no replacement variants, so they are not
  // spelling rules. Still protect their reviewed words and names from English
  // dictionary guesses. Observed corpus words and working guesses stay excluded.
  const references = getProjectKnowledge().entries.filter(entry => ['protected', 'reference', 'name_reference'].includes(entry.status)).map(entry => entry.preferred);
  for (const w of englishWarnings(text, language, [...builtins.map(r => r.preferred), ...references, ...decisions.filter(d => d.language === 'All' || d.language === language || language === 'Mixed').map(d => d.preferred)], spellingProtected)) {
    push(w.from, w.to, 'hint', 'english-spelling',
      `Possible English spelling: “${text.slice(w.from, w.to)}”.${w.replacement ? ` Did you mean “${w.replacement}”?` : ' Not found in the English dictionary.'} Check local words and names before changing it.`, w.replacement);
  }
  if (language === 'Bisaya' || language === 'Mixed') {
    for (const m of text.matchAll(/\bnana\b/gi)) push(m.index!, m.index! + m[0].length, 'hint', 'particle-meaning', 'If this is Bisaya, listen for “naa na” or “na na”; choose by meaning.');
  }
  for (const [pattern, replacement, message] of [
    [/\bas is(?=\s+(?:process|state|diagram|model|workflow)\b)/gi, 'as-is', 'If this names a process state, use the agreed label “as-is”.'],
    [/\bto be(?=\s+(?:process|state|diagram|model|workflow)\b)/gi, 'to-be', 'If this names a process state, use the agreed label “to-be”.'],
    [/\bclient facing\b/gi, 'client-facing', 'Use “client-facing” when it modifies a noun. Check the sentence before changing it.'],
    [/\bkick off(?=\s+(?:meeting|meetings|session|sessions)\b)/gi, 'kickoff', 'Use “kickoff” for the noun or noun modifier; keep “kick off” for the verb.'],
  ] as const) {
    for (const m of text.matchAll(pattern)) push(m.index!, m.index! + m[0].length, 'hint', 'project:context', message, preferredCase(m[0], replacement));
  }
  if (review) {
    for (const m of text.matchAll(/\b(uh|um|ah|eh|hmm)\b|\b([\p{L}]+)\s+\2\b/giu)) {
      push(m.index!, m.index! + m[0].length, 'hint', 'clean-speech', 'Listen again: omit meaningless filler sounds and stuttered repeats, but keep words that carry meaning.');
    }
    const stack: { ch: string; at: number }[] = [];
    for (let at = 0; at < text.length; at++) {
      const ch = text[at];
      if ('[('.includes(ch)) stack.push({ ch, at });
      else if ('])'.includes(ch)) {
        const expected = ch === ']' ? '[' : '(';
        if (stack.at(-1)?.ch === expected) stack.pop();
        else push(at, at + 1, 'hint', 'brackets', 'Check this unmatched bracket.');
      }
    }
    for (const item of stack) push(item.at, item.at + 1, 'hint', 'brackets', 'Check this unmatched bracket.');
    for (const quote of ['"', '“', '”']) {
      const matches = [...text.matchAll(new RegExp(quote, 'g'))];
      const unmatched = quote === '"' ? matches.length % 2 !== 0 : [...text].filter(c => c === '“').length !== [...text].filter(c => c === '”').length;
      if (unmatched && matches.length) push(matches[0].index!, matches[0].index! + 1, 'hint', 'quotes', 'Check the opening and closing quotation marks.');
    }
  }
  return findings.sort((a, b) => a.from - b.from || a.rule.localeCompare(b.rule));
}

export function transcriptFilename(filename: string): string { return filename.replace(/\.[^.]+$/, '') + '.txt'; }
export function exportTranscript(body: string, language: Language): string {
  const header = languageHeader(body);
  return `Language: ${language}\n${header ? body.slice(header[0].length) : body}`;
}
