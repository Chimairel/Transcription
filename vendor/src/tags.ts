export const approvedTags = ['unclear', 'crosstalk', 'noise', 'laughs'];

// Shared by editor decorations and counts so the visible totals match the highlights.
export function approvedTagPattern() {
  return new RegExp(`(?<!\\[)\\[(${approvedTags.join('|')})\\](?!\\])`, 'g');
}

export function countApprovedTags(text: string) {
  const counts: Record<string, number> = Object.fromEntries(approvedTags.map(tag => [tag, 0]));
  for (const match of text.matchAll(approvedTagPattern())) counts[match[1]]++;
  return approvedTags.map(tag => ({ tag, count: counts[tag] }));
}
