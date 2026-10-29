export const speakerWords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const;
const number = `${speakerWords.join('|')}|[1-9]\\d*`;
// Separate captures preserve the independent in-call and outside sequences.
// An unnumbered label is allowed only for a single outside voice.
export const speakerLabelPattern = new RegExp(`^(?:Speaker (${number})|Outside speaker(?: (${number}))?):[ \\t]*`);
export const speakerChoices = speakerWords.map(n => ({ value: n as string, label: `Speaker ${n}` }));
export const outsideSpeakerChoices = [{ value: 'outside', label: 'Outside speaker' },
  ...speakerWords.map(n => ({ value: `outside-${n}`, label: `Outside speaker ${n}` }))];

// Only unfinished line-leading labels qualify. Spoken text and completed labels
// are deliberately excluded; expanding o waits for a delimiter so o10 can finish.
export function speakerShortcutLabel(prefix: string): string | undefined {
  const match = new RegExp(`^(Speaker|Outside speaker)[ \\t]+(o(?:10|[1-9])?|10|[1-9]|${speakerWords.join('|')})[ \\t]*$`, 'i').exec(prefix);
  if (!match) return;
  const token = match[2].toLowerCase();
  const outsideCode = /^o(?:10|[1-9])?$/.test(token);
  if (match[1].toLowerCase() === 'outside speaker' && outsideCode) return;
  const outside = outsideCode || match[1].toLowerCase() === 'outside speaker';
  if (token === 'o') return 'Outside speaker';
  const number = outsideCode ? token.slice(1) : token;
  const word = /^\d+$/.test(number) ? speakerWords[Number(number) - 1] : speakerWords.find(word => word === number);
  return word ? `${outside ? 'Outside speaker' : 'Speaker'} ${word}` : undefined;
}

export function stripSpeakerLabels(text: string) {
  return text.replace(new RegExp(speakerLabelPattern.source, 'gm'), '');
}
