import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AvailableTranslationLanguagesE } from '../../../../types';
import { SearchReqDTO } from '../../EnModule/modules/EnSearch/dto/SearchReq.dto';
import { SearchDetailedReqDTO } from '../../EnModule/modules/EnSearch/dto/SearchDetailedReq.dto';
import { toArray, toBoolean } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

// The GET form of the search (issue #396): the same fields as the POST bodies
// (SearchReqDTO / SearchDetailedReqDTO), read from the query string. Only the
// fields that arrive as text are re-declared, with the conversion in front of
// the same validators and bounds; everything else is inherited, so the two
// forms cannot drift. The transforms stay here: on the POST bodies they would
// loosen the validation (a string where a number is required).

export class SearchV1QueryDTO extends SearchReqDTO {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override limit = 10;
}

export class SearchDetailedV1QueryDTO extends SearchDetailedReqDTO {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 20, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  override limit?: number = 10;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 20, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  override page?: number = 1;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Join the meanings (with translations, synonyms, antonyms) of every item',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  override with_meanings?: boolean = false;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description: 'Join the short translations of every item',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  override with_translations?: boolean = false;

  @ApiPropertyOptional({
    enum: AvailableTranslationLanguagesE,
    isArray: true,
    minItems: 1,
    description: 'Keep only these translation languages (a repeated key); omit the key for all of them',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  override translation_languages?: AvailableTranslationLanguagesE[] = undefined;
}
