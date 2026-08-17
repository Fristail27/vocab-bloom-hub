import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AvailableTranslationLanguagesE, EnEntryTypesE } from '../../../../../../types';

export class SearchDetailedReqDTO {
  @ApiProperty()
  @IsString()
  search!: string;

  @IsOptional()
  @IsEnum(EnEntryTypesE)
  type?: EnEntryTypesE;

  // Every item may carry joined meanings and translations, so both the page
  // size and the pagination depth are capped tighter than in the base search
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  page?: number = 1;

  @IsOptional()
  @IsBoolean()
  with_meanings?: boolean = false;

  @IsOptional()
  @IsBoolean()
  with_translations?: boolean = false;

  // No filter means all languages
  @IsOptional()
  @IsArray()
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  translation_languages?: AvailableTranslationLanguagesE[];
}
