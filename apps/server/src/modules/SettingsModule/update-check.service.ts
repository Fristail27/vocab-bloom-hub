import { Injectable, Logger } from '@nestjs/common';
import { PROJECT_LATEST_RELEASE_API_URL } from '../../../core/constants/project_links';
import type { UpdateCheckResT } from '../../../types/settings/SettingsApiTypes';
import { isNewerVersion, isUpdateCheckEnabled, parseVersion } from '../../core/utils/update-check';
import { SettingsService } from './settings.service';

// GitHub allows an anonymous address 60 requests an hour, and a release is a
// rare event: the answer is kept for six hours, a failure for half an hour so
// an outage is neither hammered nor remembered for long
export const UPDATE_CHECK_TTL_MS = 6 * 60 * 60 * 1000;
export const UPDATE_CHECK_FAILURE_TTL_MS = 30 * 60 * 1000;
export const UPDATE_CHECK_TIMEOUT_MS = 10_000;

type LatestReleaseT = { version: string; url: string };
type CacheT = { release: LatestReleaseT | null; checkedAt: number; ok: boolean };

/**
 * Whether a newer stable release exists (issue #477). Notification only: the
 * server never updates itself — an upgrade runs migrations and stays a
 * deliberate step of the operator (docs/upgrading.md#update-notice).
 */
@Injectable()
export class UpdateCheckService {
  private readonly logger = new Logger(UpdateCheckService.name);
  private cache: CacheT | null = null;
  private inFlight: Promise<CacheT> | null = null;

  constructor(private readonly settingsService: SettingsService) {}

  async check(): Promise<UpdateCheckResT> {
    const current = this.settingsService.getVersion() || '';
    if (!isUpdateCheckEnabled()) {
      return {
        enabled: false,
        current,
        latest: null,
        update_available: false,
        release_url: null,
        checked_at: null,
      };
    }

    const { release, checkedAt } = await this.latestRelease(current);
    return {
      enabled: true,
      current,
      latest: release?.version ?? null,
      update_available: isNewerVersion(release?.version, current),
      release_url: release?.url ?? null,
      checked_at: new Date(checkedAt).toISOString(),
    };
  }

  /** Forgets the cached answer; the next check asks GitHub again */
  reset(): void {
    this.cache = null;
  }

  private async latestRelease(current: string): Promise<CacheT> {
    const cached = this.cache;
    if (cached) {
      const ttl = cached.ok ? UPDATE_CHECK_TTL_MS : UPDATE_CHECK_FAILURE_TTL_MS;
      if (Date.now() - cached.checkedAt < ttl) return cached;
    }
    // concurrent page loads share one request
    this.inFlight ??= this.fetchLatestRelease(current).finally(() => {
      this.inFlight = null;
    });
    this.cache = await this.inFlight;
    return this.cache;
  }

  private async fetchLatestRelease(current: string): Promise<CacheT> {
    try {
      const response = await fetch(PROJECT_LATEST_RELEASE_API_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          // GitHub rejects requests without a User-Agent
          'User-Agent': `vocab-bloom-hub/${current || 'unknown'}`,
        },
        signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`GitHub answered ${response.status}`);
      }
      const body = (await response.json()) as { tag_name?: unknown; html_url?: unknown };
      const tag = typeof body.tag_name === 'string' ? body.tag_name : '';
      if (!parseVersion(tag)) {
        throw new Error(`the latest release is tagged "${tag}", not a version`);
      }
      const url = typeof body.html_url === 'string' ? body.html_url : '';
      return { release: { version: tag.replace(/^v/, ''), url }, checkedAt: Date.now(), ok: true };
    } catch (error) {
      // logged once per failure period: the cache keeps the check from repeating
      this.logger.warn(
        `The update check failed, "unknown" for the next ${UPDATE_CHECK_FAILURE_TTL_MS / 60_000} min: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { release: null, checkedAt: Date.now(), ok: false };
    }
  }
}
