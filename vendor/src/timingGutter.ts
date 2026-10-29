import { StateEffect, StateField } from '@codemirror/state';
import { GutterMarker, gutter } from '@codemirror/view';
const time=(s:number)=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
import { type TimingCue } from './timings';

export const setTimingCues = StateEffect.define<readonly TimingCue[]>();
export const timingCues = StateField.define<readonly TimingCue[]>({
  create: () => [],
  update(cues, transaction) {
    for (const effect of transaction.effects) if (effect.is(setTimingCues)) return effect.value;
    if (!transaction.docChanged) return cues;
    return cues.flatMap(cue => {
      let touched = false;
      transaction.changes.iterChangedRanges((from, to) => { if (from < cue.to && to > cue.from || from === to && from > cue.from && from < cue.to) touched = true; });
      return touched ? [] : [{ ...cue, from: transaction.changes.mapPos(cue.from, 1), to: transaction.changes.mapPos(cue.to, -1) }];
    });
  },
});

class TimeMarker extends GutterMarker {
  constructor(readonly seconds: number) { super(); }
  eq(other: TimeMarker) { return other.seconds === this.seconds; }
  toDOM() {
    const element = document.createElement('span');
    element.className = 'line-timestamp'; element.textContent = `~${time(this.seconds)}`;
    element.title = `Approximate audio time ${time(this.seconds)}. Click to seek.`;
    return element;
  }
}

export function timestampGutter(onSeek: (cue: TimingCue) => void) {
  return gutter({
    class: 'timestamp-gutter',
    lineMarker(view, line) {
      const cues = view.state.field(timingCues);
      const cue = cues.find(c => c.from >= line.from && c.from < line.to);
      return cue ? new TimeMarker(cue.start) : null;
    },
    lineMarkerChange(update) { return update.startState.field(timingCues) !== update.state.field(timingCues); },
    domEventHandlers: { mousedown(view, line, event) {
      if (!(event instanceof MouseEvent) || event.button !== 0) return false;
      const cue = view.state.field(timingCues).find(c => c.from >= line.from && c.from < line.to);
      if (cue) { onSeek(cue); event.preventDefault(); return true; }
      return false;
    } },
  });
}
