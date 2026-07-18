import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { EnMeaningService } from './modules/EnMeaning/enMeaning.service';
import { EnImportDictionaryService } from './modules/EnImportDictionary/enImportDictionary.service';
import { EnImportDictionaryController } from './modules/EnImportDictionary/enImportDictionary.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation])],
  controllers: [
    EnController,
    EnShortTranslationController,
    EnMeaningTranslationController,
    EnMeaningTranslationController,
    EnImportDictionaryController,
  ],
  providers: [
    EnService,
    EnShortTranslationService,
    EnMeaningTranslationService,
    EnMeaningService,
    EnImportDictionaryService,
  ],
  exports: [EnService],
})
export class EnModule {}
