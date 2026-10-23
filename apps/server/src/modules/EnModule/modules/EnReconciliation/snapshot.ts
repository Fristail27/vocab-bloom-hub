import { randomUUID } from 'node:crypto';
import { EntityManager, EntityTarget, In, MoreThan, ObjectLiteral } from 'typeorm';
import { EnWordFormsE } from '../../../../../types';
import type { ReconciliationValueT } from '../../../../../types/reconciliation';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnChange } from '../../entities/en_change.entity';
import { EnWord } from '../../entities/en_word.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import { EnEtymology } from '../../entities/en_etymology.entity';
import { EnPronunciation } from '../../entities/en_pronunciation.entity';
import { EnPronunciationAudio } from '../../entities/en_pronunciation_audio.entity';
import { WORD_CHANGE_RELATIONS } from '../../utils/changes/words';
import {
  canonical,
  formSnapshot,
  meaningSnapshot,
  shortTranslationSnapshot,
  translationSnapshot,
  wordSnapshot,
} from '../../utils/changes/snapshots';
import type { SnapshotRecordT } from './store';
import { datasetOrigin, defaultOrigins } from '../../../../../core/utils/provenance';
import { Dataset } from '../../../DatasetsModule/entities/dataset.entity';
import { contentHash } from './compare';
import { ReconciliationIdentity } from './entities';
import { WordRowsService } from '../../word-rows.service';
import { RECONCILIATION_BATCH_SIZE } from './batches';

type IdentifiedT = ObjectLiteral & { id: number; sync_id?: string | null };
type ObjectT = { [key: string]: ReconciliationValueT };

/** Snapshots are JSON, independent of database IDs and engine-specific array/JSON storage. */
const json = (value: unknown): ObjectT => JSON.parse(JSON.stringify(canonical(value))) as ObjectT;

/** Recreating a registry name never recreates the same parent identity. */
export const datasetLineage = (dataset: Dataset): string =>
  contentHash({
    id: dataset.id,
    created_at: new Date(dataset.createdAt).toISOString(),
    name: dataset.name,
  });

export async function persistentLineage(em: EntityManager, dataset: Dataset): Promise<string> {
  const existing = await em.findOneBy(ReconciliationIdentity, { key: 'self' });
  if (existing) return existing.lineage;
  const lineage = datasetLineage(dataset);
  await em
    .createQueryBuilder()
    .insert()
    .into(ReconciliationIdentity)
    .values({ key: 'self', lineage })
    .orIgnore()
    .execute();
  return (await em.findOneByOrFail(ReconciliationIdentity, { key: 'self' })).lineage;
}

export const datasetSnapshotMetadata = (dataset: Dataset): ObjectT => ({
  source: dataset.name,
  terms: json(datasetOrigin(dataset)),
});

const identify = async <T extends IdentifiedT>(
  em: EntityManager,
  entity: EntityTarget<T>,
  row: T,
): Promise<string> => {
  if (row.sync_id) return row.sync_id;
  const id = randomUUID();
  const metadata = em.connection.getMetadata(entity);
  // Do not bump updateAt: assigning synchronization identity changes no dictionary content.
  const quote = (value: string) => em.connection.driver.escape(value);
  const parameter = (index: number) => em.connection.driver.createParameter('id', index);
  await em.query(
    `UPDATE ${quote(metadata.tableName)} SET "sync_id" = ${parameter(0)} WHERE "id" = ${parameter(1)} AND "sync_id" IS NULL`,
    [id, row.id],
  );
  const stored = await em.getRepository(entity).findOneByOrFail({ id: row.id } as never);
  row.sync_id = stored.sync_id;
  if (!row.sync_id) throw new Error('reconciliation_identity_missing');
  return row.sync_id;
};

