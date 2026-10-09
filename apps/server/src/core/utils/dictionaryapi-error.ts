import type { DictionaryApiErrorT } from '../../../types/public/dictionaryapi';

/** Upstream's missing-word payload; other failures keep its three-string shape. */
export function dictionaryApiError(status: number): DictionaryApiErrorT {
  if (status === 404)
    return {
      title: 'No Definitions Found',
      message: "Sorry pal, we couldn't find definitions for the word you were looking for.",
      resolution: 'You can try the search again at later time or head to the web instead.',
    };
  if (status === 429)
    return {
      title: 'API Rate Limit Exceeded',
      message: 'The public API request limit was exceeded.',
      resolution: 'Retry after the interval indicated by the Retry-After header.',
    };
  if (status === 400)
    return {
      title: 'Invalid Request',
      message: 'Invalid word or unsupported query parameters.',
      resolution: 'Check the URL and encode the word as one path segment.',
    };
  return {
    title: 'Something Went Wrong',
    message: 'The dictionary is temporarily unavailable.',
    resolution: 'Try again later.',
  };
}
