import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { prepareDatabase } from './datasets';
import { buildTypeOrmOptions } from './typeorm-options';
import { enableDictionaryScope } from './shared-dictionary/connection';

export const typeOrmRoot: TypeOrmModuleAsyncOptions = {
  useFactory: buildTypeOrmOptions,
  dataSourceFactory: async (options) => {
    if (!options) throw new Error('Missing database options');
    await prepareDatabase();
    return enableDictionaryScope(await new DataSource(options).initialize());
  },
};
