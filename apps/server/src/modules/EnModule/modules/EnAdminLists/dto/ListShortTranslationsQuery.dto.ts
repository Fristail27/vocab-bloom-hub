import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AvailableTranslationLanguagesE, EnPartOfSpeechE } from '../../../../../../types';
import { PaginationQueryDTO, toArray } from './PaginationQuery.dto';

/** Filters of the admin short translations listing (GET /api/en/short-translations) */
export class ListShortTranslationsQueryDTO extends PaginationQueryDTO {
  @ApiPropertyOptional({ description: 'Prefix of the word the translation belongs to, case-insensitive' })
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

  @ApiPropertyOptional({ enum: AvailableTranslationLanguagesE, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(AvailableTranslationLanguagesE, { each: true })
  language?: AvailableTranslationLanguagesE[];
}
