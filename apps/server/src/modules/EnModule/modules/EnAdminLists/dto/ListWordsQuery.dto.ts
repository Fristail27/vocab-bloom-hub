import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EnAreaVariantsE, EnPartOfSpeechE, LanguageRegisterE, WordLevelE } from '../../../../../../types';
import { LIST_MAX_LIMIT, PaginationQueryDTO, toArray, toBoolean } from './PaginationQuery.dto';

export const LIST_WORDS_MAX_LIMIT = LIST_MAX_LIMIT;

/** Filters of the admin words listing (GET /api/en/words); only base forms are listed */
export class ListWordsQueryDTO extends PaginationQueryDTO {
  @ApiPropertyOptional({ description: 'Word prefix, case-insensitive' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;

  @ApiPropertyOptional({ enum: EnPartOfSpeechE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(EnPartOfSpeechE, { each: true })
  part_of_speech?: EnPartOfSpeechE[];

  @ApiPropertyOptional({ enum: EnAreaVariantsE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(EnAreaVariantsE, { each: true })
  area_variant?: EnAreaVariantsE[];

  @ApiPropertyOptional({ enum: WordLevelE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(WordLevelE, { each: true })
  word_level?: WordLevelE[];

  @ApiPropertyOptional({ enum: LanguageRegisterE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(LanguageRegisterE, { each: true })
  language_register?: LanguageRegisterE[];

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  generated?: boolean;

  @ApiPropertyOptional({ description: 'Exact match of generated_by_model' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  generated_by_model?: string;

  @ApiPropertyOptional({ description: 'Exact match of the record version' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  version?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_obsolete?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'true: only words with meanings, false: only without' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  has_meanings?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: only words with short translations, false: only without',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  has_short_translations?: boolean;
}
