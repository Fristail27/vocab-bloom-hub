import { EnPartOfSpeechE, EnWordFormsE } from '../../../../types';
import { isRegularForm, mergeEntries } from '../../normalize';
import type { ConvertedEntryT } from '../../types';
import type { LexemeT, MorphologyT } from './types';

const VERB_FORMS = ['past_tense', 'past_participle', 'present_participle', 'third_person_singular'] as const;
const KINDS = new Set(['simplex', 'compound', 'phrasal_verb']);

type CandidateT = { word: string; otherParts: boolean };
type GroupT = { forms: string[]; candidates: CandidateT[] };

const signatureOf = (morphology: MorphologyT): string[] | null => {
  const forms = VERB_FORMS.map((field) => morphology[field]?.trim() ?? '');
  // eslint-disable-next-line no-control-regex
  return forms.every((word) => word && !/[\u0000-\u001f\u007f]/u.test(word)) ? forms : null;
};

// The third-person singular identifies the lemma even when it is also a
// past participle (run/run, cut/cut). Do not guess from the shortest spelling.
const hasThirdPerson = (base: string, third: string): boolean => {
  const words = base.split(' ');
  const forms = third.split(' ');
  if (words.length !== forms.length || base === third) return false;
  return words.every(
    (word, index) =>
      word === forms[index] ||
      (word === 'be' && forms[index] === 'is') ||
      (word === 'have' && forms[index] === 'has') ||
      isRegularForm(word, forms[index], EnWordFormsE.plural_form),
  );
};

// Regular endings distinguish productive inflections from irregular
// homographs. OpenGloss's saw/verb mixes see and cutting-tool senses under
// see's paradigm; keep such ambiguous entries when they have another POS.
const regularInflection = (base: string, word: string, forms: string[]): boolean =>
  (word === forms[3] && hasThirdPerson(base, word)) ||
  ((word === forms[0] || word === forms[1]) && isRegularForm(base, word, EnWordFormsE.past_simple)) ||
  (word === forms[2] && word.endsWith('ing'));

/** Normalize repeated verb paradigms using only this OpenGloss input. */
export class OpenGlossInflections {
  private readonly groups = new Map<string, GroupT>();
  private readonly bases = new Map<string, string>();
  private readonly pending = new Map<string, { base: ConvertedEntryT[]; forms: ConvertedEntryT[] }>();

  add(lexeme: LexemeT): void {
    if (
      lexeme.retired ||
      lexeme.language !== 'en' ||
      lexeme.source !== 'opengloss-v1.3' ||
      !KINDS.has(lexeme.kind) ||
      !Array.isArray(lexeme.sense_ids) ||
      !Array.isArray(lexeme.morphology)
    )
      return;
    const parts = new Set(lexeme.sense_ids.map((id) => id.split(':').at(-2)));
    if (!parts.has('verb')) return;
    const verbs = lexeme.morphology.filter((item) => item.pos === 'verb');
    if (verbs.length !== 1) return;
    const forms = signatureOf(verbs[0]);
    if (!forms) return;
    const key = JSON.stringify(forms);
    const group = this.groups.get(key) ?? { forms, candidates: [] };
    group.candidates.push({ word: lexeme.headword, otherParts: parts.size > 1 });
    this.groups.set(key, group);
  }

  prepare(): void {
    for (const { forms, candidates } of this.groups.values()) {
      const lemmas = candidates.filter(({ word }) => hasThirdPerson(word, forms[3]));
      if (lemmas.length !== 1) continue;
      const base = lemmas[0].word;
      for (const candidate of candidates) {
        if (
          candidate.word === base ||
          !forms.includes(candidate.word) ||
          (candidate.otherParts && !regularInflection(base, candidate.word, forms))
        )
          continue;
        this.bases.set(candidate.word, base);
        this.pending.set(base, { base: [], forms: [] });
      }
    }
    this.groups.clear();
  }

  /** Delay only affected verbs; every other entry keeps streaming normally. */
  take(entry: ConvertedEntryT): boolean {
    if (entry.part_of_speech !== EnPartOfSpeechE.verb) return false;
    const base = this.bases.get(entry.word);
    const group = this.pending.get(base ?? entry.word);
    if (!group) return false;
    (base ? group.forms : group.base).push(entry);
    return true;
  }

  async flush(emit: (entry: ConvertedEntryT) => Promise<void>): Promise<number> {
    let folded = 0;
    for (const group of this.pending.values()) {
      const [base] = group.base;
      // A missing/damaged base definition (or a limited conversion) must
      // never swallow the form's definitions or create an invented lemma.
      if (!base) {
        for (const entry of group.forms) await emit(entry);
        continue;
      }
      let merged = base;
      for (const entry of [...group.base.slice(1), ...group.forms]) {
        merged = mergeEntries(merged, {
          ...entry,
          word: base.word,
          verb___is_irregular: base.verb___is_irregular,
          verb___is_phrasal: base.verb___is_phrasal,
          base_phrasal: base.base_phrasal,
        });
      }
      folded += new Set(group.forms.map((entry) => entry.word)).size;
      await emit(merged);
    }
    return folded;
  }
}
