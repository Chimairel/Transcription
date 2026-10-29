import nspell from 'nspell';
// Read the package data directly: its JS entry point uses Node's filesystem.
import aff from '../../node_modules/dictionary-en/index.aff?raw';
import dic from '../../node_modules/dictionary-en/index.dic?raw';
import type { Language } from './types';

let dictionary: ReturnType<typeof nspell> | undefined;
const cache = new Map<string, string | undefined>();
const commonTypos: Record<string, string> = {
  recieve: 'receive', recieved: 'received', recieving: 'receiving', receieve: 'receive',
  becuase: 'because', beacuse: 'because', definately: 'definitely', seperate: 'separate',
  accomodate: 'accommodate', accomodation: 'accommodation', occurence: 'occurrence',
  acheive: 'achieve', acheived: 'achieved', enviroment: 'environment', goverment: 'government',
  langauge: 'language', transcripton: 'transcription', transciption: 'transcription',
  warehose: 'warehouse', warhouse: 'warehouse', busines: 'business', bussiness: 'business',
  managment: 'management', requirment: 'requirement', requirments: 'requirements',
  developement: 'development', maintainance: 'maintenance', responsibilty: 'responsibility',
  succesful: 'successful', sucess: 'success', sucessful: 'successful',
  calender: 'calendar', untill: 'until', adress: 'address', adressing: 'addressing',
  grammer: 'grammar', mispelling: 'misspelling', mispelled: 'misspelled',
};
const localWords = new Set(`ako akoa akong akoy amo amoa among amoy ang ano asa ato atoa atong atoa ba baboy bagong bago bag-o bag-ong bahala bale basin baya bayad bitaw buhat buhaton bugas daghan dayon di diay diha dihang diyan diri dito doon duha dyud gani ganun ganoon gamit gihapon ginansya gusto ha hapon hibaw hindi himo human huwag ikaw ilaha ilahang ilang importante ingon inventory isa isang ito iyang iyaha iyang iyo inyong jan jud juy ka kabalo kabaw kabuok kahibaw kaayo kada kamo kana kanang kani kaning kanila kanina kanino karon kasa kasi kinsa kinse kita ko kog kon kung kuan kuha kulang kuno kuyog lang lagi lima lisod ma mao man mga mo muna na naa naamot naman nako nakay nakuha naku nimo ninyo nila niya nila ninyo nga ng nang ngano nganong ngadto ngari ning niini nindot no noh nya og oo pa pakita pala palit para pero pesos pila pito po pud ra resulta rin sa sab sako sabihin said samok sang saging sayo siya sige sila singko sir sobra suwat ta tag tatlo tawo tawag ten tika tingali trabaho trabahoon tulo ug unom unsa unsay unya upat wa wag wala way walo yan yung yun napulo siyam eskwela mesa kwarta`.split(/\s+/));
for (const word of 'siguro nahuman silbing kakita kinsay tindahan sabtan responsable problema depende hangad tarong butang inig sugton padong diring himong manginahanglan tungan naiwan pilay atong katong ningon kinahanglang kinahanglan gamay kaugalingon mahuman pananglitan kinahanglanon pangutana pangutanon adunay pwede puede adto ngadto didto dali lisud abot bahin sulod gawas ubos taas hunahuna huna-huna kahuman una sunod samtang aron arun uban ubanon karong kanhi niadtong kini niana niadtong ana ani ato atoa inyohang niana nianang nianing aniang ganahan gusto nakita kitaon makita makitaon magamit gamiton ihatag tagaan hatag ihimo himoon buhaton buhatonon trabahante inyoha mao man pud pud diay unsaon para pasar sabot kasabot nakasabot abtan nahitabo mahitabo nahibaw-an nahibal-an kalabot labot tinuod tinuoray karong bagsak pulong dapat paano bakit mayroon meron naman nandiyan nandoon iyon yun din dito doon diyan minsan talaga medyo kasi kundi kapag kung ngayon kagaya gaano kaya sila natin namin niyo nyo kayo rin sana tungkol bilang mula upang dahil tapos matapos bago bagong sino saan kailan bakit kailangan wala walang maraming marami lahat lahatin kaunti kahit ganito ganyan ganun ganoon mas mabuti mabigat maganda magaling konti'.split(' ')) localWords.add(word);
const technicalWords = new Set(['dev', 'customizations', 'customization', 'customisations', 'customisation']);
for (const word of ["where'd", "what'd", "who'd", "how'd", "why'd", "when'd", "there'd"]) technicalWords.add(word);
// Common local words remain local even beside English clauses.
for (const word of 'sayang bantay parang silang kaming kitang kayong itong pinaka manang pilion halang mingon imposible'.split(' ')) localWords.add(word);
// Recognized local forms and the place name in this project's transcript.
for (const word of ['kining', 'mandaue']) localWords.add(word);
const prefixes = new Set(['gi', 'gina', 'i', 'e', 'na', 'ma', 'mo', 'mag', 'nag', 'naka', 'maka', 'ka']);
const suffixes = new Set(['tan', 'lon', 'hi', 'han', 'an']);
const anchors = new Set('the this that these those with from into because will would should could have has had was were are our your their project process system department requirements document implement design we they please need can for and then'.split(' '));

