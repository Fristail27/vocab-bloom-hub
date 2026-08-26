import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../SettingsModule/settings.module';
import { EnController } from './en.controller';
import { EnService } from './en.service';
import { EnMeaning } from './entities/en_meaning.entity';
import { EnEntry } from './entities/en_entry.entity';
import { EnWord } from './entities/en_word.entity';
import { EnMeaningTranslation } from './entities/en_meaning_translation.entity';
import { EnShortTranslation } from './entities/en_short_translation.entity';
import { EnShortTranslationService } from './modules/EnShortTranslation/enShortTranslation.service';
import { EnShortTranslationController } from './modules/EnShortTranslation/enShortTranslation.controller';
import { EnMeaningTranslationController } from './modules/EnMeaningTranslation/enMeaningTranslation.controller';
import { EnMeaningTranslationService } from './modules/EnMeaningTranslation/enMeaningTranslation.service';
import { EnMeaningController } from './modules/EnMeaning/enMeaning.controller';
import { EnMeaningService } from './modules/EnMeaning/enMeaning.service';
import { EnImportDictionaryService } from './modules/EnImportDictionary/enImportDictionary.service';
import { EnImportDictionaryController } from './modules/EnImportDictionary/enImportDictionary.controller';
import { EnSearchController } from './modules/EnSearch/enSearch.controller';
import { EnSearchService } from './modules/EnSearch/enSearch.service';
import { EnStatisticsController } from './modules/EnStatistics/enStatistics.controller';
import { EnStatisticsService } from './modules/EnStatistics/enStatistics.service';
import { EnAdminListsController } from './modules/EnAdminLists/enAdminLists.controller';
import { EnAdminListsService } from './modules/EnAdminLists/enAdminLists.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation]),
    // the import service records the dataset version of the last import
    SettingsModule,
  ],
  controllers: [
    // EnStatisticsController and EnAdminListsController must be registered before
    // EnController, otherwise GET /api/en/statistics, /api/en/words, /api/en/meanings
    // and /api/en/meaning-translations are swallowed by the GET /api/en/:id route
    EnStatisticsController,
    EnAdminListsController,
    EnController,
    EnShortTranslationController,
    EnMeaningTranslationController,
    EnMeaningController,
    EnImportDictionaryController,
    EnSearchController,
  ],
  providers: [
    EnService,
    EnShortTranslationService,
    EnMeaningTranslationService,
    EnMeaningService,
    EnImportDictionaryService,
    EnSearchService,
    EnStatisticsService,
    EnAdminListsService,
  ],
  // the public API reuses the search service
  exports: [EnService, EnSearchService],
})
export class EnModule {}
