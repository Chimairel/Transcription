import { isolateHistory } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import { approvedTagPattern, approvedTags } from './tags';

const longestTag = Math.max(...approvedTags.map(tag => tag.length + 2));

export function backspaceTag(view: EditorView, repeat: boolean) {
  const { state } = view, cursor = state.selection.main;
  if (view.composing || state.readOnly || state.selection.ranges.length !== 1) return false;
  if (!cursor.empty) {
    const selected = state.sliceDoc(cursor.from, cursor.to);
    const match = approvedTagPattern().exec(selected);
    if (!match || match.index !== 0 || selected !== match[0]) return false;
    // Holding the key must not turn the first selection into an accidental deletion.
    if (!repeat) view.dispatch({ changes: { from: cursor.from, to: cursor.to }, selection: { anchor: cursor.from },
      annotations: isolateHistory.of('full'), userEvent: 'delete.backward', scrollIntoView: true });
    return true;
  }
  const line = state.doc.lineAt(cursor.head);
  const start = Math.max(line.from, cursor.head - longestTag - 2);
  const nearby = state.sliceDoc(start, Math.min(line.to, cursor.head + longestTag + 1));
  for (const match of nearby.matchAll(approvedTagPattern())) {
    const from = start + match.index!, to = from + match[0].length;
    const inside = cursor.head > from && cursor.head <= to;
    if (!inside) continue;
    view.dispatch({ selection: { anchor: from, head: to }, userEvent: 'select', scrollIntoView: true });
    return true;
  }
  return false;
}
