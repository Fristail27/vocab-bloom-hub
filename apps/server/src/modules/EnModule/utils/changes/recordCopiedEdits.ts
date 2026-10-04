import { EntityManager } from 'typeorm';
import {
  ChangeActionE,
  ChangeEntityE,
  ChangeRecordT,
  CustomVersionDictionaryOfWord,
} from '../../../../../types';
import { EnWord } from '../../entities/en_word.entity';
import { wordKeyOf, recordChange } from './recordChange';
import {
  changedFields,
  createdFields,
  deletedFields,
  formRecord,
  formSnapshot,
  meaningRecord,
  meaningSnapshot,
  shortTranslationRecord,
  shortTranslationSnapshot,
  SnapshotT,
  translationRecord,
  translationSnapshot,
  wordSnapshot,
} from './snapshots';

/** Edits made in the prefill form are ordinary field edits, with ordinary reverts. */
export const recordCopiedEdits = async (em: EntityManager, original: EnWord, saved: EnWord): Promise<void> => {
  const word = wordKeyOf(saved);
  let edited = false;
  const record = async (
    entity: ChangeEntityE,
    key: ChangeRecordT | null,
    before?: SnapshotT,
    after?: SnapshotT,
  ) => {
    const diff =
      before && after ? changedFields(before, after) : before ? deletedFields(before) : createdFields(after!);
    if (!diff) return;
    edited = true;
    await recordChange(em, {
      ...word,
      entity,
      record: key,
      diff,
      action: before && after ? ChangeActionE.update : before ? ChangeActionE.delete : ChangeActionE.create,
    });
  };
  // The automatic acquisition is provenance, not a content edit.
  const before = wordSnapshot(original);
  const after = wordSnapshot(saved);
  before.origins = (saved.origins ?? []).filter((origin) => origin.inherited);
  after.origins = saved.origins ?? [];
  await record(ChangeEntityE.word, null, before, after);

  async function collection<T>(
    oldRows: T[],
    newRows: T[],
    key: (row: T) => string,
    fallback: (row: T) => string,
    visit: (before: T | undefined, after: T | undefined) => Promise<void>,
  ) {
    const remaining = new Set(newRows);
    for (const row of oldRows) {
      let match = [...remaining].find((next) => key(next) === key(row));
      if (!match) {
        const candidates = [...remaining].filter((next) => fallback(next) === fallback(row));
        if (candidates.length === 1 && oldRows.filter((old) => fallback(old) === fallback(row)).length === 1)
          match = candidates[0];
      }
      if (match) remaining.delete(match);
      await visit(row, match);
    }
    for (const row of remaining) await visit(undefined, row);
  }
  await collection(
    original.forms ?? [],
    saved.forms ?? [],
    (row) => `${row.form_of_word}:${row.word.word}`,
    (row) => row.form_of_word,
    (old, next) =>
      record(
        ChangeEntityE.word_form,
        formRecord(old ?? next!),
        old ? formSnapshot(old) : undefined,
        next ? formSnapshot(next) : undefined,
      ),
  );
  await collection(
    original.short_translations ?? [],
    saved.short_translations ?? [],
    (row) => `${row.language}:${row.description}`,
    (row) => row.language,
    (old, next) =>
      record(
        ChangeEntityE.short_translation,
        shortTranslationRecord(old ?? next!),
        old ? shortTranslationSnapshot(old) : undefined,
        next ? shortTranslationSnapshot(next) : undefined,
      ),
  );
  await collection(
    original.meanings ?? [],
    saved.meanings ?? [],
    (row) => `${row.sort_order}:${row.title}`,
    (row) => String(row.sort_order),
    async (old, next) => {
      await record(
        ChangeEntityE.meaning,
        meaningRecord(old ?? next!),
        old ? meaningSnapshot(old, !next) : undefined,
        next ? meaningSnapshot(next, !old) : undefined,
      );
      if (!old || !next) return;
      await collection(
        old.translations ?? [],
        next.translations ?? [],
        (row) => `${row.language}:${row.title}`,
        (row) => row.language,
        (a, b) =>
          record(
            ChangeEntityE.meaning_translation,
            translationRecord(a ?? b!, next),
            a ? translationSnapshot(a) : undefined,
            b ? translationSnapshot(b) : undefined,
          ),
      );
    },
  );
  if (edited) {
    await em.getRepository(EnWord).update(saved.id, { version: CustomVersionDictionaryOfWord });
    await recordChange(em, {
      ...word,
      entity: ChangeEntityE.word,
      action: ChangeActionE.update,
      diff: changedFields({ version: original.version }, { version: CustomVersionDictionaryOfWord }),
    });
  }
};
