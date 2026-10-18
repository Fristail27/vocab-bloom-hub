import { EntityManager } from 'typeorm';
import { EnWord } from '../../entities/en_word.entity';
import { EnChange } from '../../entities/en_change.entity';
import {
  ChangeActionE,
  ChangeEntityE,
  ChangeOriginE,
  ChangeOperationT,
  CustomVersionDictionaryOfWord,
  EnWordFormsE,
} from '../../../../../types';
import { withChangeSource } from '../../utils/changes/context';
import { recordChange } from '../../utils/changes/recordChange';
import { ReconciliationPlan, ReconciliationRecord, ReconciliationItem } from './entities';
import { ReconciliationStore } from './store';
import { batches } from './batches';
import { object } from './document';
import { present } from './compare';
import { equalDocumentSides } from './content';
import { applicationStage, ReconciliationApplicationSinkT } from './progress';

/** Persist frozen defaults only where needed, without touching dictionary timestamps. */
export async function freezeOrigins(
  em: EntityManager,
  plan: ReconciliationPlan,
  progress?: ReconciliationApplicationSinkT,
) {
  const store = new ReconciliationStore(em);
  const advance = applicationStage(progress, 'origins');
  const total = await em
    .createQueryBuilder(ReconciliationRecord, 'record')
    .where('record.revision = :revision', { revision: plan.local })
    .getCount();
  let processed = 0;
  advance?.(processed, total);
  for await (const page of batches(store.records(plan.local))) {
    const records = new Map(page.map((row) => [row.headword, row]));
    const missing = await em
      .createQueryBuilder(EnWord, 'word')
      .select('word.id', 'id')
      .addSelect('word.word', 'headword')
      .addSelect('word.part_of_speech', 'part')
      .where('word.word IN (:...headwords)', { headwords: page.map((row) => row.headword) })
      .andWhere('word.baseFormId IS NULL AND word.origins IS NULL')
      .getRawMany<{ id: number; headword: string; part: string }>();
    // A headword can have several parts of speech; keep SQL batches bounded too.
    for (let i = 0; i < missing.length; i += 100) {
      const parameters: (string | number)[] = [];
      const ids: number[] = [];
      const bind = (value: string | number) => {
        const parameter = em.connection.driver.createParameter('value', parameters.length);
        parameters.push(value);
        return parameter;
      };
      const cases: string[] = [];
      for (const row of missing.slice(i, i + 100)) {
        const content = records.get(row.headword)?.content;
        if (content == null) continue;
        const raw = object(object(content).parts)[row.part];
        if (!raw) continue;
        cases.push(`WHEN ${bind(row.id)} THEN ${bind(JSON.stringify(object(object(raw).common).origins))}`);
        ids.push(row.id);
      }
      if (ids.length)
        await em.query(
          `UPDATE "en_words" SET "origins" = CASE "id" ${cases.join(' ')} END WHERE "id" IN (${ids.map(bind).join(', ')}) AND "origins" IS NULL`,
          parameters,
        );
    }
    processed += page.length;
    advance?.(processed, total);
  }
}

/** Read only versions and active-history keys for unchanged words, never hydrate their full graph. */
export async function publishVersions(
  em: EntityManager,
  plan: ReconciliationPlan,
  operation: ChangeOperationT,
  progress?: ReconciliationApplicationSinkT,
) {
  const store = new ReconciliationStore(em);
  const advance = applicationStage(progress, 'versions');
  const total = await em.countBy(ReconciliationItem, { plan: plan.id });
  let processed = 0;
  advance?.(processed, total);
  for await (const page of batches(store.items(plan.id))) {
    const headwords = page.map((item) => item.headword);
    const incoming = new Map(
      (await store.recordsFor([plan.incoming], headwords)).map((row) => [row.headword, row]),
    );
    const words = await em
      .createQueryBuilder(EnWord, 'word')
      .select('word.id', 'id')
      .addSelect('word.word', 'headword')
      .addSelect('word.part_of_speech', 'part')
      .addSelect('word.version', 'version')
      .where('word.word IN (:...headwords)', { headwords })
      .andWhere('word.baseFormId IS NULL AND word.form_of_word = :base', { base: EnWordFormsE.base_form })
      .getRawMany<{ id: number; headword: string; part: string; version: string }>();
    const edits = await em
      .createQueryBuilder(EnChange, 'change')
      .select('change.headword', 'headword')
      .addSelect('change.part_of_speech', 'part')
      .distinct(true)
      .where('change.headword IN (:...headwords) AND change.superseded_at IS NULL', { headwords })
      .getRawMany<{ headword: string; part: string | null }>();
    const key = (headword: string, part: string | null) => JSON.stringify([headword, part]);
    const active = new Set(edits.map((row) => key(row.headword, row.part)));
    const byWord = new Map(words.map((row) => [key(row.headword, row.part), row]));
    for (const item of page) {
      const record = incoming.get(item.headword);
      if (item.result.present && (record || item.effect !== null)) {
        for (const [part, raw] of Object.entries(object(object(item.result.value).parts))) {
          const source = record?.content ? object(object(record.content).parts)[part] : undefined;
          const word = byWord.get(key(item.headword, part));
          if (!word) continue;
          const version =
            active.has(key(item.headword, part)) || active.has(key(item.headword, null))
              ? CustomVersionDictionaryOfWord
              : source &&
                  equalDocumentSides(present(raw), present(source), ['parts', part]) &&
                  record?.versions[part]
                ? record.versions[part]
                : word.version;
          if (version === word.version) continue;
          await em.update(EnWord, word.id, { version });
          await withChangeSource(
            { origin: ChangeOriginE.admin, operation, contribution: null, superseded: true },
            () =>
              recordChange(em, {
                headword: item.headword,
                part_of_speech: part,
                entity: ChangeEntityE.word,
                action: ChangeActionE.update,
                diff: { version: { before: word.version, after: version } },
              }),
          );
        }
      }
      advance?.(++processed, total);
    }
  }
}