// Exact dictionary recognition only: suggestions never license an affix edit.
export function isEnglishWord(word: string) {
  dictionary ??= nspell(aff, dic);
  return dictionary.correct(word.toLowerCase());
}
export function isLocalWord(word: string) { return localWords.has(word.toLowerCase()); }

function nearbyEnglish(word: string, spell: ReturnType<typeof nspell>) {
  // Bounded single-edit candidates avoid Hunspell's expensive multi-edit suggestion search.
  for (let i = 0; i < word.length; i++) {
    const deleted = word.slice(0, i) + word.slice(i + 1);
    if (spell.correct(deleted)) return deleted;
    if (i < word.length - 1) {
      const swapped = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
      if (swapped !== word && spell.correct(swapped)) return swapped;
    }
  }
  for (let i = 0; i <= word.length; i++) for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    if (letter !== word[i] && i < word.length) {
      const replaced = word.slice(0, i) + letter + word.slice(i + 1);
      if (spell.correct(replaced)) return replaced;
    }
    const inserted = word.slice(0, i) + letter + word.slice(i);
    if (spell.correct(inserted)) return inserted;
  }
  return '';
}

function suggestion(word: string) {
  if (cache.has(word)) return cache.get(word);
  dictionary ??= nspell(aff, dic);
  const result = dictionary.correct(word) || dictionary.correct(word[0].toUpperCase() + word.slice(1)) || technicalWords.has(word) ? undefined : (commonTypos[word] || nearbyEnglish(word, dictionary));
  if (cache.size >= 2000) cache.clear();
  cache.set(word, result);
  return result;
}
export function englishWarnings(text: string, language: Language, approved: string[], protectedAt: (at: number) => boolean) {
  const approvedWords = new Set(approved.flatMap(s => s.toLowerCase().match(/[\p{L}'’]+/gu) || []));
  const tokens = [...text.matchAll(/[\p{L}]+(?:['’][\p{L}]+)*(?:-[\p{L}]+(?:['’][\p{L}]+)*)*/gu)];
  const warnings: { from: number; to: number; replacement?: string }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], start = token.index!;
    if (protectedAt(start) || /\[[^\]\n]*$/.test(text.slice(Math.max(0, start - 30), start))) continue;
    const parts = [...token[0].matchAll(/[\p{L}]+(?:['’][\p{L}]+)*/gu)];
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex], original = part[0], word = original.toLowerCase().replaceAll('’', "'");
      if (word.length < 3 || word.length > 40 || localWords.has(word) || approvedWords.has(word) || /^[\p{Lu}]+$/u.test(original)) continue;
      if (parts.length > 1 && (partIndex === 0 && prefixes.has(word) || partIndex === parts.length - 1 && suffixes.has(word))) continue;
      const from = start + part.index!;
      // Do not split identifiers, model numbers or underscore-separated filenames into spelling candidates.
      if (/[\p{N}_]/u.test(text[start - 1] || '') || /[\p{N}_]/u.test(text[start + token[0].length] || '')) continue;
      const nearby = tokens.slice(Math.max(0, i - 3), i + 4).filter(t =>
        !/[.!?\n:]/.test(text.slice(Math.min(t.index!, start), Math.max(t.index!, start))));
      const englishContext = nearby.filter(t => anchors.has(t[0].toLowerCase())).length >= 2;
      const cautious = language !== 'English' && !commonTypos[word] && !englishContext;
      if (cautious && word.length < 6 || language !== 'English' && !commonTypos[word] && /^(?:pang|pag|maka|naka|kah|mak|mang|nag|mag|gipa|kina|unsa)/.test(word)) continue;
      // Unknown names and brands are for the listening pass, not a dictionary correction.
      if (!commonTypos[word] && /\p{Lu}/u.test(original.slice(1))) continue;
      if (!commonTypos[word] && /^\p{Lu}/u.test(original) && !/(?:^|[.!?:]\s*|\]\s*)$/.test(text.slice(0, from))) continue;
      const result = suggestion(word);
      if (result === undefined) continue;
      if (language !== 'English' && !result) continue;
      const replacement = result ? (/^\p{Lu}/u.test(original) ? result[0].toUpperCase() + result.slice(1) : result) : undefined;
      warnings.push({ from, to: from + original.length, replacement });
    }
  }
  return warnings;
}
