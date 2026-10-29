import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, Prec } from '@codemirror/state';
import { Decoration, EditorView, MatchDecorator, ViewPlugin, keymap, placeholder, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, isolateHistory } from '@codemirror/commands';
import { openSearchPanel, search, searchKeymap } from '@codemirror/search';
import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import type { Finding } from '../types';
import { tagShortcuts } from '../tagShortcuts';
import { approvedTagPattern } from '../tags';
import { handleTagMenuKey, tagCompletion } from '../tagCompletion';
import { backspaceTag } from '../tagEditing';
import { autocorrectWord } from '../wordAutocorrect';
import { cueAt, type TimingCue } from '../timings';
import { setTimingCues, timingCues, timestampGutter } from '../timingGutter';
import { createSearchDialog } from '../searchDialog';
import { completeSpeakerShortcut } from '../speakerShortcuts';

const tagMatcher = new MatchDecorator({
  regexp: approvedTagPattern(),
  decoration: match => Decoration.mark({ class: 'cm-transcript-tag', attributes: { 'data-transcription-tag': match[1] } }),
});
const tagHighlights = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = tagMatcher.createDeco(view); }
  update(update: ViewUpdate) { this.decorations = tagMatcher.updateDeco(update, this.decorations); }
}, { decorations: value => value.decorations });

function expandTagShortcut(view: EditorView) {
  const { state } = view, cursor = state.selection.main;
  if (view.composing || !cursor.empty || state.selection.ranges.length !== 1) return false;
  const line = state.doc.lineAt(cursor.head);
  const before = state.sliceDoc(Math.max(line.from, cursor.head - 5), cursor.head);
  const match = tagShortcuts.find(({ shortcut }) => [shortcut, shortcut.replace('/', '.')].some(alias =>
    before === alias || before.endsWith(alias) && /\s/u.test(before.at(-alias.length - 1) || '')));
  if (!match) return false;
  const from = cursor.head - match.shortcut.length, insert = `[${match.tag}] `;
  view.dispatch({ changes: { from, to: cursor.head, insert }, selection: { anchor: from + insert.length },
    annotations: isolateHistory.of('full'), userEvent: 'input.complete', scrollIntoView: true });
  return true;
}

function insertSpeakerTurn(view: EditorView, label?: string) {
  if (view.composing || view.state.selection.ranges.length !== 1) return false;
  const { from, to } = view.state.selection.main;
  const before = view.state.sliceDoc(0, from);
  const gap = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const insert = `${gap}${label || 'Speaker '}: `;
  const anchor = label ? from + insert.length : from + gap.length + 'Speaker '.length;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor },
    annotations: isolateHistory.of('full'), userEvent: 'input', scrollIntoView: true });
  return true;
}

