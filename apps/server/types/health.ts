/**
 * Probes for process managers and orchestrators (issue #315). Both are
 * served at `/api/health` and `/api/ready`, outside the public and the admin
 * surfaces: no login, no rate limit, unaffected by PUBLIC_API_ENABLED /
 * ADMIN_API_ENABLED, never cached.
 */

/** GET /api/health — liveness: the process is up and answers HTTP */
export type HealthResT = {
  status: 'ok';
  /** The server package version */
  version: string;
};

export type ReadinessFailureReasonE = 'database_unreachable' | 'shutting_down' | 'importing' | 'import_failed';

/**
 * GET /api/ready — readiness: the instance can take traffic. Answers 200 with
 * `status: 'ok'` (migrations applied, database answering, dictionary in
 * place) or 503 with the reason: the database does not answer, a stop is in
 * progress and the process is draining its requests, the automatic import of
 * the dictionary is still running (`percent`, `stage`), or that import
 * failed and the dictionary is not loaded (`error`; issue #268).
 */
export type ReadyResT =
  | { status: 'ok' }
  | {
      status: 'error';
      reason: ReadinessFailureReasonE;
      /** `importing`: 0–100 of the running import */
      percent?: number | undefined;
      /** `importing`: the current stage of the import (EnDictionaryImportPhasesE) */
      stage?: number | undefined;
      /** `import_failed`: why */
      error?: string | undefined;
    };
