import { delay, http, HttpResponse } from 'msw';
import type { CreateDatasetReqT, DatasetT, ForkProgressT, UpdateDatasetReqT } from 'server/types';
import { findStandardLicense } from 'server/core/constants/data_licenses';
import { EnDictionaryImportPhasesE as Phase } from 'server/src/modules/EnModule/modules/EnImportDictionary/constants';
import { datasetList, ownDataset, DATE, PLAN_ID } from './fixtures';
import { API, failure, reconciliationHandlers, type ReviewScenario } from './reconciliation';

export type DatasetScenario = ReviewScenario & {
  unsupported?: boolean;
  listError?: boolean;
  deleteError?: boolean;
  installError?: boolean;
};

export function createDatasetScenario(options: DatasetScenario = {}) {
  const list = datasetList(!options.unsupported);
  const forks = new Map<string, { progress: ForkProgressT; dataset: DatasetT }>();
  const terms = (body: UpdateDatasetReqT) => {
    const { license, ...rest } = body;
    const standard = license?.spdx ? findStandardLicense(license.spdx) : undefined;
    return {
      ...rest,
      ...(license && {
        license: standard?.spdx ?? license.name ?? '',
        license_url: standard?.url ?? license.url ?? '',
        license_text: license.text ?? null,
      }),
    };
  };
  const install = async (name: string) => {
    if (options.installError) return failure('unknown_error', 500);
    const dataset = list.datasets.find((row) => row.name === name)!;
    const wasInstalled = dataset.installed;
    const stream = new ReadableStream({
      async start(controller) {
        for (const stage of [
          Phase.downloading_database,
          Phase.converting_source,
          Phase.preparing_update,
          Phase.completed,
        ]) {
          await delay(250);
          controller.enqueue(
            new TextEncoder().encode(
              `${JSON.stringify({ stage, percent: stage === Phase.completed ? 100 : 50, ...(stage === Phase.completed && wasInstalled && { reconciliation_plan: PLAN_ID }) })}\n`,
            ),
          );
        }
        if (!wasInstalled) dataset.installed = true;
        controller.close();
      },
    });
    return new HttpResponse(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
  };
  return [
    ...reconciliationHandlers(options),
    http.get(API, () => (options.listError ? failure('unknown_error', 500) : HttpResponse.json(list))),
    http.get(`${API}/updates`, () =>
      HttpResponse.json({
        enabled: true,
        datasets: [
          {
            name: 'wordnet',
            installed: '2026-09',
            latest: '2026-10',
            url: null,
            comparable: true,
            update_available: true,
            checked_at: DATE,
          },
        ],
      }),
    ),
    http.post(API, async ({ request }) => {
      await delay(150);
      const body = (await request.json()) as CreateDatasetReqT;
      if (list.datasets.some((row) => row.name === body.name)) return failure('dataset_already_exists');
      const dataset = { ...ownDataset(body.name, body.title), ...terms(body) };
      list.datasets.push(dataset);
      return HttpResponse.json(dataset, { status: 201 });
    }),
    http.patch(`${API}/:name/visibility`, async ({ params, request }) => {
      const dataset = list.datasets.find((row) => row.name === params.name)!;
      const body = (await request.json()) as { is_public: boolean };
      dataset.is_public = body.is_public;
      return HttpResponse.json(dataset);
    }),
    http.post(`${API}/:name/activate`, ({ params }) => {
      list.active = String(params.name);
      for (const dataset of list.datasets) dataset.active = dataset.name === params.name;
      return HttpResponse.json(list.datasets.find((row) => row.active));
    }),
    http.patch(`${API}/:name`, async ({ params, request }) => {
      const dataset = list.datasets.find((row) => row.name === params.name)!;
      Object.assign(dataset, terms((await request.json()) as UpdateDatasetReqT));
      return HttpResponse.json(dataset);
    }),
    http.delete(`${API}/:name`, ({ params }) => {
      if (options.deleteError) return failure('unknown_error', 500);
      list.datasets = list.datasets.filter((row) => row.name !== params.name);
      return HttpResponse.json({ success: true });
    }),
    http.post(`${API}/:name/fork`, async ({ params, request }) => {
      const body = (await request.json()) as CreateDatasetReqT;
      const progress: ForkProgressT = {
        name: body.name,
        parent: String(params.name),
        state: 'copying',
        completed_tables: 0,
        total_tables: 4,
      };
      forks.set(body.name, { progress, dataset: { ...ownDataset(body.name, body.title), ...terms(body) } });
      return HttpResponse.json(progress, { status: 202 });
    }),
    http.get(`${API}/:name/fork-status`, ({ params }) => {
      const fork = forks.get(String(params.name));
      if (!fork) return failure('not_found', 404);
      if (fork.progress.state === 'copying') {
        fork.progress.completed_tables += 2;
        if (fork.progress.completed_tables >= fork.progress.total_tables) {
          fork.progress.state = 'completed';
          list.datasets.push(fork.dataset);
        }
      }
      return HttpResponse.json(fork.progress);
    }),
    http.post(`${API}/:name/install/download`, ({ params }) => install(String(params.name))),
    http.post(`${API}/:name/install`, ({ params }) => install(String(params.name))),
    // Unsupported API interactions fail locally rather than reaching any running instance.
    http.all('/__storybook/api/*', () => failure('unknown_error', 501)),
  ];
}
