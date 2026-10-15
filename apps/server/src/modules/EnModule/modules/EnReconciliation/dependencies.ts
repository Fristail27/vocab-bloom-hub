import { EnPartOfSpeechE } from '../../../../../types';
import { collection, object, strings } from './document';
import { ReconciliationItem } from './entities';

type ResultT = Pick<ReconciliationItem, 'headword' | 'result'>;
type TargetT = { parts: Set<string>; alternatives: Set<string>; base?: string };

/** Only reference endpoints stay in memory, never definitions, translations or history. */
export class ReconciliationDependencies {
  private readonly articles = new Map<string, TargetT>();
  private readonly forms = new Map<string, Set<string>>();
  private readonly deleted = new Set<string>();

  static async read(items: AsyncIterable<ResultT>): Promise<ReconciliationDependencies> {
    const graph = new ReconciliationDependencies();
    for await (const item of items) {
      if (!item.result.present) {
        graph.deleted.add(item.headword);
        continue;
      }
      const article = object(item.result.value);
      const parts = object(article.parts);
      const verb = parts[EnPartOfSpeechE.verb];
      const base = verb ? object(object(verb).common).base_phrasal : undefined;
      graph.articles.set(item.headword, {
        parts: new Set(Object.keys(parts)),
        alternatives: new Set(strings(article.alternatives)),
        ...(typeof base === 'string' && base && { base }),
      });
      for (const raw of Object.values(parts))
        for (const [, form] of collection(object(raw).forms)) {
          const spelling = String(form.word);
          // Match the first form in the plan's stable headword order, as before.
          if (!graph.forms.has(spelling)) graph.forms.set(spelling, new Set(strings(form.alternatives ?? [])));
        }
    }
    return graph;
  }

  isDeleted(headword: string): boolean {
    return this.deleted.has(headword);
  }

  problems(item: ResultT): string[] {
    if (!item.result.present) return [];
    const article = object(item.result.value);
    const problems = new Set<string>();
    const requireTarget = (target: string, part?: string, reciprocal?: string) => {
      const entry = this.articles.get(target);
      if (entry) {
        if (part && !entry.parts.has(part)) problems.add(target);
        if (reciprocal && !entry.alternatives.has(reciprocal)) problems.add(target);
        return;
      }
      const form = !part ? this.forms.get(target) : undefined;
      if (form) {
        if (reciprocal && !form.has(reciprocal)) problems.add(target);
        return;
      }
      problems.add(target);
    };
    for (const target of strings(article.alternatives)) {
      if (target === item.headword) problems.add(target);
      else requireTarget(target, undefined, item.headword);
    }
    for (const raw of Object.values(object(article.parts))) {
      const word = object(raw);
      const base = object(word.common).base_phrasal;
      if (base) {
        if (base === item.headword) problems.add(String(base));
        else {
          requireTarget(String(base), EnPartOfSpeechE.verb);
          const seen = new Set([item.headword]);
          let next: string | undefined = String(base);
          while (next) {
            if (seen.has(next)) {
              problems.add(next);
              break;
            }
            seen.add(next);
            next = this.articles.get(next)?.base;
          }
        }
      }
      for (const [, form] of collection(word.forms))
        for (const target of strings(form.alternatives ?? [])) {
          if (target === form.word) problems.add(target);
          else requireTarget(target, undefined, String(form.word));
        }
      for (const [, meaning] of collection(word.meanings))
        for (const target of [...strings(meaning.synonyms), ...strings(meaning.antonyms)]) {
          if (target === item.headword) problems.add(target);
          else requireTarget(target);
        }
    }
    return [...problems];
  }
}
