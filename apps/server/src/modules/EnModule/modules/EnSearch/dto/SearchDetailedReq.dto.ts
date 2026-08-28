import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AvailableTranslationLanguagesE, EnEntryTypesE } from '../../../../../../types';

export class SearchDetailedReqDTO {
  @ApiProperty()
  @IsString()
  search!: string;

  @ApiPropertyOptional({ enum: EnEntryTypesE, description: 'Restrict the answer to one entry type' })
  @IsOptional()
  @IsEnum(EnEntryTypesE)
  type?: EnEntryTypesE;

  // Every item may carry joined meanings and translations, so both the page
  // size and the pagination depth are capped tighter than in the base search
  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  page?: number = 1;

  @ApiPropertyOptional({
    default: false,
    description: 'Join the meanings (with translations, synonyms, antonyms) of every item',
  })
  @IsOptional()
  @IsBoolean()
  with_meanings?: boolean = false;

  @ApiPropertyOptional({ default: false, description: 'Join the short translations of every item' })
  @IsOptional()
  @IsBoolean()
  with_translations?: boolean = false;

  // No filter means all languages
  @ApiPropertyOptional({
    enum: AvailableTranslationLanguagesE,
    isArray: true,
    description: 'Keep only these translation languages; no value means all of them',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  translation_languages?: AvailableTranslationLanguagesE[];
}
