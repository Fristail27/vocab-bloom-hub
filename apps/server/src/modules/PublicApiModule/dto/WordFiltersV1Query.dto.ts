import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import {
  CategoryE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../types';
import { toArray } from '../../EnModule/modules/EnAdminLists/dto/PaginationQuery.dto';

/**
 * Filters shared by the public list and random-word reads (issue #272).
 * Every filter accepts one value or a repeated key (`?word_level=B1&word_level=B2`);
 * values of one filter are OR-ed, different filters are AND-ed. Without
 * `form_of_word` only base forms are considered: inflected forms ("ran")
 * are reachable through the base entry's `forms`.
 */
export class WordFiltersV1QueryDTO {
  @ApiPropertyOptional({ enum: EnPartOfSpeechE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(EnPartOfSpeechE, { each: true })
  part_of_speech?: EnPartOfSpeechE[];

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

  @ApiPropertyOptional({
    enum: CategoryE,
    isArray: true,
    description: 'Words tagged with any of the categories',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(CategoryE, { each: true })
  category?: CategoryE[];

  @ApiPropertyOptional({ enum: EnAreaVariantsE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(EnAreaVariantsE, { each: true })
  area_variant?: EnAreaVariantsE[];

  @ApiPropertyOptional({
    enum: EnWordFormsE,
    isArray: true,
    default: [EnWordFormsE.base_form],
    description: 'Defaults to base forms only',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(EnWordFormsE, { each: true })
  form_of_word?: EnWordFormsE[] = [EnWordFormsE.base_form];
}
