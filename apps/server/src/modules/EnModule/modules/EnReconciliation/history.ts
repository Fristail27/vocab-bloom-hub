import { contentHash } from './compare';
import { assertCompatibleOrigins, assertOrigins } from '../../../../core/utils/provenance';
import { EntityManager } from 'typeorm';
import { ChangeActionE, ChangeEntityE, ChangeOriginE, OriginT, ChangeOperationT } from '../../../../../types';
import type { DataSetChangeT } from '../../../../../types/dictionaries/en/EnDataSetTypes';
import { EnChange } from '../../entities/en_change.entity';
import { EnWord } from '../../entities/en_word.entity';
import { findWord } from '../../utils/changes/words';
import {
  canonical,
  formSnapshot,
  fullWordSnapshot,
  meaningSnapshot,
  shortTranslationSnapshot,
  translationSnapshot,
  saysTheSame,
} from '../../utils/changes/snapshots';
import { ReconciliationRecord } from './entities';

const identity = (
  row:
    | Pick<EnChange, 'headword' | 'part_of_speech' | 'entity' | 'action' | 'created_at' | 'diff'>
    | DataSetChangeT,
) =>
  JSON.stringify(
    canonical([
      row.headword,
      row.part_of_speech,
      row.entity,
      row.action,
      new Date(row.created_at).toISOString(),
      row.diff,
    ]),
  );

/** Whether an inherited edit still contributes content to the resulting entry. */
const applies = (change: DataSetChangeT, word: EnWord | null): boolean => {
  if (!word || change.superseded_at) return false;
  const record = change.record as Record<string, unknown> | null;
  let snapshot: Record<string, unknown> | undefined;
  const after = (field: string, fallback: unknown) => change.diff[field]?.after ?? fallback;
  if (change.entity === ChangeEntityE.word) snapshot = fullWordSnapshot(word);
  if (change.entity === ChangeEntityE.meaning) {
    const row = word.meanings.find(
      (row) =>
        row.title === after('title', record?.title) &&
        row.sort_order === after('sort_order', record?.sort_order),
    );
    if (row) snapshot = meaningSnapshot(row, true);
  }
  if (change.entity === ChangeEntityE.word_form) {
    const row = word.forms.find(
      (row) =>
        row.word.word === after('word', record?.word) &&
        row.form_of_word === after('form_of_word', record?.form_of_word),
    );
    if (row) snapshot = formSnapshot(row);
  }
  if (change.entity === ChangeEntityE.short_translation) {
    const row = word.short_translations.find(
      (row) =>
        row.language === after('language', record?.language) &&
        row.description === after('description', record?.description),
    );
    if (row) snapshot = shortTranslationSnapshot(row);
  }
  if (change.entity === ChangeEntityE.meaning_translation) {
    const meaning = record?.meaning as { title?: string; sort_order?: number } | undefined;
    const row = word.meanings
      .find((row) => row.title === meaning?.title && row.sort_order === meaning.sort_order)
      ?.translations.find(
        (row) =>
          row.language === after('language', record?.language) && row.title === after('title', record?.title),
      );
    if (row) snapshot = translationSnapshot(row);
  }
  if (!snapshot) return false;
  return Object.entries(change.diff).some(
    ([key, value]) =>
      !['version', 'origins'].includes(key) &&
      !saysTheSame(value.before, value.after, key) &&
      saysTheSame(snapshot![key], value.after, key),
  );
};

/** Retain the source's full history, including edits whose content was not accepted. */
export async function inheritHistory(
  em: EntityManager,
  record: ReconciliationRecord,
  origin: OriginT,
  operation: ChangeOperationT,
  license: string,
): Promise<void> {
  if (!record.history.length) return;
  const existing = new Map(
    (await em.find(EnChange, { where: { headword: record.headword } })).map((row) => [identity(row), row]),
  );
  for (const line of record.history) {
    const key = identity(line);
    const previous = existing.get(key);
    const word = line.part_of_speech ? await findWord(em, line.headword, line.part_of_speech) : null;
    const applicable = applies(line, word);
    if (line.contribution) {
      assertOrigins([line.contribution]);
      if (applicable) assertCompatibleOrigins([line.contribution], license);
    }
    if (previous) {
      // An earlier declined incoming edit may now be selected. Its original terms
      // must pass compatibility again; a local privacy redaction remains intact.
      if (applicable && previous.contribution) assertCompatibleOrigins([previous.contribution], license);
      if (applicable && previous.superseded_at) await em.update(EnChange, previous.id, { superseded_at: null });
      continue;
    }
    const saved = await em.save(EnChange, {
      headword: line.headword,
      part_of_speech: line.part_of_speech,
      created_at: new Date(line.created_at),
      entity: line.entity as ChangeEntityE,
      action: line.action as ChangeActionE,
      origin: line.origin as ChangeOriginE,
      record: line.record as EnChange['record'],
      diff: line.diff,
      author: line.author,
      contribution: line.contribution ?? null,
      inherited_from: line.inherited_from ?? origin,
      operation: {
        ...operation,
        ...(line.operation && {
          upstream_operation: line.operation.upstream_operation ?? {
            id: line.operation.id,
            kind: line.operation.kind,
            source: line.operation.source,
            revision: line.operation.revision,
          },
        }),
      },
      reason: line.reason ?? null,
      superseded_at: line.superseded_at
        ? new Date(line.superseded_at)
        : applies(line, word)
          ? null
          : new Date(),
    });
    existing.set(key, saved);
  }
}

/** Edits whose accepted values were replaced remain in the journal but stop contributing terms. */
export async function retireReplacedHistory(
  em: EntityManager,
  headword: string,
  operation: string,
): Promise<void> {
  const rows = await em.find(EnChange, { where: { headword } });
  for (const row of rows) {
    if (row.superseded_at || row.operation?.id === operation || !row.part_of_speech) continue;
    const word = await findWord(em, headword, row.part_of_speech);
    const line: DataSetChangeT = { ...row, created_at: row.created_at.toISOString(), superseded_at: null };
    if (!applies(line, word)) await em.update(EnChange, row.id, { superseded_at: new Date() });
  }
}

/** Privacy redaction is the sole mutation of historical snapshot metadata, never its content. */
export async function redactSnapshotAuthor(em: EntityManager, author: string): Promise<void> {
  if (!em.connection.hasMetadata(ReconciliationRecord)) return;
  let cursor: { revision: string; headword: string } | undefined;
  for (;;) {
    const query = em
      .createQueryBuilder(ReconciliationRecord, 'record')
      .orderBy('record.revision', 'ASC')
      .addOrderBy('record.headword', 'ASC')
      .take(100);
    if (cursor)
      query.where(
        'record.revision > :revision OR (record.revision = :revision AND record.headword > :headword)',
        cursor,
      );
    const rows = await query.getMany();
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.history.some((line) => line.author === author)) continue;
      const history = row.history.map((line) => (line.author === author ? { ...line, author: null } : line));
      const hash = contentHash(
        JSON.parse(JSON.stringify({ content: row.content, history, versions: row.versions })),
      );
      await em
        .createQueryBuilder()
        .update('reconciliation_records')
        .set({ history, hash })
        .where('revision = :revision AND headword = :headword', {
          revision: row.revision,
          headword: row.headword,
        })
        .execute();
    }
    const last = rows[rows.length - 1];
    cursor = { revision: last.revision, headword: last.headword };
  }
}
