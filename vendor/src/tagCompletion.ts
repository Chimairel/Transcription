import { acceptCompletion, autocompletion, closeCompletion, completionStatus, moveCompletionSelection, pickedCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { isolateHistory } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import { tagShortcuts } from './tagShortcuts';

function tagSource(context: CompletionContext): CompletionResult | null {
  const selection = context.state.selection;
  if (!selection.main.empty || selection.ranges.length !== 1) return null;
  const match = context.matchBefore(/\/[a-z]*$/i);
  if (!match || match.from > 0 && !/\s/.test(context.state.sliceDoc(match.from - 1, match.from))) return null;
  const query = match.text.slice(1).toLowerCase();
  const options = tagShortcuts.filter(({ shortcut, tag }) => shortcut.slice(1).startsWith(query) || tag.startsWith(query));
  if (!options.length) return null;
  return { from: match.from, filter: false, update: (_current, _from, _to, next) => tagSource(next), options: options.map(({ shortcut, tag }) => ({
    label: `[${tag}]`, detail: shortcut,
    apply(view, completion, from, to) {
      const insert = `[${tag}] `;
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length },
        annotations: [isolateHistory.of('full'), pickedCompletion.of(completion)], userEvent: 'input.complete', scrollIntoView: true });
      view.focus();
    },
  })) };
}

export const tagCompletion = autocompletion({
  override: [tagSource], activateOnTypingDelay: 0, interactionDelay: 0,
  defaultKeymap: false, icons: false, maxRenderedOptions: 4,
  tooltipClass: () => 'tag-command-menu',
});

export function handleTagMenuKey(event: KeyboardEvent, view: EditorView) {
  if (completionStatus(view.state) !== 'active') return false;
  if (event.key === 'ArrowDown') return moveCompletionSelection(true)(view);
  if (event.key === 'ArrowUp') return moveCompletionSelection(false)(view);
  if (event.key === 'Enter' || event.key === 'Tab') return acceptCompletion(view);
  if (event.key === 'Escape') return closeCompletion(view);
  return false;
}
