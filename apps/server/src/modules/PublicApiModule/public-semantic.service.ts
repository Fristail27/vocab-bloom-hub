import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatasetsService } from '../DatasetsModule/datasets.service';
import { currentDatasetScope } from '../../core/utils/dataset-scope';
import { pgvectorSupport } from '../../core/embeddings/pgvector';
import { semanticSearchConfig, semanticSearchEnabled } from '../../core/embeddings/config';
import { embeddingProfileId } from '../../core/embeddings/profile';
import { OllamaQueryService } from '../../core/embeddings/ollama-query.service';
import { EnEmbeddingProfile } from '../EnModule/entities/en_embedding_profile.entity';
import { WordRowsService } from '../EnModule/word-rows.service';
import { PublicMetaService } from './public-meta.service';
import { toPublicMeaning, toPublicSearchWord } from './utils/projection';
import { SemanticSearchV1QueryDTO } from './dto/SemanticSearchV1Query.dto';
import { PublicSemanticSearchV1ResT } from '../../../types';

// Same exact UTF-8 document as embeddingDocument. Filter BEFORE ranking, so stale
// top candidates cannot suppress current meanings further down the result list.
export const CURRENT_EMBEDDING_ROWS = `
  FROM en_meaning_embeddings v
  JOIN en_meanings m ON m.id = v.meaning_id
  JOIN en_words w ON w.id = m.word
  WHERE v.profile_id = $1 AND w.form_of_word = 'base_form'
    AND v.input_hash = encode(sha256(convert_to(
      'title: ' || w.word || ' (' || w.part_of_speech::text || ') | text: ' || m.title || '. ' || m.definition,
      'UTF8')), 'hex')`;

@Injectable()
export class PublicSemanticService {
  private running = 0;
  constructor(
    private readonly datasets: DatasetsService,
    private readonly meta: PublicMetaService,
    private readonly model: OllamaQueryService,
  ) {}

  async search(query: SemanticSearchV1QueryDTO): Promise<PublicSemanticSearchV1ResT> {
    if (!semanticSearchEnabled()) throw new NotFoundException('semantic_search_disabled');
    if (this.running >= 2) throw new ServiceUnavailableException('semantic_search_busy');
    const config = semanticSearchConfig();
    this.running++;
    try {
      return await this.datasets.withPublicRead(
        query.dataset ?? this.datasets.getActive().name,
        async (dataset) => {
          const em = currentDatasetScope()!.manager!;
          const support = await pgvectorSupport(em);
          if (!support.available) throw new ServiceUnavailableException('semantic_storage_unavailable');
          await em.query("SET LOCAL statement_timeout = '5s'");
          const profile = await em.findOneBy(EnEmbeddingProfile, { id: config.profileId });
          if (!profile || embeddingProfileId(profile) !== config.profileId)
            throw new ServiceUnavailableException('semantic_vectors_unavailable');
          const present = await em.query(`SELECT 1 ${CURRENT_EMBEDDING_ROWS} LIMIT 1`, [config.profileId]);
          if (!present.length) throw new ServiceUnavailableException('semantic_vectors_unavailable');
          const vector = await this.model.embed(query.query, config);
          // Keep candidate text, projected content and modification state consistent.
          // The model call is finished before blocking dictionary writers.
          await em.query('LOCK TABLE en_entries, en_words, en_meanings, en_changes IN SHARE MODE');
          const schema = em.connection.driver.escape(support.schema);
          const type = `${schema}.vector(${profile.dimensions})`;
          const hits = (await em.query(
            `WITH current_vectors AS MATERIALIZED (
          SELECT v.meaning_id, m.word AS word_id, v.embedding ${CURRENT_EMBEDDING_ROWS}
        ) SELECT meaning_id, word_id, 1 - (embedding::${type} OPERATOR(${schema}.<=>) $2::${type}) AS score
          FROM current_vectors ORDER BY score DESC, meaning_id ASC LIMIT $3`,
            [profile.id, JSON.stringify(vector), query.limit],
          )) as Array<{ meaning_id: number; word_id: number; score: number }>;
          if (!hits.length) throw new ServiceUnavailableException('semantic_vectors_unavailable');
          const reader = WordRowsService.on(em);
          const words = await reader.load([...new Set(hits.map((hit) => hit.word_id))], {
            word: { alternatives: true },
            forms: true,
            pronunciations: { audio: true },
            meanings: { etymology: true, translations: true, synonyms: true, antonyms: true },
          });
          const modified = await reader.modifiedWords(words);
          const byId = new Map(words.map((word) => [word.id, word]));
          const data = hits.map((hit) => {
            const word = byId.get(hit.word_id)!;
            const meaning = word.meanings.find((m) => m.id === hit.meaning_id)!;
            const provenance = { source: dataset.source, modified: modified.has(word) };
            return {
              word: toPublicSearchWord(word, provenance),
              meaning: { ...toPublicMeaning(meaning), ...provenance },
              score: Math.max(-1, Math.min(1, Number(hit.score))),
            };
          });
          return {
            data,
            meta: {
              count: data.length,
              limit: query.limit,
              dataset: await this.meta.termsOf(dataset),
              profile_id: profile.id,
            },
          };
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('semantic_search_unavailable');
    } finally {
      this.running--;
    }
  }
}
