import { isEnglishWord, isLocalWord } from './englishSpelling';
import { englishStems } from './projectRules';
import { getProjectKnowledge } from './projectKnowledge';

const safePrefixes = new Set(['mo', 'ma', 'ni', 'gi', 'gina', 'mag', 'nag', 'maka', 'naka', 'gipa', 'nagka', 'magka']);
const safeSuffixes = new Set(['tan', 'lon', 'han', 'hon', 'ran', 'hi', 'an', 'on', 'i']);
const technicalStems = new Set([...englishStems, ...'analyze capture take report inventory log task queue receive record save upload transcribe assign download run'.split(' ')]);
const functionWords = new Set('a an the as at by for from if in into is it of on or so than that to up us we with yes no oh'.split(' '));
export interface AffixCorrection { from: number; to: number; replacement: string }

function configuration() {
  const knowledge = getProjectKnowledge(), config = knowledge.policy.affixes;
  if (!config?.enabled) return;
  const prefixes = config.prefixes.filter(p => safePrefixes.has(p)).sort((a, b) => b.length - a.length);
  const suffixes = config.suffixes.filter(s => safeSuffixes.has(s)).sort((a, b) => b.length - a.length);
  const names = new Set(knowledge.entries.filter(e => e.status === 'name_reference' || /proper|personal name/i.test(e.language)).map(e => e.preferred.toLowerCase()));
  const local = new Set(knowledge.entries.filter(e => ['agreed', 'reviewed', 'protected'].includes(e.status) && /Bisaya|Tagalog|Hiligaynon|Ilonggo/.test(e.language))
    .flatMap(e => [e.preferred, ...e.variants]).map(s => s.toLowerCase()));
  const exempt = new Set(knowledge.policy.exempt_examples.map(s => s.toLowerCase()));
  return { prefixes, suffixes, names, local, exempt };
}

export function findAffixCorrections(text: string, onlyEndingAt?: number): AffixCorrection[] {
  const config = configuration();
  if (!config?.prefixes.length) return [];
  const { prefixes, suffixes, names, local, exempt } = config;
  const rootIsEnglish = (root: string) => {
    const word = root.toLowerCase();
    return word.length >= 3 && !names.has(word) && !functionWords.has(word) &&
      (technicalStems.has(word) || !isLocalWord(word) && !local.has(word)) && isEnglishWord(word);
  };
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_'’/\\\\@\\-])(${prefixes.join('|')})([ \\t]+|-?)([a-z]+(?:-[a-z]+)?)(?![\\p{L}\\p{N}_'’\\-])`, 'giu');
  const corrections: AffixCorrection[] = [];
  for (const match of text.matchAll(pattern)) {
    const from = match.index!, to = from + match[0].length;
    if (onlyEndingAt !== undefined && to !== onlyEndingAt) continue;
    const line = text.slice(text.lastIndexOf('\n', from - 1) + 1, to);
    if (/^\s*(?:Language:|(?:Outside speaker|Speaker)\b[^:]*$)/i.test(line) || line.lastIndexOf('[') > line.lastIndexOf(']') ||
      (line.match(/`/g)?.length || 0) % 2 || /[@/\\]|\bwww\./i.test(line.match(/\S+$/)?.[0] || '')) continue;
    const [input, prefix, separator, body] = match;
    // In this local construction nag is particle na + linker -g, not a
    // verbal prefix on the following English noun (mo-take man nag time).
    if (separator.trim() === '' && prefix.toLowerCase() === 'nag' && /\bman[ \t]+$/i.test(text.slice(0, from))) continue;
    // Reviewed Gomez noun-marker/title uses of ni are ambiguous with verbs.
    // Protect only separated known noun heads; ni-report/ni summarize and
    // actual hyphenated forms still follow the normal prefix rule.
    if (/^[ \t]+$/.test(separator) && prefix.toLowerCase() === 'ni' &&
      /^(?:farm|broiler|grower|starter|finisher|system|contract|current|miss|customer|coupon|finance|accounting|marketing)$/i.test(body)) continue;
    // Am oa/ato a ni side: deictic ni before a noun, not a verbal prefix.
    if (/^[ \t]+$/.test(separator) && /^ni$/i.test(prefix) && /^side$/i.test(body) &&
      /\b(?:amoa|atoa)[ \t]+$/i.test(text.slice(0, from))) continue;
    // These reviewed constructions use demonstrative ni (this), or pronoun
    // mo (you), not verbal prefixes. Keep the surrounding phrase narrow:
    // an isolated ni need or a genuine ni-report still receives its check.
    const beforePrefix = text.slice(0, from);
    if (/^[ \t]+$/.test(separator) && /^ni$/i.test(prefix) && (
      /^need$/i.test(body) && /\bmao[ \t]+$/i.test(beforePrefix) ||
      /^available$/i.test(body) && /\bdili[ \t]+diay[ \t]+$/i.test(beforePrefix) ||
      /^number$/i.test(body) && /\bpwede[ \t]+pud[ \t]+$/i.test(beforePrefix) ||
      /^manual$/i.test(body) && /\bdara[ \t]+$/i.test(beforePrefix)
    )) continue;
    if (/^[ \t]+$/.test(separator) && /^mo$/i.test(prefix) && /^tomorrow$/i.test(body) &&
      /\b(?:available[ \t]+ra|naa)[ \t]+$/i.test(beforePrefix)) continue;
    // Dili ra mo need: mo is the addressee pronoun in this construction.
    if (/^[ \t]+$/.test(separator) && prefix.toLowerCase() === 'mo' && /^need$/i.test(body) &&
      /\b(?:dili[ \t]+ra|naa[ \t]+(?:pa|pud|pa[ \t]+pud))[ \t]+$/i.test(text.slice(0, from))) continue;
    if (exempt.has(input.toLowerCase()) || !separator && (isEnglishWord(input) || isLocalWord(input) || local.has(input.toLowerCase()) || names.has(input.toLowerCase()))) continue;
    // Capitalized following words can be names, even if the dictionary has them.
    if (/^[A-Z]/.test(body) && input !== input.toUpperCase()) continue;
    let parts: string[] | undefined;
    const split = body.split('-');
    if (split.length === 2 && suffixes.includes(split[1].toLowerCase()) && rootIsEnglish(split[0])) parts = split;
    else if (rootIsEnglish(body)) parts = [body];
    else if (!isEnglishWord(body) && !isLocalWord(body) && !local.has(body.toLowerCase()) && !names.has(body.toLowerCase())) {
      const candidates = suffixes.filter(s => body.toLowerCase().endsWith(s) && rootIsEnglish(body.slice(0, -s.length)));
      if (candidates.length === 1) {
        const suffix = candidates[0]; parts = [body.slice(0, -suffix.length), body.slice(-suffix.length)];
      }
    }
    if (!parts) continue;
    const replacement = `${prefix}-${parts.join('-')}`;
    if (replacement !== input) corrections.push({ from, to, replacement });
  }
  return corrections;
}