const keyed = async <T extends IdentifiedT>(
  em: EntityManager,
  entity: EntityTarget<T>,
  rows: T[] | undefined,
  project: (row: T) => ObjectT | Promise<ObjectT>,
): Promise<ObjectT> => {
  const result: ObjectT = Object.create(null);
  for (const row of rows ?? []) {
    const id = await identify(em, entity, row);
    if (Object.hasOwn(result, id)) throw new Error('reconciliation_identity_duplicate');
    result[id] = await project(row);
  }
  return result;
};

/** Assign legacy nested IDs in batches, without changing content timestamps. */
export async function identifyRows<T extends IdentifiedT>(
  em: EntityManager,
  entity: EntityTarget<T>,
  rows: T[],
) {
  const missing = rows.filter((row) => !row.sync_id);
  const quote = (value: string) => em.connection.driver.escape(value);
  const table = quote(em.connection.getMetadata(entity).tableName);
  for (let offset = 0; offset < missing.length; offset += RECONCILIATION_BATCH_SIZE) {
    const page = missing.slice(offset, offset + RECONCILIATION_BATCH_SIZE);
    const parameters: (string | number)[] = [];
    const bind = (value: string | number) => {
      const placeholder = em.connection.driver.createParameter('value', parameters.length);
      parameters.push(value);
      return placeholder;
    };
    const cases = page.map((row) => `WHEN ${bind(row.id)} THEN ${bind(randomUUID())}`);
    const ids = page.map((row) => bind(row.id));
    await em.query(
      `UPDATE ${table} SET "sync_id" = CASE "id" ${cases.join(' ')} END WHERE "id" IN (${ids.join(', ')}) AND "sync_id" IS NULL`,
      parameters,
    );
    // Read the persisted IDs: a concurrent initializer may have assigned them first.
    const stored = await em.getRepository(entity).find({
      select: { id: true, sync_id: true } as never,
      where: { id: In(page.map((row) => row.id)) } as never,
    });
    const byId = new Map(stored.map((row) => [row.id, row.sync_id]));
    for (const row of page) {
      row.sync_id = byId.get(row.id);
      if (!row.sync_id) throw new Error('reconciliation_identity_missing');
    }
  }
}

async function identifyWords(em: EntityManager, words: EnWord[]) {
  const forms = words.flatMap((word) => word.forms ?? []);
  const meanings = words.flatMap((word) => word.meanings ?? []);
  const pronunciations = [...words, ...forms].flatMap((word) => word.pronunciations ?? []);
  await identifyRows(em, EnWord, forms);
  await identifyRows(em, EnMeaning, meanings);
  await identifyRows(
    em,
    EnMeaningTranslation,
    meanings.flatMap((row) => row.translations ?? []),
  );
  await identifyRows(
    em,
    EnShortTranslation,
    words.flatMap((row) => row.short_translations ?? []),
  );
  await identifyRows(
    em,
    EnEtymology,
    words.flatMap((row) => row.etymologies ?? []),
  );
  await identifyRows(em, EnPronunciation, pronunciations);
  await identifyRows(
    em,
    EnPronunciationAudio,
    pronunciations.flatMap((row) => row.audio ?? []),
  );
}

const pronunciations = (em: EntityManager, rows: EnPronunciation[] | undefined): Promise<ObjectT> =>
  keyed(em, EnPronunciation, rows, async (row) => ({
    type: row.type,
    text: row.text,
    area_variant: row.area_variant,
    sort_order: row.sort_order,
    audio: await keyed(em, EnPronunciationAudio, row.audio, (audio) => ({
      url: audio.url,
      source_url: audio.source_url,
      attribution: audio.attribution,
      licenses: json({ values: audio.licenses }).values,
      sort_order: audio.sort_order,
    })),
  }));

