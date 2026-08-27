import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnModule } from '../EnModule/en.module';
import { SettingsModule } from '../SettingsModule/settings.module';
import { EnWord } from '../EnModule/entities/en_word.entity';
import { PublicSearchController } from './public-search.controller';
import { PublicWordsController } from './public-words.controller';
import { PublicDictionaryController } from './public-dictionary.controller';
import { PublicWordsService } from './public-words.service';
import { PublicMetaService } from './public-meta.service';

/**
 * The public, read-only, versioned surface of the dictionary (`/api/v1`,
 * issues #271, #272): no authentication, nothing that mutates data, one rate
 * limit for the whole prefix. Backed by the same services and mappers as
 * the admin API.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EnWord]),
    EnModule,
    // the dataset version of the last import lives in the settings store
    SettingsModule,
  ],
  controllers: [PublicSearchController, PublicWordsController, PublicDictionaryController],
  providers: [PublicWordsService, PublicMetaService],
})
export class PublicApiModule {}
