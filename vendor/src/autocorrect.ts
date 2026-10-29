import { getProjectKnowledge, subscribeProjectKnowledge, bundledKnowledge } from './projectKnowledge';
import { getBuiltinRules } from './rules';
import { findAffixCorrections } from './affixCorrections';

const normalize = (value: string) => value.toLowerCase().replaceAll('’', "'");
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");

// Explicit allowlist only: a custom decision or an English dictionary guess is
// never sufficient to authorize automatic rewriting.
function buildCorrections() {
  const { policy } = getProjectKnowledge(), builtins = getBuiltinRules();
  const exempt = new Set([...bundledKnowledge.policy.exempt_examples, ...policy.exempt_examples].map(normalize));
  const targets = new Map<string, Set<string>>();
  for (const rule of policy.rules) for (const variant of rule.variants) {
    const key = normalize(variant);
    if (!targets.has(key)) targets.set(key, new Set());
    targets.get(key)!.add(normalize(rule.preferred));
  }
  return policy.rules.flatMap(rule => rule.variants.filter(variant => !exempt.has(normalize(variant)) &&
  targets.get(normalize(variant))?.size === 1 &&
  !builtins.some(source => normalize(source.preferred) !== normalize(rule.preferred) && source.variants.some(known => normalize(known) === normalize(variant))) &&
  builtins.some(source => normalize(source.preferred) === normalize(rule.preferred) &&
    source.variants.some(known => normalize(known) === normalize(variant))))
  .map(variant => ({ preferred: rule.preferred, variant,
    pattern: new RegExp(`(?<![\\p{L}\\p{N}_'’\\-])${escape(variant)}$`, 'iu') })))
  .sort((a, b) => b.variant.length - a.variant.length);
}
export let autocorrections = buildCorrections();
let lookBehind = Math.max(0, ...autocorrections.map(rule => rule.variant.length)) + 1;
subscribeProjectKnowledge(() => {
  autocorrections = buildCorrections();
  lookBehind = Math.max(0, ...autocorrections.map(rule => rule.variant.length)) + 1;
});

export interface WordCorrection { from: number; to: number; replacement: string }

function protectedContext(text: string, cursor: number) {
  const line = text.slice(text.lastIndexOf('\n', cursor - 1) + 1, cursor);
  if (/^\s*Language:/i.test(line) || /^\s*(?:Outside speaker|Speaker)\b[^:]*$/i.test(line)) return true;
  if (line.lastIndexOf('[') > line.lastIndexOf(']') || (line.match(/`/g)?.length || 0) % 2) return true;
  const token = line.match(/\S*$/)?.[0] || '';
  return /[@/\\]|\bwww\.|\b[\w-]+\.(?:com|org|net|ph|io)\b/i.test(token);
}

export function correctionBefore(text: string, cursor: number): WordCorrection | undefined {
  if (cursor < 0 || cursor > text.length || /[\p{L}\p{N}_'’\-]/u.test(text[cursor] || '') || protectedContext(text, cursor)) return;
  const start = Math.max(0, cursor - lookBehind), before = text.slice(start, cursor);
  for (const rule of autocorrections) {
    const match = before.match(rule.pattern);
    if (!match) continue;
    const input = match[0];
    const replacement = input === input.toUpperCase() ? rule.preferred.toUpperCase()
      : /\p{Lu}/u.test(input[0]) ? rule.preferred[0].toUpperCase() + rule.preferred.slice(1) : rule.preferred;
    return { from: cursor - input.length, to: cursor, replacement };
  }
  // Structural completion uses exact English recognition plus reviewed affix
  // lists, with independent local/name/function-word protections.
  const windowStart = Math.max(0, cursor - 100);
  const tail = text.slice(windowStart, cursor), structural = findAffixCorrections(tail, tail.length)[0];
  if (structural) return { ...structural, from: structural.from + windowStart, to: structural.to + windowStart };
}
