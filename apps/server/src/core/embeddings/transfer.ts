import { EnWordFormsE } from '../../../types';
import { BadRequestException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { EntityManager, In, MoreThan } from 'typeorm';
import type { EmbeddingManifestT, MeaningEmbeddingLineT } from '../../../types/embeddings';
import { EnMeaning } from '../../modules/EnModule/entities/en_meaning.entity';
import { EnEmbeddingProfile } from '../../modules/EnModule/entities/en_embedding_profile.entity';
import { EnMeaningEmbedding } from '../../modules/EnModule/entities/en_meaning_embedding.entity';
import { embeddingInputHash, embeddingProfileId, embeddingVector, type EmbeddingProfileT } from './profile';

export const EMBEDDING_DOCUMENT_FORMAT = 'meaning-v1';
export const EMBEDDING_QUERY_FORMAT = 'search-query-v1';
const HEX = /^[a-f0-9]{64}$/;
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const BATCH = 200;
export const invalidEmbeddings = (): never => {
  throw new BadRequestException('embeddings_invalid');
};

export function embeddingDocument(meaning: EnMeaning): string {
  return `title: ${meaning.word.word.word} (${meaning.word.part_of_speech}) | text: ${meaning.title}. ${meaning.definition}`;
}

/** Only supported preprocessing can be verified against the receiving content. */
export function embeddingManifest(raw: unknown): EmbeddingManifestT {
  if (!raw || typeof raw !== 'object') return invalidEmbeddings();
  const value = raw as EmbeddingManifestT;
  if (
    value.format !== 1 ||
    !Array.isArray(value.profiles) ||
    !value.profiles.length ||
    value.profiles.length > 16
  )
    return invalidEmbeddings();
  const ids = new Set<string>();
  const profiles = value.profiles.map((p) => {
    try {
      if (
        !p ||
        embeddingProfileId(p) !== p.id ||
        !HEX.test(p.revision) ||
        p.document_format !== EMBEDDING_DOCUMENT_FORMAT ||
        p.query_format !== EMBEDDING_QUERY_FORMAT ||
        ids.has(p.id)
      )
        return invalidEmbeddings();
      ids.add(p.id);
      return {
        id: p.id,
        model: p.model,
        revision: p.revision,
        dimensions: p.dimensions,
        normalization: p.normalization,
        document_format: p.document_format,
        query_format: p.query_format,
      };
    } catch {
      return invalidEmbeddings();
    }
  });
  return { format: 1, profiles };
}

/** Derived data from an unknown format or damaged profile is not reusable. */
export function supportedEmbeddingProfile(profile: EnEmbeddingProfile): boolean {
  try {
    embeddingManifest({ format: 1, profiles: [profile] });
    return true;
  } catch {
    return false;
  }
}

/** Lock the input columns and vector tables in a stable order through publication. */
export async function lockEmbeddingImport(em: EntityManager): Promise<void> {
  if (em.connection.options.type === 'postgres')
    await em.query(
      'LOCK TABLE en_entries, en_words, en_meanings, en_embedding_profiles, en_meaning_embeddings IN SHARE ROW EXCLUSIVE MODE',
    );
}

async function meaningsByIdentity(em: EntityManager, ids: string[]): Promise<Map<string, EnMeaning>> {
  const meanings = await em.find(EnMeaning, {
    where: { sync_id: In(ids) },
    relations: { word: { word: true } },
  });
  const result = new Map<string, EnMeaning>();
  for (const meaning of meanings) {
    if (!meaning.sync_id || result.has(meaning.sync_id)) return invalidEmbeddings();
    result.set(meaning.sync_id, meaning);
  }
  return result;
}

export async function writeEmbeddingLines(
  em: EntityManager,
  profiles: Map<string, EmbeddingProfileT>,
  lines: MeaningEmbeddingLineT[],
  skipChanged = false,
): Promise<void> {
  const meanings = await meaningsByIdentity(
    em,
    lines.map((line) => line.meaning_sync_id),
  );
  const rows = [];
  for (const line of lines) {
    const profile = profiles.get(line.profile_id);
    if (!profile || !UUID.test(line.meaning_sync_id) || !HEX.test(line.input_hash)) return invalidEmbeddings();
    const meaning = meanings.get(line.meaning_sync_id);
    if (
      !meaning?.word?.word ||
      meaning.word.form_of_word !== EnWordFormsE.base_form ||
      embeddingInputHash(embeddingDocument(meaning)) !== line.input_hash
    ) {
      if (skipChanged) continue;
      throw new BadRequestException('embeddings_content_mismatch');
    }
    let embedding: number[];
    try {
      embedding = embeddingVector(line.embedding, profile.dimensions);
    } catch {
      return invalidEmbeddings();
    }
    rows.push({
      profile_id: line.profile_id,
      meaning_id: meaning.id,
      dimensions: profile.dimensions,
      input_hash: line.input_hash,
      embedding,
    });
  }
  if (rows.length) await em.upsert(EnMeaningEmbedding, rows, ['profile_id', 'meaning_id']);
}

/** All chunks belong to one transaction: a malformed last line rolls back the entire file. */
export async function importMeaningEmbeddings(
  manager: EntityManager,
  file: string,
  raw: EmbeddingManifestT,
  expected: number,
): Promise<void> {
  const manifest = embeddingManifest(raw);
  await manager.transaction(async (em) => {
    await lockEmbeddingImport(em);
    await em
      .createQueryBuilder()
      .insert()
      .into(EnEmbeddingProfile)
      .values(manifest.profiles)
      .orIgnore()
      .execute();
    const profiles = new Map(manifest.profiles.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const stream = createReadStream(file, { encoding: 'utf8' });
    const reader = createInterface({ input: stream, crlfDelay: Infinity });
    let batch: MeaningEmbeddingLineT[] = [];
    let count = 0;
    try {
      for await (const text of reader) {
        if (!text.trim()) continue;
        if (text.length > 100_000) return invalidEmbeddings();
        let line: MeaningEmbeddingLineT;
        try {
          line = JSON.parse(text);
        } catch {
          return invalidEmbeddings();
        }
        if (
          !line ||
          typeof line !== 'object' ||
          Array.isArray(line) ||
          Object.keys(line).sort().join(',') !== 'embedding,input_hash,meaning_sync_id,profile_id' ||
          typeof line.meaning_sync_id !== 'string' ||
          typeof line.profile_id !== 'string' ||
          typeof line.input_hash !== 'string'
        )
          return invalidEmbeddings();
        const key = `${line.profile_id}:${line.meaning_sync_id}`;
        if (seen.has(key)) return invalidEmbeddings();
        seen.add(key);
        count++;
        batch.push(line);
        if (batch.length === BATCH) {
          await writeEmbeddingLines(em, profiles, batch);
          batch = [];
        }
      }
      await writeEmbeddingLines(em, profiles, batch);
      if (!Number.isSafeInteger(expected) || count !== expected) return invalidEmbeddings();
    } finally {
      reader.close();
      stream.destroy();
    }
  });
}

/** Bounded pages, portable IDs, and only vectors of the current document text. */
export async function* currentEmbeddingLines(em: EntityManager, profile: EnEmbeddingProfile, wordId?: number) {
  if (!supportedEmbeddingProfile(profile)) return;
  let after = 0;
  for (;;) {
    const rows = await em.find(EnMeaningEmbedding, {
      where: {
        profile_id: profile.id,
        meaning_id: MoreThan(after),
        ...(wordId === undefined ? {} : { meaning: { word: { id: wordId } } }),
      },
      order: { meaning_id: 'ASC' },
      take: BATCH,
      relations: { meaning: { word: { word: true } } },
    });
    if (!rows.length) break;
    for (const row of rows) {
      const m = row.meaning;
      if (
        !m.sync_id ||
        !m.word?.word ||
        m.word.form_of_word !== EnWordFormsE.base_form ||
        embeddingInputHash(embeddingDocument(m)) !== row.input_hash
      )
        continue;
      yield {
        meaning_sync_id: m.sync_id,
        profile_id: row.profile_id,
        input_hash: row.input_hash,
        embedding: embeddingVector(row.embedding, profile.dimensions),
      } satisfies MeaningEmbeddingLineT;
    }
    after = rows.at(-1)!.meaning_id;
  }
}

export async function exportMeaningEmbeddings(em: EntityManager, file: string) {
  // Some legacy unit fixtures deliberately register a subset of dictionary entities.
  if (!em.connection.hasMetadata(EnMeaningEmbedding)) return null;
  const profiles = await em.find(EnEmbeddingProfile, { order: { id: 'ASC' } });
  const used: EnEmbeddingProfile[] = [];
  let count = 0;
  let out: Awaited<ReturnType<typeof open>> | undefined;
  try {
    for (const profile of profiles) {
      let present = false;
      for await (const line of currentEmbeddingLines(em, profile)) {
        if (!present) {
          used.push(profile);
          present = true;
        }
        out ??= await open(file, 'w');
        await out.write(`${JSON.stringify(line)}\n`);
        count++;
      }
    }
  } finally {
    await out?.close();
  }
  if (!count) return null;
  return { manifest: embeddingManifest({ format: 1, profiles: used }), count };
}
