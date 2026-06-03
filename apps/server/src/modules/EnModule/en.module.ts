import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnController } from './en.controller';
import { EnService } from './en.service';
import { EnMeaning } from './entities/en_meaning.entity';
import { EnEntry } from './entities/en_entry.entity';
import { EnWord } from './entities/en_word.entity';
import { EnMeaningTranslation } from './entities/en_meaning_translation.entity';
import { EnShortTranslation } from './entities/en_short_translation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation])],
  controllers: [EnController],
  providers: [EnService],
  exports: [EnService],
})
export class EnModule {}
