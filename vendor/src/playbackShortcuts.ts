export type PlaybackAction = 'rewind' | 'toggle' | 'forward';
type PlaybackKey = Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'> & {
  getModifierState?(key: string): boolean;
  defaultPrevented?: boolean;
};
const laptop: Record<string, PlaybackAction> = { KeyJ: 'rewind', KeyK: 'toggle', KeyL: 'forward' };
const legacy: Record<string, PlaybackAction> = {
  Delete: 'rewind', End: 'toggle', PageDown: 'forward', F2: 'rewind', F3: 'toggle', F4: 'forward',
};
/** Resolve only playback chords; target/focus ownership belongs to the caller. */
export function playbackAction(event: PlaybackKey): PlaybackAction | undefined {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.shiftKey || event.getModifierState?.('AltGraph')) return;
  return (event.altKey ? laptop : legacy)[event.code];
}
