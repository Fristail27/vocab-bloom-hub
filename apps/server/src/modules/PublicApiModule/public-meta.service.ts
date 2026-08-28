import { Injectable, NotFoundException } from '@nestjs/common';
import { EnStatisticsService } from '../EnModule/modules/EnStatistics/enStatistics.service';
import { SettingsService } from '../SettingsModule/settings.service';
import { DATASET_VERSION_SETTINGS_FIELD } from '../EnModule/modules/EnImportDictionary/constants';
import { PUBLIC_API_VERSION } from '../../core/utils/public-api';
import { DATA_LICENSE } from '../../../core/constants/data_license';
import { PublicDatasetCountsV1T, PublicMetaV1T } from '../../../types';

// The counters are a dozen COUNT(*) queries over the whole dictionary; the
// public prefix may be polled by every consumer, so they are refreshed at
// most this often
export const META_COUNTS_TTL_MS = 60_000;

/** GET /api/v1/meta: what the instance serves (issue #272) */
@Injectable()
export class PublicMetaService {
  private countsCache: { counts: PublicDatasetCountsV1T; fetchedAt: number } | null = null;

  constructor(
    private readonly enStatisticsService: EnStatisticsService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getCounts(): Promise<PublicDatasetCountsV1T> {
    if (this.countsCache && Date.now() - this.countsCache.fetchedAt < META_COUNTS_TTL_MS) {
      return this.countsCache.counts;
    }
    const { totals } = await this.enStatisticsService.getStatistics();
    this.countsCache = { counts: totals, fetchedAt: Date.now() };
    return totals;
  }

  private async getDatasetVersion(): Promise<string | null> {
    try {
      return await this.settingsService.findOne(DATASET_VERSION_SETTINGS_FIELD);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async getMeta(): Promise<PublicMetaV1T> {
    const [counts, dataset_version] = await Promise.all([this.getCounts(), this.getDatasetVersion()]);
    return {
      api_version: PUBLIC_API_VERSION,
      app_version: this.settingsService.getVersion() ?? '',
      dataset_version,
      license: DATA_LICENSE.spdx,
      license_url: DATA_LICENSE.url,
      attribution: DATA_LICENSE.attribution,
      counts,
    };
  }
}
