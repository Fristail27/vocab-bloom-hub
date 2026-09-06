import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AvailableTranslationLanguagesE, EnEntryTypesE } from '../../../../../../types';
import { SEARCH_TERM_MAX_LENGTH } from './SearchReq.dto';

export class SearchDetailedReqDTO {
  @ApiProperty({
    minLength: 1,
    maxLength: SEARCH_TERM_MAX_LENGTH,
    description: 'The term to search for',
    example: 'run',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_TERM_MAX_LENGTH)
  search!: string;

  @ApiPropertyOptional({ enum: EnEntryTypesE, description: 'Restrict the answer to one entry type' })
  @IsOptional()
  @IsEnum(EnEntryTypesE)
  type?: EnEntryTypesE;

  // Every item may carry joined meanings and translations, so both the page
  // size and the pagination depth are capped tighter than in the base search
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 20, default: 1 })
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

  // No filter means all languages; an empty list is rejected rather than
  // read as "none" or "all" (the two readings drifted once, issue #392)
  @ApiPropertyOptional({
    enum: AvailableTranslationLanguagesE,
    isArray: true,
    minItems: 1,
    description: 'Keep only these translation languages; omit the field for all of them',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  translation_languages?: AvailableTranslationLanguagesE[];
}
