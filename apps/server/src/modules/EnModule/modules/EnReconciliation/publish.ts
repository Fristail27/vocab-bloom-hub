import { EnEntry } from '../../entities/en_entry.entity';
import { resolutionRecorder } from './resolution-history';
import { EnChange } from '../../entities/en_change.entity';
import { EntityManager, Not, IsNull } from 'typeorm';
import {
  ChangeActionE,
  ChangeEntityE,
  ChangeOriginE,
  EnPartOfSpeechE,
  EnWordFormsE,
} from '../../../../../types';
import { EnWord } from '../../entities/en_word.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import { EnEtymology } from '../../entities/en_etymology.entity';
import { EnPronunciation } from '../../entities/en_pronunciation.entity';
import { EnPronunciationAudio } from '../../entities/en_pronunciation_audio.entity';
import { entryTypeOf, findWord, getOrAddEntry, dropEntryIfUnused } from '../../utils/changes/words';
import { fullWordSnapshot, createdFields, deletedFields } from '../../utils/changes/snapshots';
import { recordChange } from '../../utils/changes/recordChange';
import { recordCopiedEdits } from '../../utils/changes/recordCopiedEdits';
import { withChangeSource } from '../../utils/changes/context';
import { replaceAlternatives } from '../../utils/entryAlternatives';
import { ReconciliationItem, ReconciliationPlan, ReconciliationRecord } from './entities';
import { ReconciliationStore } from './store';
import { equalContentSides, equalSides, missing, present } from './compare';
import { collection, CONTENT_FIELDS, DocumentObjectT, fields, object, strings } from './document';
import { inheritHistory, retireReplacedHistory } from './history';
import type { OriginT } from '../../../../../types';
import { applicationStage, ReconciliationApplicationSinkT } from './progress';
import { freezeOrigins, publishVersions } from './publication-metadata';

async function writePronunciations(em: EntityManager, word: EnWord, document: DocumentObjectT): Promise<void> {
  await em.delete(EnPronunciation, { word: { id: word.id } });
  for (const [sync_id, row] of collection(document.pronunciations)) {
    const pronunciation = await em.save(EnPronunciation, {
      ...fields(row, CONTENT_FIELDS.pronunciation),
      sync_id,
      word,
    });
    for (const [audioId, audio] of collection(row.audio))
      await em.save(EnPronunciationAudio, {
        ...fields(audio, CONTENT_FIELDS.audio),
        sync_id: audioId,
        pronunciation,
      });
  }
}

async function writeWord(
  em: EntityManager,
  headword: string,
  part: string,
  document: DocumentObjectT,
  receiving: boolean,
): Promise<void> {
  const word = (await findWord(em, headword, part))!;
  const common = object(document.common);
  const values = fields(common, CONTENT_FIELDS.word);
  if (Array.isArray(common.origins)) {
    const previous = word.origins ?? [];
    // Keep one complete validated source snapshot, never mix bookkeeping from
    // different snapshots (their origin or acquisition IDs may overlap).
    if (
      equalContentSides(present(JSON.parse(JSON.stringify(previous))), present(common.origins), [
        'parts',
        part,
        'common',
        'origins',
      ])
    ) {
      values.origins = previous;
    } else if (receiving) {
      values.origins = common.origins.map((origin) => {
        const existing = previous.some((local) =>
          equalSides(present(JSON.parse(JSON.stringify(local))), present(origin)),
        );
        return existing ? origin : { ...object(origin), inherited: true };
      });
    }
  }
  await em.update(EnWord, { id: word.id }, values);
  // The base row survives: references from other phrasal verbs keep their target ID.
  for (const form of word.forms ?? []) await em.delete(EnWord, { id: form.id });
  for (const [sync_id, form] of collection(document.forms)) {
    const spelling = String(form.word);
    const row = await em.save(EnWord, {
      ...fields(form, CONTENT_FIELDS.form),
      sync_id,
      word: await getOrAddEntry(em, spelling, entryTypeOf(part)),
      part_of_speech: part as EnPartOfSpeechE,
      base_form: word,
      generated: false,
    });
    await writePronunciations(em, row, form);
  }
  await writePronunciations(em, word, document);
  await em.delete(EnMeaning, { word: { id: word.id } });
  await em.delete(EnEtymology, { word: { id: word.id } });
  const etymologies = new Map<number, EnEtymology>();
  for (const [sync_id, row] of collection(document.etymologies)) {
    const saved = await em.save(EnEtymology, { ...fields(row, CONTENT_FIELDS.etymology), sync_id, word });
    etymologies.set(saved.number, saved);
  }
  for (const [sync_id, row] of collection(document.meanings)) {
    const meaning = await em.save(EnMeaning, {
      ...fields(row, CONTENT_FIELDS.meaning),
      sync_id,
      word,
      etymology: row.etymology_number == null ? null : etymologies.get(Number(row.etymology_number)),
      synonyms: strings(row.synonyms).map((word) => ({ word })),
      antonyms: strings(row.antonyms).map((word) => ({ word })),
    });
    for (const [translationId, translation] of collection(row.translations))
      await em.save(EnMeaningTranslation, {
        ...fields(translation, CONTENT_FIELDS.translation),
        sync_id: translationId,
        meaning,
      });
  }
  await em.delete(EnShortTranslation, { word: { id: word.id } });
  for (const [sync_id, row] of collection(document.short_translations))
    await em.save(EnShortTranslation, {
      ...fields(row, CONTENT_FIELDS.short),
      sync_id,
      word,
    });
}

