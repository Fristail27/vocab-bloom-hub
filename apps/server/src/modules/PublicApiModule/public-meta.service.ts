import { licensesOf } from '../../../core/utils/provenance';
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EnStatisticsService } from '../EnModule/modules/EnStatistics/enStatistics.service';
import { SettingsService } from '../SettingsModule/settings.service';
import { catalogEntryOf, DatasetsService, titleOf } from '../DatasetsModule/datasets.service';
import { EnChangesService } from '../EnModule/modules/EnChanges/enChanges.service';
import { DATASET_VERSION_SETTINGS_FIELD } from '../EnModule/modules/EnImportDictionary/constants';
import { PUBLIC_API_VERSION } from '../../core/utils/public-api';
import { DATA_LICENSE } from '../../../core/constants/data_license';
import { noticesText } from '../../../core/constants/dataset_catalog';
import { DEFAULT_DATASET_NAME, OWN_DATASET_SOURCE } from '../../../core/constants/datasets';
import { SOURCE_LANGUAGES } from '../../../core/constants/languages';
import {
  AvailableTranslationLanguagesE,
  PublicDatasetCountsV1T,
  PublicDatasetTermsV1T,
  PublicMetaV1T,
} from '../../../types';
import { Dataset } from '../DatasetsModule/entities/dataset.entity';

// The counters are a dozen COUNT(*) queries over the whole dictionary; the
// public prefix may be polled by every consumer, so they are refreshed at
// most this often
export const META_COUNTS_TTL_MS = 60_000;

/** GET /api/v1/meta: what the instance serves (issue #272) */
@Injectable()
export class PublicMetaService {
  private countsCache: { counts: PublicDatasetCountsV1T; modified: number; fetchedAt: number } | null = null;

  constructor(
    private readonly enStatisticsService: EnStatisticsService,
    private readonly settingsService: SettingsService,
    // absent in the unit tests that build the service by hand
    @Optional() private readonly datasets?: DatasetsService,
    @Optional() private readonly changes?: EnChangesService,
  ) {
    // another dataset, other counts (issue #527)
    this.datasets?.onActiveChanged(() => {
      this.countsCache = null;
    });
  }

  // the counters, and with them how many headwords were changed or added on the instance (issue #531)
  private async getCounts(): Promise<{ counts: PublicDatasetCountsV1T; modified: number }> {
    if (this.countsCache && Date.now() - this.countsCache.fetchedAt < META_COUNTS_TTL_MS) {
      return this.countsCache;
    }
    const [{ totals }, modified] = await Promise.all([
      this.enStatisticsService.getStatistics(),
      this.changes?.countModifiedEntries() ?? 0,
    ]);
    this.countsCache = { counts: totals, modified, fetchedAt: Date.now() };
    return this.countsCache;
  }

  // the version of the served dataset is the registry's, what its file said
  // (issue #530); the settings field mirrors it for an instance without the
  // registry (the unit tests that build the service by hand)
  private async getDatasetVersion(): Promise<string | null> {
    const active = this.datasets?.getActive();
    if (active) return active.version;
    try {
      return await this.settingsService.findOne(DATASET_VERSION_SETTINGS_FIELD);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  // the notices of the source in full (issue #531): what the catalog keeps
  // for a dataset of the catalog; the text of the license the owner stated
  // for a dataset of the instance's own (issue #540)
  private licenseTextOf(dataset: Pick<Dataset, 'name' | 'license_text'> & { own?: boolean }): string {
    const entry = catalogEntryOf(dataset);
    return entry ? noticesText(entry) : (dataset.license_text ?? '');
  }

  /** The terms of a dataset of the instance as the public API states them (issue #528) */
  async termsOf(dataset: Dataset): Promise<PublicDatasetTermsV1T> {
    const active = dataset.name === (this.datasets?.getActive()?.name ?? DEFAULT_DATASET_NAME);
    return {
      dataset: dataset.name,
      description: dataset.description ?? null,
      origins: dataset.origins ?? [],
      licenses: licensesOf(dataset.origins ?? []),
      title: titleOf(dataset),
      active,
      source: dataset.source,
      dataset_version: dataset.version,
      license: dataset.license,
      license_url: dataset.license_url,
      attribution: dataset.attribution,
      attribution_url: dataset.attribution_url,
      notice: dataset.notice ?? '',
      license_text: this.licenseTextOf(dataset),
    };
  }

  async getMeta(): Promise<PublicMetaV1T> {
    const [{ counts, modified }, dataset_version] = await Promise.all([
      this.getCounts(),
      this.getDatasetVersion(),
    ]);
    const active = this.datasets?.getActive();
    return {
      api_version: PUBLIC_API_VERSION,
      app_version: this.settingsService.getVersion() ?? '',
      dataset_version,
      // the terms of the dataset that is served (issue #527)
      license: active?.license ?? DATA_LICENSE.spdx,
      license_url: active?.license_url ?? DATA_LICENSE.url,
      attribution: active?.attribution ?? DATA_LICENSE.attribution,
      notice: active ? (active.notice ?? '') : DATA_LICENSE.notice,
      dataset: active?.name ?? DEFAULT_DATASET_NAME,
      description: active?.description ?? null,
      origins: active?.origins ?? [],
      licenses: licensesOf(active?.origins ?? []),
      title: active ? titleOf(active) : titleOf({ name: DEFAULT_DATASET_NAME, title: null }),
      source: active?.source ?? OWN_DATASET_SOURCE,
      attribution_url: active ? active.attribution_url : null,
      license_text: this.licenseTextOf(active ?? { name: DEFAULT_DATASET_NAME, license_text: null }),
      modified_entries: modified,
      counts,
      // the schema, not the data: the languages a translation may carry on
      // this build, whether or not one has been imported yet (issue #394)
      available_languages: {
        source: [...SOURCE_LANGUAGES],
        translations: Object.values(AvailableTranslationLanguagesE),
      },
    };
  }
}
