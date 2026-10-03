import { DICTIONARY_ENTITIES } from '../../EnModule/entities/dictionary-entities';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { ErrorCodes } from '../../../../core/constants/error_codes';
import { AuditActionE, AuditEntityTypeE, CreateDatasetReqT } from '../../../../types';
import { createDatasetSchema } from '../../../db/datasets';
import { Settings } from '../../SettingsModule/entities/settings.entity';
import { DatasetsService } from '../datasets.service';
import { Dataset } from '../entities/dataset.entity';
import { DATASET_VERSION_SETTINGS_FIELD } from '../../EnModule/modules/EnImportDictionary/constants';

// the schemas are Postgres (test:postgres); here the registry and the rules
jest.mock('../../../db/datasets', () => ({
  ...(jest.requireActual('../../../db/datasets') as object),
  createDatasetSchema: jest.fn(async () => undefined),
  dropDatasetSchema: jest.fn(async () => undefined),
}));

const MY_TEXT = 'Permission is granted to read these words aloud.';

const standard: CreateDatasetReqT = {
  name: 'my_words',
  title: 'My words',
  license: { spdx: 'CC-BY-4.0' },
  attribution: 'The words of the owner',
  attribution_url: 'https://example.org/words',
};

const custom: CreateDatasetReqT = {
  name: 'house_rules',
  title: 'House rules',
  license: { name: 'House License 1.0', url: 'https://example.org/license', text: MY_TEXT },
  attribution: 'The house',
};

