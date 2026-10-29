import type { KnowledgeEntry } from './projectKnowledge';
import type { SpellingRule } from './types';

// Observed words, working identifications and names must never become spelling rules.
// The existing checker handles grammatical compounds in context; a reference
// example must not turn "as is" or English "I check" into a blanket violation.
const contextualCompounds = new Set(['as-is', 'to-be', 'kickoff', 'kick off', 'setup', 'set up', 'client-facing']);
export const libraryRules = (entries: KnowledgeEntry[]): SpellingRule[] => entries
  .filter(entry => ['agreed', 'reviewed'].includes(entry.status) && entry.variants.length && !contextualCompounds.has(entry.preferred))
  .map(entry => ({
    id: `library:${entry.id}`, preferred: entry.preferred,
    variants: entry.variants.filter(variant => !['i check', 'wont'].includes(variant.toLowerCase())),
    language: entry.language === 'Bisaya' ? 'Bisaya' : entry.language === 'Tagalog' ? 'Tagalog' : 'All',
    explanation: entry.context,
  }));
