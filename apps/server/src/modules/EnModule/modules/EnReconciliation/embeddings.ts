import { EntityManager, MoreThan } from 'typeorm';
import { EnEmbeddingProfile } from '../../entities/en_embedding_profile.entity';
import { ReconciliationEmbedding } from './entities';
import {
  currentEmbeddingLines,
  embeddingManifest,
  writeEmbeddingLines,
} from '../../../../core/embeddings/transfer';
import type { EmbeddingProfileT } from '../../../../../types/embeddings';

/** Persist alongside the plan before the private staging database is removed. */
export async function stageEmbeddings(target: EntityManager, incoming: EntityManager, plan: string) {
  for (const profile of await incoming.find(EnEmbeddingProfile)) {
    let ordinal = 0;
    let batch: Array<Pick<ReconciliationEmbedding, 'plan' | 'profile_id' | 'ordinal' | 'payload'>> = [];
    for await (const line of currentEmbeddingLines(incoming, profile)) {
      batch.push({ plan, profile_id: profile.id, ordinal: ++ordinal, payload: { profile, line } });
      if (batch.length === 200) {
        await target.insert(ReconciliationEmbedding, batch);
        batch = [];
      }
    }
    if (batch.length) await target.insert(ReconciliationEmbedding, batch);
  }
}

/** Called inside content publication. Rejected/changed meanings never receive an incoming vector. */
export async function publishEmbeddings(em: EntityManager, plan: string) {
  const profiles = await em
    .createQueryBuilder(ReconciliationEmbedding, 'v')
    .select('v.profile_id', 'id')
    .where('v.plan = :plan', { plan })
    .distinct(true)
    .getRawMany<{ id: string }>();
  for (const { id } of profiles) {
    let after = 0;
    for (;;) {
      const rows = await em.find(ReconciliationEmbedding, {
        where: { plan, profile_id: id, ordinal: MoreThan(after) },
        order: { ordinal: 'ASC' },
        take: 200,
      });
      if (!rows.length) break;
      const profile = rows[0].payload.profile;
      embeddingManifest({ format: 1, profiles: [profile] });
      await em.createQueryBuilder().insert().into(EnEmbeddingProfile).values(profile).orIgnore().execute();
      await writeEmbeddingLines(
        em,
        new Map<string, EmbeddingProfileT>([[id, profile]]),
        rows.map((r) => r.payload.line),
        true,
      );
      after = rows.at(-1)!.ordinal;
    }
  }
  await em.delete(ReconciliationEmbedding, { plan });
}
