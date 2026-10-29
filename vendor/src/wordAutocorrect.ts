import { isolateHistory } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import { correctionBefore } from './autocorrect';

export function autocorrectWord(event: KeyboardEvent, view: EditorView) {
  if (view.composing || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return false;
  const boundary = event.key === 'Enter' ? '\n' : event.key === 'Tab' ? '' : event.key;
  if (event.key !== 'Tab' && !/^[\s.,!?;:…\)\]"”]$/u.test(boundary)) return false;
  const cursor = view.state.selection.main;
  if (!cursor.empty || view.state.selection.ranges.length !== 1) return false;
  const correction = correctionBefore(view.state.doc.toString(), cursor.head);
  if (!correction) return false;
  // Keep the typed separator in its own normal input transaction. Undo then
  // restores the spelling without removing the space/newline or retriggering it.
  if (boundary) view.dispatch({ changes: { from: cursor.head, insert: boundary },
    selection: { anchor: cursor.head + boundary.length }, userEvent: 'input.type' });
  view.dispatch({ changes: { from: correction.from, to: correction.to, insert: correction.replacement },
    selection: { anchor: correction.from + correction.replacement.length + boundary.length },
    annotations: isolateHistory.of('full'), userEvent: 'input.autocorrect', scrollIntoView: true });
  // Tab keeps its native focus behavior after finishing the word.
  return event.key !== 'Tab';
}
