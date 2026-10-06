import type { PublicWordDatasetsV1ResT, PublicWordV1T } from 'server/types';

import { browserApiBase } from './apiBase';

/** Never substitute the active dataset when the requested dataset has no entry. */
export const loadGraphNeighbor = async (
  word: string,
  dataset: string,
  signal: AbortSignal,
): Promise<PublicWordV1T[]> => {
  const answer = await fetch(`${browserApiBase()}/v1/words/${encodeURIComponent(word)}/datasets`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (answer.status === 404) return [];
  if (!answer.ok) throw new Error(`Graph request failed: ${answer.status}`);
  const body = (await answer.json()) as PublicWordDatasetsV1ResT;
  return body.data.find((group) => group.dataset === dataset)?.entries ?? [];
};
