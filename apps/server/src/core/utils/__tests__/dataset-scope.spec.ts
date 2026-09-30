import { describe, expect, it } from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { isDatasetScopedPath } from '../../../modules/DatasetsModule/dataset-scope.middleware';
import { setActiveDataset } from '../active-dataset';
import {
  currentDatasetName,
  currentDatasetScope,
  currentDatasetSource,
  scoped,
  scopedDataSource,
  scopedManager,
  withDatasetScope,
} from '../dataset-scope';

// The dataset an admin request works on (issue #540): the scope a request
// runs in when it names a dataset that is not the active one
describe('dataset scope', () => {
  const target = class Word {};
  const own = { getRepository: () => 'the repository of the named dataset', manager: 'its manager' };
  const scope = {
    dataset: { name: 'my_words', source: 'my_words', own: true },
    dataSource: own as unknown as DataSource,
  };
  const active = { target, manager: 'the active manager' } as unknown as Repository<object>;
  const application = { manager: 'the application manager' } as unknown as DataSource;

  it('answers the active dataset outside of a scope', () => {
    setActiveDataset({ name: 'default', source: 'vocab-bloom-hub' });
    expect(currentDatasetScope()).toBeNull();
    expect(currentDatasetName()).toBe('default');
    expect(currentDatasetSource()).toBe('vocab-bloom-hub');
    expect(scoped(active)).toBe(active);
    expect(scopedDataSource(application)).toBe(application);
    expect(scopedManager(application.manager)).toBe(application.manager);
  });

  it('answers the named dataset inside one, through everything the request awaits', async () => {
    await withDatasetScope(scope, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(currentDatasetName()).toBe('my_words');
      // what a word read in the scope says it comes from: the search of the admin UI
      expect(currentDatasetSource()).toBe('my_words');
      expect(scoped(active)).toBe('the repository of the named dataset');
      expect(scopedDataSource(application)).toBe(own);
      expect(scopedManager(application.manager)).toBe('its manager');
    });
    expect(currentDatasetScope()).toBeNull();
  });

  it('scopes the routes of the dictionary, not the datasets, the import or the journal', () => {
    for (const path of ['/api/en/words', '/api/en/42', '/api/en/changes', '/api/en/dictionary/export']) {
      expect(isDatasetScopedPath(path)).toBe(true);
    }
    for (const path of [
      '/api/en/datasets',
      '/api/en/datasets/wiktionary/install',
      '/api/en/dictionary/import/upload',
      '/api/en/audit',
      '/api/v1/words/run',
      '/api/settings',
    ]) {
      expect(isDatasetScopedPath(path)).toBe(false);
    }
  });
});
