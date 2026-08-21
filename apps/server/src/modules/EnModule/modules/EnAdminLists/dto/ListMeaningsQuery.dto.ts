import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EnAreaVariantsE, EnPartOfSpeechE, LanguageRegisterE, WordLevelE } from '../../../../../../types';
import { PaginationQueryDTO, toArray, toBoolean } from './PaginationQuery.dto';

/** Filters of the admin meanings listing (GET /api/en/meanings) */
export class ListMeaningsQueryDTO extends PaginationQueryDTO {
  @ApiPropertyOptional({ description: 'Prefix of the word the meaning belongs to, case-insensitive' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;

  @ApiPropertyOptional({ enum: EnPartOfSpeechE, isArray: true, description: 'Part of speech of the word' })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(EnPartOfSpeechE, { each: true })
  part_of_speech?: EnPartOfSpeechE[];

  @ApiPropertyOptional({ enum: EnAreaVariantsE, isArray: true, description: 'Regional label of the meaning' })
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
  meaning_level?: WordLevelE[];

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
  is_obsolete?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: only meanings with translations, false: only without',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  has_translations?: boolean;
}
