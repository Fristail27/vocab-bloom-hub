import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suggestion } from './entities/suggestion.entity';
import { EnEntry } from '../EnModule/entities/en_entry.entity';
import { EnWord } from '../EnModule/entities/en_word.entity';
import { EnMeaning } from '../EnModule/entities/en_meaning.entity';
import { EnMeaningTranslation } from '../EnModule/entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../EnModule/entities/en_short_translation.entity';
import { SettingsModule } from '../SettingsModule/settings.module';
import { AuthModule } from '../AuthModule/auth.module';
import { SuggestionsService } from './suggestions.service';
import { PublicSuggestionsController } from './public-suggestions.controller';

/**
 * Reader feedback on the dictionary data (issue #327): the public intake
 * (POST /api/v1/suggestions) and the admin moderation queue
 * (/api/en/suggestions). AuditModule is global; AuthModule provides the
 * AdminGuard's dependencies, SettingsModule the dataset version stamp.
 *
 * The admin SuggestionsController is registered by EnModule, not here: its
 * static /api/en/suggestions route must be matched before EnModule's
 * GET /api/en/:id, and route order follows the controller order there —
 * the same arrangement AuditController uses.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Suggestion,
      EnEntry,
      EnWord,
      EnMeaning,
      EnMeaningTranslation,
      EnShortTranslation,
    ]),
    SettingsModule,
    AuthModule,
  ],
  controllers: [PublicSuggestionsController],
  providers: [SuggestionsService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
