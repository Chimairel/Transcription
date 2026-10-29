import { EditorView, runScopeHandlers, type Panel, type ViewUpdate } from '@codemirror/view';
import { SearchQuery, closeSearchPanel, findNext, findPrevious, getSearchQuery, replaceAll, replaceNext, selectMatches, setSearchQuery } from '@codemirror/search';

function appendDOM(parent:Node,...nodes:(Node|string)[]){for(const node of nodes)parent.appendChild(typeof node==='string'?document.createTextNode(node):node);}

/** A native top-layer dialog with CodeMirror's existing search state/commands. */
class TranscriptSearchDialog implements Panel {
  readonly dom = document.createElement('div');
  private readonly dialog = document.createElement('dialog');
  private readonly find = document.createElement('input');
  private readonly replacement = document.createElement('input');
  private readonly matchCase = document.createElement('input');
  private readonly wholeWord = document.createElement('input');
  private readonly regexp = document.createElement('input');
  private readonly status = document.createElement('p');
  private readonly actions: HTMLButtonElement[] = [];
  private query: SearchQuery;
  readonly top = true;

  constructor(private readonly view: EditorView) {
    this.query = getSearchQuery(view.state);
    this.dom.className = 'floating-search-panel';
    this.dialog.className = 'transcript-search-dialog';
    this.dialog.setAttribute('aria-label', 'Find and replace');
    const heading = document.createElement('header');
    const title = document.createElement('h2'); title.textContent = 'Find and replace';
    appendDOM(heading, title, this.button('Close', () => this.close(), 'text-button'));
    this.find.type = this.replacement.type = 'text';
    this.find.setAttribute('main-field', 'true'); this.find.autofocus = true;
    this.find.placeholder = 'Word or phrase';
    this.replacement.placeholder = 'Replacement text';
    for (const input of [this.find, this.replacement]) {
      input.spellcheck = false; input.autocomplete = 'off';
      input.addEventListener('input', () => this.commit(input === this.find));
    }
    const options = document.createElement('div'); options.className = 'search-dialog-options';
    for (const [input, text] of [[this.matchCase, 'Match case'], [this.wholeWord, 'Whole word'], [this.regexp, 'Regular expression']] as const) {
      input.type = 'checkbox'; input.addEventListener('change', () => this.commit(true));
      const label = document.createElement('label'); appendDOM(label, input, text); appendDOM(options, label);
    }
    this.status.className = 'search-dialog-status';
    this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite'); this.status.setAttribute('aria-atomic', 'true');
    const navigation = document.createElement('div'); navigation.className = 'search-dialog-navigation';
    const navigationButtons = document.createElement('div');
    appendDOM(navigationButtons, this.action('Previous', () => findPrevious(view)), this.action('Next', () => findNext(view)));
    appendDOM(navigation, this.status, navigationButtons);
    const replacements = document.createElement('div'); replacements.className = 'search-dialog-actions';
    appendDOM(replacements, this.action('Select all matches', () => { selectMatches(view); this.close(); }, 'text-button'),
      this.action('Replace', () => replaceNext(view)), this.action('Replace all', () => replaceAll(view), 'primary'));
    const hint = document.createElement('p'); hint.className = 'search-dialog-hint';
    hint.textContent = 'Find: Enter for next, Shift+Enter for previous. Replace: Enter to replace. Esc to close.';
    appendDOM(this.dialog, heading, this.field('Find', this.find), options, navigation,
      this.field('Replace with', this.replacement), replacements, hint);
    appendDOM(this.dom, this.dialog);
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); this.close(); });
    this.dialog.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Tab') {
        const controls = [...this.dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (runScopeHandlers(view, event, 'search-panel')) { event.preventDefault(); event.stopPropagation(); }
      else if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type === 'text') {
        event.preventDefault(); event.stopPropagation();
        if (event.target === this.replacement) replaceNext(view);
        else (event.shiftKey ? findPrevious : findNext)(view);
      }
    });
    this.syncQuery();
  }

  private field(text: string, input: HTMLInputElement) {
    const label = document.createElement('label'); label.className = 'search-dialog-field';
    const name = document.createElement('span'); name.textContent = text;
    appendDOM(label, name, input); return label;
  }
  private button(text: string, action: () => void, className = 'secondary') {
    const button = document.createElement('button'); button.type = 'button';
    button.className = className; button.textContent = text; button.addEventListener('click', action); return button;
  }
  private action(text: string, action: () => void, className = 'secondary') {
    const button = this.button(text, action, className); this.actions.push(button); return button;
  }
  private commit(navigate: boolean) {
    const query = new SearchQuery({ search: this.find.value, replace: this.replacement.value,
      caseSensitive: this.matchCase.checked, wholeWord: this.wholeWord.checked, regexp: this.regexp.checked });
    if (query.eq(this.query)) return;
    this.query = query;
    this.view.dispatch({ effects: setSearchQuery.of(query),
      ...(navigate && query.valid ? { selection: { anchor: this.view.state.selection.main.from } } : {}) });
    if (navigate && query.valid) findNext(this.view);
    this.refreshStatus();
  }
  private syncQuery() {
    this.query = getSearchQuery(this.view.state);
    if (this.find.value !== this.query.search) this.find.value = this.query.search;
    if (this.replacement.value !== this.query.replace) this.replacement.value = this.query.replace;
    this.matchCase.checked = this.query.caseSensitive;
    this.wholeWord.checked = this.query.wholeWord;
    this.regexp.checked = this.query.regexp;
    this.refreshStatus();
  }
  private refreshStatus() {
    let count = 0, current = 0, truncated = false;
    if (this.query.valid) {
      const cursor = this.query.getCursor(this.view.state), selected = this.view.state.selection.main;
      for (let match = cursor.next(); !match.done; match = cursor.next()) {
        if (count === 5000) { truncated = true; break; }
        count++;
        if (match.value.from === selected.from && match.value.to === selected.to) current = count;
      }
    }
    const invalid = !!this.query.search && !this.query.valid;
    this.find.setAttribute('aria-invalid', String(invalid));
    this.status.classList.toggle('invalid-query', invalid);
    const text = invalid ? 'Invalid regular expression.' : !this.query.search ? 'Search this transcript.' : !count ? 'No matches.'
      : `${current ? current + ' of ' : ''}${count.toLocaleString()}${truncated ? '+' : ''} ${count === 1 ? 'match' : 'matches'}`;
    if (this.status.textContent !== text) this.status.textContent = text;
    for (const button of this.actions) button.disabled = !count || !this.query.valid ||
      this.view.state.readOnly && (button.textContent === 'Replace' || button.textContent === 'Replace all');
  }
  private close() {
    this.dialog.close(); closeSearchPanel(this.view); this.view.focus();
  }
  mount() { this.dialog.showModal(); this.find.focus(); this.find.select(); }
  update(update: ViewUpdate) {
    if (!getSearchQuery(update.state).eq(this.query)) this.syncQuery();
    else if (update.docChanged || update.selectionSet) this.refreshStatus();
  }
  destroy() {
    this.dialog.close();
    queueMicrotask(() => { if (this.view.dom.isConnected) this.view.focus(); });
  }
}

export const createSearchDialog = (view: EditorView): Panel => new TranscriptSearchDialog(view);
