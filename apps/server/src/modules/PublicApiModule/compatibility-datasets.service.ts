import { Injectable } from '@nestjs/common';
import type {
  DictionaryApiV1DatasetsResT,
  DictionaryApiV2DatasetsResT,
  FreeDictionaryDatasetsResT,
} from '../../../types/public/compatibility-datasets';
import type { DictionaryApiV1ResT, DictionaryApiV2ResT } from '../../../types/public/dictionaryapi';
import type { PublicWordV1T } from '../../../types';
import { dictionaryApiError } from '../../core/utils/dictionaryapi-error';
import { DatasetsService } from '../DatasetsModule/datasets.service';
import { PublicMetaService } from './public-meta.service';
import { HeadwordReader } from './utils/headword-reader';
import { toDictionaryApiV1, toDictionaryApiV2 } from './dictionaryapi/projection';
import { FreeDictionaryApiService } from './freedictionaryapi/freedictionaryapi.service';

@Injectable()
export class CompatibilityDatasetsService {
  constructor(
    private readonly datasets: DatasetsService,
    private readonly meta: PublicMetaService,
    private readonly freeDictionary: FreeDictionaryApiService,
  ) {}

  private async dictionaryApi<T extends DictionaryApiV1ResT | DictionaryApiV2ResT>(
    language: string,
    word: string,
    baseUrl: string,
    project: (entries: PublicWordV1T[], dataset: string, baseUrl: string) => T,
  ) {
    const installed = await this.datasets.publiclyReadable();
    const data = await Promise.all(
      installed.map(async (dataset) => {
        const terms = await this.meta.termsOf(dataset);
        const reader = HeadwordReader.on(await this.datasets.reader(dataset), dataset.source);
        const resolved = await reader.resolve(word);
        const entries = resolved ? await reader.loadFull(resolved.ids) : [];
        return entries.length
          ? { ...terms, status: 200 as const, response: project(entries, dataset.name, baseUrl) }
          : { ...terms, status: 404 as const, response: dictionaryApiError(404) };
      }),
    );
    return {
      data,
      meta: { word, language, datasets: data.length, found: data.filter((g) => g.status === 200).length },
    };
  }

  dictionaryApiV1(language: string, word: string, baseUrl: string): Promise<DictionaryApiV1DatasetsResT> {
    return this.dictionaryApi(language, word, baseUrl, toDictionaryApiV1);
  }

  dictionaryApiV2(language: string, word: string, baseUrl: string): Promise<DictionaryApiV2DatasetsResT> {
    return this.dictionaryApi(language, word, baseUrl, toDictionaryApiV2);
  }

  async freeDictionaryApi(
    language: string,
    word: string,
    translations: boolean,
    baseUrl: string,
  ): Promise<FreeDictionaryDatasetsResT> {
    const installed = await this.datasets.publiclyReadable();
    // /meta describes only the active dataset. Empty responses instead link to their own group here.
    const emptySourceUrl = `${baseUrl}/api/compat/freedictionaryapi/v1/entries/${encodeURIComponent(language)}/${encodeURIComponent(word)}/datasets`;
    const data = await Promise.all(
      installed.map(async (dataset) => {
        const response = await this.freeDictionary.entriesIn(
          dataset,
          language,
          word,
          translations,
          baseUrl,
          emptySourceUrl,
        );
        return { ...response.vocabBloom, status: 200 as const, response };
      }),
    );
    return {
      data,
      meta: {
        word,
        language,
        datasets: data.length,
        found: data.filter((g) => g.response.entries.length > 0).length,
      },
    };
  }
}
