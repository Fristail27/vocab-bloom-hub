import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  FreeDictionaryEntriesResT,
  FreeDictionaryLanguagesResT,
} from '../../../../types/public/freedictionaryapi';
import { scopedDataSource } from '../../../core/utils/dataset-scope';
import { EnEntry } from '../../EnModule/entities/en_entry.entity';
import { EnWord } from '../../EnModule/entities/en_word.entity';
import { DatasetsService } from '../../DatasetsModule/datasets.service';
import { PublicMetaService } from '../public-meta.service';
import { HeadwordReader } from '../utils/headword-reader';
import { compatibilityLicense } from '../utils/compatibility';
import { ENGLISH, toFreeDictionaryEntries } from './projection';

@Injectable()
export class FreeDictionaryApiService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly datasets: DatasetsService,
    private readonly meta: PublicMetaService,
  ) {}

  async languages(): Promise<FreeDictionaryLanguagesResT> {
    // Count readable spellings once, including one-hop spelling aliases; thesaurus-only placeholders do not count.
    const words = await scopedDataSource(this.dataSource)
      .getRepository(EnEntry)
      .createQueryBuilder('entry')
      .leftJoin('entry.entries', 'own')
      .leftJoin('entry.alternatives', 'alternative')
      .leftJoin('alternative.entries', 'linked')
      .where('own.id IS NOT NULL OR linked.id IS NOT NULL')
      .getCount();
    return [{ ...ENGLISH, words }];
  }

  async entries(
    language: string,
    word: string,
    translations: boolean,
    baseUrl: string,
  ): Promise<FreeDictionaryEntriesResT> {
    const dataSource = scopedDataSource(this.dataSource);
    const dataset = this.datasets.getActive();
    const terms = await this.meta.termsOf(dataset);
    let ids: number[] = [];
    if (language === 'en' || language === 'all') {
      const own = await dataSource
        .getRepository(EnWord)
        .createQueryBuilder('w')
        .innerJoin('w.word', 'entry')
        .leftJoin('w.base_form', 'base')
        .select('COALESCE(base.id, w.id)', 'id')
        .where('entry.word = :word', { word })
        .getRawMany<{ id: number }>();
      ids = own.map((row) => Number(row.id));
      if (!ids.length) {
        // One hop only. An alternative with its own definitions always wins; no POS relation is invented.
        const linked = await dataSource
          .getRepository(EnEntry)
          .createQueryBuilder('entry')
          .innerJoin('entry.alternatives', 'alternative')
          .innerJoin('alternative.entries', 'w')
          .leftJoin('w.base_form', 'base')
          .select('COALESCE(base.id, w.id)', 'id')
          .where('entry.word = :word', { word })
          .getRawMany<{ id: number }>();
        ids = linked.map((row) => Number(row.id));
      }
    }
    const rows = await HeadwordReader.on(dataSource, dataset.source).loadFull(
      [...new Set(ids)].sort((a, b) => a - b),
    );
    rows.sort(
      (a, b) =>
        a.word.localeCompare(b.word, 'en') ||
        a.part_of_speech.localeCompare(b.part_of_speech, 'en') ||
        a.id - b.id,
    );
    const entries = toFreeDictionaryEntries(rows, word, dataset.name, translations);
    const nativeUrl = rows.length
      ? `${baseUrl}/api/v1/words/${encodeURIComponent(rows[0].word)}/datasets`
      : `${baseUrl}/api/v1/meta`;
    const licenses = rows.length
      ? rows.flatMap((entry) =>
          [...(entry.origins ?? []), ...(entry.contributions ?? [])].flatMap((origin) => origin.licenses),
        )
      : [{ name: terms.license, url: terms.license_url, text: terms.license_text }];
    const incompleteTerms = rows.some((entry) => {
      const origins = [...(entry.origins ?? []), ...(entry.contributions ?? [])];
      return !origins.length || origins.some((origin) => !origin.licenses.length);
    });
    const sourceUrls = [
      ...new Set(
        rows.flatMap((entry) =>
          [...(entry.origins ?? []), ...(entry.contributions ?? [])]
            .map((origin) => origin.record_url || origin.url)
            .filter((url): url is string => Boolean(url)),
        ),
      ),
    ];
    return {
      word,
      entries,
      source: {
        url: sourceUrls.length === 1 ? sourceUrls[0] : nativeUrl,
        license: (incompleteTerms ? undefined : compatibilityLicense(licenses, nativeUrl)) ?? {
          name: 'License information unavailable',
          url: nativeUrl,
        },
      },
      vocabBloom: terms,
    };
  }
}
