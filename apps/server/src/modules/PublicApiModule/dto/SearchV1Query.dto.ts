import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AvailableTranslationLanguagesE } from '../../../../types';
import { SearchReqDTO } from '../../EnModule/modules/EnSearch/dto/SearchReq.dto';
import { SearchDetailedReqDTO } from '../../EnModule/modules/EnSearch/dto/SearchDetailedReq.dto';
import { toArray, toBoolean } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

// The public search reads (issue #396): the fields of the admin search DTOs
// (SearchReqDTO / SearchDetailedReqDTO), read from the query string. Only the
// fields that arrive as text are re-declared, with the conversion in front of
// the same validators and bounds; everything else is inherited, so the public
// and the admin search cannot drift. The transforms stay here: on the admin
// JSON bodies they would loosen the validation (a string where a number is
// required).

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
  // `?translation_languages=` with nothing after it is an empty list, refused by name
  @Transform(({ value }: { value: unknown }) => toArray({ value }).filter((v) => v !== ''))
  @IsArray()
  @ArrayMinSize(1, { message: 'translation_languages must not be empty; omit the key for every language' })
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  override translation_languages?: AvailableTranslationLanguagesE[] = undefined;
}