export interface EditorHandle { insert(text: string): void; insertTurn(label: string): void; correct(finding: Finding): void; locate(finding: Finding): void; find(): void }
interface Props { initialText: string; findings: Finding[]; onChange(text: string): void; cues?: readonly TimingCue[]; clickToSeek?: boolean; onSeek?(cue?: TimingCue): void; onCursorCue?(cue?: TimingCue): void }
const noCues: readonly TimingCue[] = [];
export const TranscriptEditor = forwardRef<EditorHandle, Props>(function TranscriptEditor(props, ref) {
  const { initialText, findings, onChange, cues = noCues } = props;
  const host = useRef<HTMLDivElement>(null), editor = useRef<EditorView | null>(null), change = useRef(onChange);
  const latest = useRef(props); latest.current = props;
  change.current = onChange;
  useEffect(() => {
    if (!host.current) return;
    let pointerDown: { x: number; y: number } | null = null;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: initialText, extensions: [
        history(), EditorState.allowMultipleSelections.of(true), search({ createPanel: createSearchDialog }), timingCues.init(() => cues), timestampGutter(cue => latest.current.onSeek?.(cue)),
        Prec.highest(EditorView.domEventHandlers({ keydown(event, view) {
          if (event.altKey && event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.isComposing) {
            latest.current.onSeek?.(cueAt(view.state.field(timingCues), view.state.selection.main.head)); event.preventDefault(); return true;
          }
          if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return false;
          if (event.key === 'Enter' && event.shiftKey && insertSpeakerTurn(view)) { event.preventDefault(); return true; }
          if ([' ', 'Tab', 'Enter', ':'].includes(event.key) && completeSpeakerShortcut(view)) { event.preventDefault(); return true; }
          if (event.shiftKey) {
            if (autocorrectWord(event, view)) { event.preventDefault(); return true; }
            return false;
          }
          if (event.key === 'Backspace' && backspaceTag(view, event.repeat)) { event.preventDefault(); return true; }
          if (handleTagMenuKey(event, view)) { event.preventDefault(); return true; }
          if ((event.key === ' ' || event.key === 'Tab') && expandTagShortcut(view)) { event.preventDefault(); return true; }
          if (autocorrectWord(event, view)) { event.preventDefault(); return true; }
          return false;
        }, mousedown(event) { pointerDown = { x: event.clientX, y: event.clientY }; return false; },
        click(event, view) {
          if (!latest.current.clickToSeek || event.detail !== 1 || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !pointerDown ||
              Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 4 || !view.state.selection.main.empty || !(event.target as Element).closest('.cm-line')) return false;
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos !== null) latest.current.onSeek?.(cueAt(view.state.field(timingCues), pos));
          return false;
        } })),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.lineWrapping, tagHighlights, tagCompletion,
        EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off', 'aria-label': 'Transcript text', role: 'textbox', 'aria-multiline': 'true' }),
        placeholder('Speaker one: Start with what you hear…'),
        EditorView.updateListener.of(update => {
          if (update.docChanged) change.current(update.state.doc.toString());
          if (update.docChanged || update.selectionSet) latest.current.onCursorCue?.(cueAt(update.state.field(timingCues), update.state.selection.main.head));
        }),
      ] }),
    });
    editor.current = view;
    return () => { view.destroy(); editor.current = null; };
    // A keyed instance owns its initial document and undo history for one recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    view.dispatch({ effects: setTimingCues.of(cues) });
    latest.current.onCursorCue?.(cueAt(cues, view.state.selection.main.head));
  }, [cues]);
  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const diagnostics: Diagnostic[] = findings.filter(f => (f.severity === 'error' || f.rule === 'english-spelling') && f.to <= view.state.doc.length).map(f => ({
      from: f.from, to: f.to, severity: f.severity === 'error' ? 'error' : 'warning', message: f.message,
      actions: f.replacement === undefined ? undefined : [{ name: 'Apply suggestion', apply: (v, from, to) => {
        v.dispatch({ changes: { from, to, insert: f.replacement! }, selection: { anchor: from + f.replacement!.length }, userEvent: 'input' }); v.focus();
      } }],
    }));
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [findings]);
  useImperativeHandle(ref, () => ({
    insert(text) {
      const view = editor.current;
      if (!view) return;
      view.dispatch(view.state.replaceSelection(text)); view.focus();
    },
    insertTurn(label) {
      const view = editor.current;
      if (view && insertSpeakerTurn(view, label)) view.focus();
    },
    correct(finding) {
      const view = editor.current;
      if (!view || finding.replacement === undefined || finding.to > view.state.doc.length) return;
      view.dispatch({ changes: { from: finding.from, to: finding.to, insert: finding.replacement },
        selection: { anchor: finding.from + finding.replacement.length }, userEvent: 'input' }); view.focus();
    },
    locate(finding) {
      const view = editor.current;
      if (!view) return;
      view.dispatch({ selection: { anchor: finding.from, head: finding.to }, effects: EditorView.scrollIntoView(finding.from, { y: 'center' }) }); view.focus();
    },
    find() { if (editor.current) openSearchPanel(editor.current); },
  }), []);
  return <div className={`editor-host ${cues.length ? 'has-timings' : ''} ${props.clickToSeek ? 'click-to-seek' : ''}`} ref={host} />;
});