/** The complete graph has already been validated. All passes use the publication transaction. */
export async function publishPlan(
  em: EntityManager,
  plan: ReconciliationPlan,
  license: string,
  progress?: ReconciliationApplicationSinkT,
): Promise<void> {
  const store = new ReconciliationStore(em);
  const revision = await store.revision(plan.incoming);
  const operation = {
    id: plan.id,
    kind: plan.kind,
    source: String(revision.metadata.source),
    revision: plan.incoming,
  };
  await freezeOrigins(em, plan, progress);
  const changedTotal = await em.countBy(ReconciliationItem, { plan: plan.id, effect: Not(IsNull()) });
  const advance = applicationStage(progress, 'publishing');
  let processed = 0;
  const total = changedTotal * 5;
  advance?.(processed, total);
  // Each pass touches only articles with an actual content effect. Effects are
  // recalculated whenever a saved decision or whole-article result changes.
  async function* changes() {
    for await (const item of store.items(plan.id, true)) {
      yield item;
      advance?.(++processed, total);
    }
  }
  // Create all target spellings before installing any relationship. Base rows for
  // new POS are created later so creation history can distinguish them from edits.
  for await (const item of changes()) {
    if (!item.result.present) continue;
    const article = object(item.result.value);
    for (const part of Object.keys(object(article.parts)))
      await getOrAddEntry(em, item.headword, entryTypeOf(part));
    for (const raw of Object.values(object(article.parts))) {
      for (const [, form] of collection(object(raw).forms))
        await getOrAddEntry(em, String(form.word), entryTypeOf(EnPartOfSpeechE.noun));
    }
  }
  for await (const item of changes()) {
    const side = async (revision: string | null) => {
      const row = revision ? await store.record(revision, item.headword) : null;
      return row?.content != null ? present(row.content) : missing;
    };
    const sources = {
      baseline: await side(plan.baseline),
      local: await side(plan.local),
      incoming: await side(plan.incoming),
      result: item.result,
    };
    await withChangeSource(
      { origin: ChangeOriginE.admin, operation, contribution: null, superseded: true },
      async () => {
        const parts = item.result.present ? object(object(item.result.value).parts) : {};
        for (const part of Object.values(EnPartOfSpeechE)) {
          const recordResolution = resolutionRecorder(sources, operation, part);
          const before = await findWord(em, item.headword, part);
          const proposed = parts[part];
          if (!before && !proposed) continue;
          if (!proposed) {
            await recordResolution(em, {
              headword: item.headword,
              part_of_speech: part,
              entity: ChangeEntityE.word,
              action: ChangeActionE.delete,
              diff: deletedFields(fullWordSnapshot(before!)),
            });
            for (const form of before!.forms ?? []) await em.delete(EnWord, { id: form.id });
            await em.delete(EnWord, { id: before!.id });
            continue;
          }
          if (!before)
            await em.save(EnWord, {
              word: await getOrAddEntry(em, item.headword, entryTypeOf(part)),
              part_of_speech: part,
              form_of_word: EnWordFormsE.base_form,
              generated: false,
            });
          const empty = before ? null : (await findWord(em, item.headword, part))!;
          await writeWord(em, item.headword, part, object(proposed), plan.kind !== 'source');
          const after = (await findWord(em, item.headword, part))!;
          if (before) await recordCopiedEdits(em, before, after, true, recordResolution);
          else {
            const fromSource = sources.incoming.present && object(object(sources.incoming.value).parts)[part];
            await (fromSource ? recordChange : recordResolution)(em, {
              headword: item.headword,
              part_of_speech: part,
              entity: ChangeEntityE.word,
              action: ChangeActionE.create,
              diff: createdFields(fullWordSnapshot(after)),
            });
            // Resolve the new word's common fields and nested records separately:
            // a custom definition must not claim all imported meanings or translations.
            if (fromSource) await recordCopiedEdits(em, empty!, after, true, recordResolution);
          }
        }
      },
    );
  }
  // Reciprocal lists were validated together. Read "before" from the frozen local
  // snapshot, because a previous endpoint may already have changed the join table.
  for await (const item of changes()) {
    if (!item.result.present) continue;
    const article = object(item.result.value);
    const local = await em
      .createQueryBuilder('reconciliation_records', 'record')
      .select('record.content', 'content')
      .where('record.revision = :revision AND record.headword = :headword', {
        revision: plan.local,
        headword: item.headword,
      })
      .getRawOne<{ content: string }>();
    const previous = local?.content ? JSON.parse(local.content) : null;
    const requested = new Map<string, string[]>([[item.headword, strings(article.alternatives)]]);
    const previousLinks = new Map<string, string[]>([
      [item.headword, previous ? strings(object(previous).alternatives) : []],
    ]);
    for (const raw of Object.values(object(article.parts)))
      for (const [, form] of collection(object(raw).forms))
        requested.set(String(form.word), strings(form.alternatives ?? []));
    if (previous)
      for (const raw of Object.values(object(object(previous).parts)))
        for (const [, form] of collection(object(raw).forms))
          previousLinks.set(String(form.word), strings(form.alternatives ?? []));
    await replaceAlternatives(em, requested);
    await withChangeSource(
      { origin: ChangeOriginE.admin, operation, contribution: null, superseded: true },
      async () => {
        for (const [headword, links] of requested) {
          const before = [...(previousLinks.get(headword) ?? [])].sort();
          const after = [...links].sort();
          if (JSON.stringify(before) !== JSON.stringify(after))
            await recordChange(em, {
              headword,
              part_of_speech: null,
              entity: ChangeEntityE.word,
              action: ChangeActionE.update,
              diff: { alternatives: { before, after } },
            });
        }
      },
    );
  }
  // Resolve cross-word associations after all POS exist. History of these fields is
  // recorded separately, so it contains the actual final value, not an intermediate null.
  for await (const item of changes()) {
    if (!item.result.present) continue;
    const article = object(item.result.value);
    await withChangeSource(
      { origin: ChangeOriginE.admin, operation, contribution: null, superseded: true },
      async () => {
        for (const [part, raw] of Object.entries(object(article.parts))) {
          const word = (await findWord(em, item.headword, part))!;
          const target = object(object(raw).common).base_phrasal;
          const before = word.base_phrasal?.word.word ?? null;
          if (target !== before) {
            await em.update(
              EnWord,
              { id: word.id },
              { base_phrasal: target ? await findWord(em, String(target), EnPartOfSpeechE.verb) : null },
            );
            await recordChange(em, {
              headword: item.headword,
              part_of_speech: part,
              entity: ChangeEntityE.word,
              action: ChangeActionE.update,
              diff: { base_phrasal: { before, after: target } },
            });
          }
        }
      },
    );
  }
  // Defer orphan cleanup until every form has been installed. A spelling can move
  // between base words without briefly disappearing and cascading unrelated links.
  for await (const item of changes()) {
    const previous = await store.record(plan.local, item.headword);
    if (!previous?.content) continue;
    await dropEntryIfUnused(em, previous.headword);
    for (const raw of Object.values(object(object(previous.content).parts))) {
      for (const [, form] of collection(object(raw).forms)) await dropEntryIfUnused(em, String(form.word));
    }
  }
  const historyProgress = applicationStage(progress, 'history');
  const incomingTotal = await em
    .createQueryBuilder(ReconciliationRecord, 'record')
    .where('record.revision = :revision', { revision: plan.incoming })
    .getCount();
  const historyTotal = changedTotal + incomingTotal;
  let histories = 0;
  historyProgress?.(histories, historyTotal);
  for await (const item of store.items(plan.id, true)) {
    await retireReplacedHistory(em, item.headword, plan.id);
    historyProgress?.(++histories, historyTotal);
  }
  for await (const record of store.records(plan.incoming)) {
    await inheritHistory(em, record, revision.metadata.terms as unknown as OriginT, operation, license);
    historyProgress?.(++histories, historyTotal);
  }
  await publishVersions(em, plan, operation, progress);
  // New unchanged source words are not manual edits. The journal above still records their acquisition.
  for await (const item of store.items(plan.id, true)) {
    if (item.effect !== 'added') continue;
    const active = await em
      .createQueryBuilder(EnChange, 'change')
      .where('change.headword = :word AND change.superseded_at IS NULL', { word: item.headword })
      .getCount();
    await em.update(EnEntry, { word: item.headword }, { user_modified: active > 0 });
  }
}
