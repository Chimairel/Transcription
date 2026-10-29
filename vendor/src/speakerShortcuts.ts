import { isolateHistory } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import { speakerShortcutLabel } from './speakers';

export function completeSpeakerShortcut(view: EditorView): boolean {
  const { state } = view, cursor = state.selection.main;
  if (view.composing || state.readOnly || !cursor.empty || state.selection.ranges.length !== 1) return false;
  const line = state.doc.lineAt(cursor.head);
  const label = speakerShortcutLabel(state.sliceDoc(line.from, cursor.head));
  if (!label) return false;
  const after = state.sliceDoc(cursor.head, line.to);
  const colon = /^:[ \t]*/.exec(after);
  if (!colon && !/^[ \t]*$/.test(after)) return false;
  const insert = `${label}: `;
  view.dispatch({ changes: { from: line.from, to: cursor.head + (colon?.[0].length ?? after.length), insert },
    selection: { anchor: line.from + insert.length }, annotations: isolateHistory.of('full'),
    userEvent: 'input.complete', scrollIntoView: true });
  return true;
}
