import { EntityManager } from 'typeorm';
import { assertSafeSchema } from '../../db/datasets';
import { EnEmbeddingProfile } from '../../modules/EnModule/entities/en_embedding_profile.entity';
import type { MeaningEmbeddingLineT } from '../../../types/embeddings';
import { currentEmbeddingLines, supportedEmbeddingProfile, writeEmbeddingLines } from './transfer';

/** The caller holds the fork snapshot; this manager stays on the receiving schema. */
export async function copyForkEmbeddings(em: EntityManager, sourceSchema: string): Promise<void> {
  const source = em.connection.driver.escape(assertSafeSchema(sourceSchema));
  const profiles = (await em.query(
    `SELECT * FROM ${source}.en_embedding_profiles ORDER BY id`,
  )) as EnEmbeddingProfile[];
  for (const profile of profiles) {
    if (!supportedEmbeddingProfile(profile)) continue;
    const known = new Map([[profile.id, profile]]);
    let after = 0;
    for (;;) {
      const rows = (await em.query(
        `SELECT v.meaning_id, m.sync_id AS meaning_sync_id, v.profile_id, v.input_hash, v.embedding
         FROM ${source}.en_meaning_embeddings v JOIN ${source}.en_meanings m ON m.id = v.meaning_id
         WHERE v.profile_id = $1 AND v.meaning_id > $2 ORDER BY v.meaning_id LIMIT 200`,
        [profile.id, after],
      )) as Array<MeaningEmbeddingLineT & { meaning_id: number }>;
      if (!rows.length) break;
      await em.createQueryBuilder().insert().into(EnEmbeddingProfile).values(profile).orIgnore().execute();
      // Never assume that equal row IDs mean equal content. The receiving copy must
      // have the same portable identity, complete input hash and valid vector shape.
      await writeEmbeddingLines(em, known, rows, true);
      after = rows.at(-1)!.meaning_id;
    }
  }
}

/** Preserve only current vectors while reconciliation rebuilds this word's nested rows.
 * The caller's publication transaction makes capture, rewrite and reuse atomic. */
export async function retainingWordEmbeddings(
  em: EntityManager,
  wordId: number,
  rewrite: () => Promise<void>,
): Promise<void> {
  const retained: Array<{ profile: EnEmbeddingProfile; lines: MeaningEmbeddingLineT[] }> = [];
  for (const profile of await em.find(EnEmbeddingProfile)) {
    const lines: MeaningEmbeddingLineT[] = [];
    for await (const line of currentEmbeddingLines(em, profile, wordId)) lines.push(line);
    if (lines.length) retained.push({ profile, lines });
  }
  await rewrite();
  for (const { profile, lines } of retained) {
    for (let offset = 0; offset < lines.length; offset += 200)
      await writeEmbeddingLines(em, new Map([[profile.id, profile]]), lines.slice(offset, offset + 200), true);
  }
}