export const wordDocument = async (em: EntityManager, word: EnWord): Promise<ObjectT> => {
  const common = json(wordSnapshot(word));
  // Collections have their own durable identities below, never array-position identities.
  delete common.etymologies;
  delete common.pronunciations;
  return {
    common,
    pronunciations: await pronunciations(em, word.pronunciations),
    etymologies: await keyed(em, EnEtymology, word.etymologies, (row) => ({
      number: row.number,
      text: row.text,
    })),
    forms: await keyed(em, EnWord, word.forms, async (row) => {
      const values = json(formSnapshot(row));
      delete values.pronunciations;
      return { ...values, pronunciations: await pronunciations(em, row.pronunciations) };
    }),
    meanings: await keyed(em, EnMeaning, word.meanings, async (row) => ({
      ...json(meaningSnapshot(row)),
      translations: await keyed(em, EnMeaningTranslation, row.translations, (translation) =>
        json(translationSnapshot(translation)),
      ),
    })),
    short_translations: await keyed(em, EnShortTranslation, word.short_translations, (row) =>
      json(shortTranslationSnapshot(row)),
    ),
  };
};

/** Caller supplies a consistent transaction (and locks writes when preparing to apply). */
export async function* dictionaryRecords(
  em: EntityManager,
  dataset?: Dataset,
): AsyncGenerator<SnapshotRecordT> {
  let cursor: string | undefined;
  for (;;) {
    const entries = await em.find(EnEntry, {
      where: cursor === undefined ? {} : { word: MoreThan(cursor) },
      order: { word: 'ASC' },
      take: 100,
      relations: { alternatives: true },
    });
    if (!entries.length) break;
    const headwords = entries.map((entry) => entry.word);
    const ids = await em
      .createQueryBuilder(EnWord, 'word')
      .select('word.id', 'id')
      .where('word.word IN (:...headwords) AND word.form_of_word = :form', {
        headwords,
        form: EnWordFormsE.base_form,
      })
      .andWhere('word.baseFormId IS NULL')
      .orderBy('word.id', 'ASC')
      .getRawMany<{ id: number }>();
    const loaded = await WordRowsService.on(em).load(
      ids.map((row) => row.id),
      WORD_CHANGE_RELATIONS,
    );
    await identifyWords(em, loaded);
    const byHeadword = new Map<string, EnWord[]>();
    for (const word of loaded) {
      const group = byHeadword.get(word.word.word) ?? [];
      group.push(word);
      byHeadword.set(word.word.word, group);
    }
    const histories = await historiesOf(em, headwords);
    for (const entry of entries) {
      const words = byHeadword.get(entry.word) ?? [];
      if (!words.length) continue; // A spelling used only by inflections is not another article.
      const parts: ObjectT = Object.create(null);
      for (const word of words) {
        if (Object.hasOwn(parts, word.part_of_speech))
          throw new Error('reconciliation_ambiguous_part_of_speech');
        const document = await wordDocument(em, word);
        if (dataset && (document.common as ObjectT).origins === null)
          (document.common as ObjectT).origins = json({ values: defaultOrigins(dataset) }).values;
        parts[word.part_of_speech] = document;
      }
      yield {
        headword: entry.word,
        content: { alternatives: (entry.alternatives ?? []).map((row) => row.word).sort(), parts },
        history: histories.get(entry.word) ?? [],
        versions: Object.fromEntries(words.map((word) => [word.part_of_speech, word.version])),
      };
    }
    cursor = entries[entries.length - 1].word;
  }
  // Histories survive deletion of the last content row. Null is an explicit tombstone.
  let deletedCursor: string | undefined;
  for (;;) {
    const query = em
      .createQueryBuilder(EnChange, 'change')
      .select('change.headword', 'headword')
      .distinct(true)
      .where(
        'NOT EXISTS (SELECT 1 FROM en_words w WHERE w.word = change.headword AND w."baseFormId" IS NULL AND w.form_of_word = :base)',
        { base: EnWordFormsE.base_form },
      );
    if (deletedCursor !== undefined) query.andWhere('change.headword > :cursor', { cursor: deletedCursor });
    const deleted = await query.orderBy('change.headword', 'ASC').limit(100).getRawMany<{ headword: string }>();
    if (!deleted.length) break;
    const histories = await historiesOf(
      em,
      deleted.map((row) => row.headword),
    );
    for (const row of deleted)
      yield { headword: row.headword, content: null, history: histories.get(row.headword) ?? [] };
    deletedCursor = deleted[deleted.length - 1].headword;
  }
}

