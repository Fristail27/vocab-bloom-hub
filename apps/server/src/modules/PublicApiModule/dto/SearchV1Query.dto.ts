import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
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
import { AvailableTranslationLanguagesE, EnEntryTypesE } from '../../../../types';
import { SEARCH_TERM_MAX_LENGTH } from '../../EnModule/modules/EnSearch/dto/SearchReq.dto';
import { toArray, toBoolean } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

// The GET form of the search (issue #396): the same fields as the POST bodies
// (SearchV1ReqDTO, SearchDetailedV1ReqDTO), read from the query string —
// numbers, booleans and the language list arrive as text and are converted
// here. A GET answer carries the caching headers of the prefix and can be
// shared as a link; the POST routes stay through the beta.

const SEARCH_TERM = {
  minLength: 1,
  maxLength: SEARCH_TERM_MAX_LENGTH,
  description: 'The term to search for',
  example: 'run',
};

export class SearchV1QueryDTO {
  @ApiProperty(SEARCH_TERM)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_TERM_MAX_LENGTH)
  search!: string;

  @ApiPropertyOptional({ enum: EnEntryTypesE, description: 'Restrict the answer to one entry type' })
  @IsOptional()
  @IsEnum(EnEntryTypesE)
  type?: EnEntryTypesE;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}

export class SearchDetailedV1QueryDTO {
  @ApiProperty(SEARCH_TERM)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_TERM_MAX_LENGTH)
  search!: string;

  @ApiPropertyOptional({ enum: EnEntryTypesE, description: 'Restrict the answer to one entry type' })
  @IsOptional()
  @IsEnum(EnEntryTypesE)
  type?: EnEntryTypesE;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 20, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  page?: number = 1;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Join the meanings (with translations, synonyms, antonyms) of every item',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  with_meanings?: boolean = false;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Join the short translations of every item',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  with_translations?: boolean = false;

  @ApiPropertyOptional({
    enum: AvailableTranslationLanguagesE,
    isArray: true,
    description: 'Keep only these translation languages (a repeated key); no value means all of them',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  translation_languages?: AvailableTranslationLanguagesE[];
}