// The datasets of the instance's own (issue #540): created empty under the
// terms the owner states, the license changed later and journaled
describe('DatasetsService: the datasets of the instance’s own', () => {
  let dataSource: DataSource;
  let service: DatasetsService;
  const record = jest.fn(async (_entry: unknown) => undefined);

  const boot = async (): Promise<DatasetsService> => {
    const created = new DatasetsService(
      dataSource.getRepository(Dataset),
      dataSource.getRepository(Settings),
      dataSource,
    );
    Object.defineProperty(created, 'auditService', { value: { record } });
    await created.onModuleInit();
    // what the driver would say on Postgres; the schema statements are mocked above
    Object.defineProperty(created, 'supported', { value: true });
    jest.spyOn(created, 'reader').mockResolvedValue(dataSource);
    return created;
  };

  beforeEach(async () => {
    record.mockClear();
    (createDatasetSchema as jest.Mock).mockClear();
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Dataset, Settings, ...DICTIONARY_ENTITIES],
      synchronize: true,
    });
    await dataSource.initialize();
    service = await boot();
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates an empty dataset under a license of the list, named as its own source', async () => {
    const created = await service.create(standard);

    expect(createDatasetSchema).toHaveBeenCalledWith('ds_my_words');
    expect(created).toEqual(
      expect.objectContaining({
        name: 'my_words',
        title: 'My words',
        own: true,
        installed: true,
        source: 'my_words',
        license: 'CC-BY-4.0',
        license_url: 'https://creativecommons.org/licenses/by/4.0/',
        license_text: null,
        attribution: 'The words of the owner',
        attribution_url: 'https://example.org/words',
        notice: null,
        version: null,
        active: false,
        is_default: false,
      }),
    );
    // after the cards of the catalog
    const { datasets } = await service.list();
    expect(datasets.at(-1)?.name).toBe('my_words');
    expect(datasets.filter((dataset) => dataset.own).map((dataset) => dataset.name)).toEqual(['my_words']);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActionE.create,
        entityType: AuditEntityTypeE.dataset,
        headword: 'my_words',
        diff: expect.objectContaining({ license: { before: null, after: 'CC-BY-4.0' } }),
      }),
    );
  });

  it('creates a dataset under a license of the owner’s own: its name, its link and its text', async () => {
    const created = await service.create(custom);

    expect(created).toEqual(
      expect.objectContaining({
        source: 'house_rules',
        license: 'House License 1.0',
        license_url: 'https://example.org/license',
        license_text: MY_TEXT,
        attribution_url: null,
      }),
    );
  });

  it('stores an own version, journals edits, and preserves it when omitted', async () => {
    expect(await service.create({ ...standard, version: ' 1.0.0 ' })).toMatchObject({ version: '1.0.0' });
    record.mockClear();
    expect(await service.updateTerms(standard.name, { title: 'Updated title' })).toMatchObject({
      version: '1.0.0',
    });
    record.mockClear();
    expect(await service.updateTerms(standard.name, { version: ' 1.0.0 ' })).toMatchObject({
      version: '1.0.0',
    });
    expect(record).not.toHaveBeenCalled();
    expect(await service.updateTerms(standard.name, { version: ' 2.0.0 ' })).toMatchObject({
      version: '2.0.0',
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ diff: { version: { before: '1.0.0', after: '2.0.0' } } }),
    );
    const stored = await dataSource.getRepository(Dataset).findOneByOrFail({ name: standard.name });
    expect(stored.terms_updated_at).toBeInstanceOf(Date);
  });

  it.each([null, '', '   '])(
    'clears an own version with %p and updates the active settings mirror',
    async (version) => {
      await service.create({ ...standard, version: '1.0.0' });
      await dataSource.getRepository(Settings).save({ field: 'active_dataset', value: standard.name });
      const active = await boot();
      const heard: (string | null)[] = [];
      active.onActiveChanged((dataset) => heard.push(dataset.version));
      await active.updateTerms(standard.name, { version: '2.0.0' });
      expect(
        await dataSource.getRepository(Settings).findOneByOrFail({ field: DATASET_VERSION_SETTINGS_FIELD }),
      ).toMatchObject({ value: '2.0.0' });
      await active.updateTerms(standard.name, { version });
      expect(active.getActive().version).toBeNull();
      expect(heard).toEqual(['2.0.0', null]);
      expect(
        await dataSource.getRepository(Settings).findOneBy({ field: DATASET_VERSION_SETTINGS_FIELD }),
      ).toBeNull();
    },
  );

  it('takes no name of the catalog, of its datasets or of its sources, and no name twice', async () => {
    for (const name of ['default', 'wiktionary', 'wordnet', 'wordnet_princeton']) {
      await expect(service.create({ ...standard, name })).rejects.toThrow(ErrorCodes.dataset_name_reserved);
    }
    await expect(service.create({ ...standard, name: 'My-Words' })).rejects.toThrow(
      ErrorCodes.dataset_name_invalid,
    );
    await service.create(standard);
    await expect(service.create(standard)).rejects.toThrow(ErrorCodes.dataset_already_exists);
    expect(createDatasetSchema).toHaveBeenCalledTimes(1);
  });

  it('refuses a license that is neither one of the list nor a complete one of the owner’s', async () => {
    const refused = [
      { spdx: 'GPL-3.0' },
      { spdx: 'CC-BY-4.0', text: MY_TEXT },
      { name: 'House License', url: 'https://example.org/license' },
      { name: '  ', url: 'https://example.org/license', text: MY_TEXT },
      // a name of the list is the license of the list, not a text of the owner's
      { name: 'CC-BY-4.0', url: 'https://example.org/license', text: MY_TEXT },
      {},
    ];
    for (const license of refused) {
      await expect(service.create({ ...standard, license })).rejects.toThrow(
        ErrorCodes.dataset_license_invalid,
      );
    }
    expect(createDatasetSchema).not.toHaveBeenCalled();
  });

  it('corrects the title and the attribution, and journals what changed', async () => {
    await service.create(standard);
    record.mockClear();

    const updated = await service.updateTerms('my_words', {
      title: 'My own words',
      attribution: 'The words of the owner, 2026',
      attribution_url: '',
    });

    expect(updated).toEqual(
      expect.objectContaining({
        title: 'My own words',
        attribution: 'The words of the owner, 2026',
        attribution_url: null,
        license: 'CC-BY-4.0',
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditActionE.update,
        diff: {
          title: { before: 'My words', after: 'My own words' },
          attribution: { before: 'The words of the owner', after: 'The words of the owner, 2026' },
          attribution_url: { before: 'https://example.org/words', after: null },
        },
      }),
    );
  });

  it('changes the license and keeps the one before and after in the journal', async () => {
    await service.create(standard);
    record.mockClear();

    const updated = await service.updateTerms('my_words', { license: custom.license });

    expect(updated).toEqual(expect.objectContaining({ license: 'House License 1.0', license_text: MY_TEXT }));
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: {
          license: { before: 'CC-BY-4.0', after: 'House License 1.0' },
          license_url: {
            before: 'https://creativecommons.org/licenses/by/4.0/',
            after: 'https://example.org/license',
          },
          license_text: { before: null, after: MY_TEXT },
        },
      }),
    );

    // and back to the list: the text goes with the license it belonged to
    record.mockClear();
    await expect(service.updateTerms('my_words', { license: { spdx: 'CC0-1.0' } })).resolves.toEqual(
      expect.objectContaining({ license: 'CC0-1.0', license_text: null }),
    );
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('journals nothing when nothing changed', async () => {
    await service.create(standard);
    record.mockClear();

    await service.updateTerms('my_words', { title: ' My words ', license: { spdx: 'CC-BY-4.0' } });

    expect(record).not.toHaveBeenCalled();
  });

  it('edits nothing about a dataset of the catalog', async () => {
    await expect(service.updateTerms('default', { version: '1.0.0' })).rejects.toThrow(
      ErrorCodes.dataset_terms_fixed,
    );
    await expect(service.updateTerms('default', { title: 'Mine now' })).rejects.toThrow(
      ErrorCodes.dataset_terms_fixed,
    );
    await expect(service.updateTerms('nope', { title: 'Mine now' })).rejects.toThrow(
      ErrorCodes.dataset_not_found,
    );
  });

  it('keeps the terms of a dataset of the owner’s through a start, and tells the listeners of the active one', async () => {
    await service.create(custom);
    await dataSource.getRepository(Settings).save({ field: 'active_dataset', value: 'house_rules' });
    const again = await boot();
    expect(again.getActive()).toEqual(
      expect.objectContaining({ name: 'house_rules', title: 'House rules', license_text: MY_TEXT }),
    );
    // the dataset of the catalog got its title from the catalog
    const own = await dataSource.getRepository(Dataset).findOneByOrFail({ name: 'default' });
    expect(own.title).toBe('Vocab Bloom Hub English dataset');

    const heard: string[] = [];
    again.onActiveChanged((dataset) => heard.push(dataset.license));
    await again.updateTerms('house_rules', { license: { spdx: 'CC-BY-SA-4.0' } });
    expect(heard).toEqual(['CC-BY-SA-4.0']);
    expect(again.getActive().license).toBe('CC-BY-SA-4.0');
  });

  // a later version of the code may put an entry into the catalog under a name an owner took
  it('keeps a dataset of the owner’s when the catalog gets an entry of its name', async () => {
    const rows = dataSource.getRepository(Dataset);
    await rows.save(
      rows.create({
        name: 'wiktionary',
        schema: 'ds_wiktionary',
        own: true,
        source: 'wiktionary',
        title: 'My Wiktionary notes',
        license: 'CC0-1.0',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        license_text: null,
        attribution: 'The owner',
        attribution_url: null,
        notice: null,
        version: null,
        imported_at: null,
        activated_at: null,
      }),
    );

    const again = await boot();

    // the start leaves the terms of the owner as they were
    expect(await rows.findOneByOrFail({ name: 'wiktionary' })).toEqual(
      expect.objectContaining({ own: true, title: 'My Wiktionary notes', license: 'CC0-1.0' }),
    );
    const { datasets } = await again.list();
    // the card of the catalog holds nothing of it, the dataset of the owner is listed as the owner's
    expect(datasets.find((dataset) => dataset.name === 'wiktionary' && !dataset.own)?.installed).toBe(false);
    expect(datasets.find((dataset) => dataset.name === 'wiktionary' && dataset.own)).toEqual(
      expect.objectContaining({ title: 'My Wiktionary notes', license: 'CC0-1.0', license_text: null }),
    );
    // its terms are the owner's to correct, and the source is never installed into it
    await expect(again.updateTerms('wiktionary', { title: 'Mine' })).resolves.toEqual(
      expect.objectContaining({ title: 'Mine', own: true }),
    );
    await expect(again.install('wiktionary')).rejects.toThrow(ErrorCodes.dataset_already_exists);
    expect(createDatasetSchema).not.toHaveBeenCalled();
  });
});