async function historiesOf(em: EntityManager, headwords: string[]) {
  const histories = new Map<string, NonNullable<SnapshotRecordT['history']>>();
  for (const row of await em.find(EnChange, { where: { headword: In(headwords) }, order: { id: 'ASC' } })) {
    const history = histories.get(row.headword) ?? [];
    history.push({
      created_at: row.created_at.toISOString(),
      headword: row.headword,
      part_of_speech: row.part_of_speech,
      entity: row.entity,
      action: row.action,
      origin: row.origin,
      record: row.record,
      diff: row.diff,
      inherited_from: row.inherited_from,
      contribution: row.contribution,
      reason: row.reason,
      operation: row.operation ?? null,
      author: row.author,
      superseded_at: row.superseded_at?.toISOString() ?? null,
    });
    histories.set(row.headword, history);
  }
  return histories;
}

/** A source lacking stable identities can only match an unchanged record unambiguously. */
export const alignUnchangedRecords = (baseline: ObjectT, incoming: ObjectT): ObjectT => {
  const result: ObjectT = Object.create(null);
  const used = new Set<string>();
  for (const [id, value] of Object.entries(incoming)) {
    if (Object.hasOwn(baseline, id)) {
      result[id] = value;
      used.add(id);
    }
  }
  for (const [id, value] of Object.entries(incoming)) {
    if (Object.hasOwn(result, id)) continue;
    const encoded = JSON.stringify(canonical(value));
    const candidates = Object.keys(baseline).filter(
      (key) => !used.has(key) && JSON.stringify(canonical(baseline[key])) === encoded,
    );
    const sameIncoming = Object.values(incoming).filter(
      (candidate) => JSON.stringify(canonical(candidate)) === encoded,
    );
    const key = candidates.length === 1 && sameIncoming.length === 1 ? candidates[0] : id;
    result[key] = value;
    used.add(key);
  }
  return result;
};

/** Remove opaque collection keys only for exact-content matching, never to merge differing records. */
const unkeyed = (value: ReconciliationValueT): ReconciliationValueT => {
  if (Array.isArray(value)) return value.map(unkeyed);
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value);
  if (keys.length && keys.every((key) => /^[\da-f]{8}-[\da-f-]{27}$/i.test(key))) {
    return Object.values(value)
      .map(unkeyed)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unkeyed(child)]));
};

export function alignDocument(
  baseline: ReconciliationValueT,
  incoming: ReconciliationValueT,
): ReconciliationValueT {
  if (
    !baseline ||
    !incoming ||
    typeof baseline !== 'object' ||
    typeof incoming !== 'object' ||
    Array.isArray(baseline) ||
    Array.isArray(incoming)
  )
    return incoming;
  const result: ObjectT = Object.create(null);
  const isCollection = Object.keys(incoming).some((key) => /^[\da-f]{8}-[\da-f-]{27}$/i.test(key));
  const used = new Set(Object.keys(incoming).filter((key) => Object.hasOwn(baseline, key)));
  for (const [key, value] of Object.entries(incoming)) {
    let matched = key;
    if (isCollection && !Object.hasOwn(baseline, key)) {
      const fingerprint = contentHash(unkeyed(value));
      const candidates = Object.keys(baseline).filter(
        (key) => !used.has(key) && contentHash(unkeyed(baseline[key])) === fingerprint,
      );
      if (
        candidates.length === 1 &&
        Object.values(incoming).filter((value) => contentHash(unkeyed(value)) === fingerprint).length === 1
      )
        matched = candidates[0];
    }
    used.add(matched);
    result[matched] = Object.hasOwn(baseline, matched) ? alignDocument(baseline[matched], value) : value;
  }
  return result;
}
