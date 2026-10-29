import library from '../transcription-library/entries.json';
import policy from '../transcription-library/autocorrect-policy.json';
import decisions from './data/project-decisions.json';
import guideText from '../TRANSCRIPTION_GUIDE.md?raw';

export interface KnowledgeEntry {
  id: string; preferred: string; variants: string[]; language: string;
  status: string; scope: string; context: string;
}
export interface ProjectKnowledge {
  schema: 1; version: string; entries: KnowledgeEntry[];
  policy: { rules: { preferred: string; variants: string[] }[]; exempt_examples: string[];
    affixes?: { enabled: boolean; prefixes: string[]; suffixes: string[] } };
  guide: { name: string; text: string }; decisions: { name: string; text: string };
}
export const bundledKnowledge: ProjectKnowledge = { schema: 1, version: 'bundled', entries: library.entries,
  policy, guide: { name: 'Current transcription guide', text: guideText }, decisions };
let snapshot = bundledKnowledge;
const listeners = new Set<() => void>();
export const getProjectKnowledge = () => snapshot;
export const subscribeProjectKnowledge = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string' && s.length <= 1000);
export function installProjectKnowledge(value: unknown): boolean {
  if (!record(value) || value.schema !== 1 || typeof value.version !== 'string' || !value.version ||
    !Array.isArray(value.entries) || value.entries.length > 10000 || !value.entries.every(e => record(e) &&
      ['id', 'preferred', 'language', 'status', 'scope', 'context'].every(key => typeof e[key] === 'string') && e.id && e.preferred &&
      typeof e.preferred === 'string' && e.preferred.length <= 1000 && strings(e.variants) && e.variants.every(v => !!v.trim())) ||
    !record(value.policy) || !Array.isArray(value.policy.rules) || value.policy.rules.length > 10000 || !strings(value.policy.exempt_examples) ||
    value.policy.affixes !== undefined && (!record(value.policy.affixes) || typeof value.policy.affixes.enabled !== 'boolean' ||
      !strings(value.policy.affixes.prefixes) || !strings(value.policy.affixes.suffixes) ||
      value.policy.affixes.prefixes.length > 30 || value.policy.affixes.suffixes.length > 20 ||
      ![...value.policy.affixes.prefixes, ...value.policy.affixes.suffixes].every(s => /^[a-z]{1,12}$/.test(s))) ||
    !value.policy.rules.every(r => record(r) && typeof r.preferred === 'string' && r.preferred.length > 0 && r.preferred.length <= 1000 && strings(r.variants) && r.variants.every(v => !!v.trim())) ||
    ![value.guide, value.decisions].every(r => record(r) && typeof r.name === 'string' && typeof r.text === 'string')) throw new Error('Project knowledge has an invalid format. Previous checks are retained.');
  const ids = value.entries.map(e => e.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate word-library IDs. Previous checks are retained.');
  if (value.version === snapshot.version) return false;
  snapshot = value as unknown as ProjectKnowledge;
  listeners.forEach(listener => listener());
  return true;
}
