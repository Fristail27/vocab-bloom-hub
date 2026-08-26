import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { CategoryE, EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from '../../../../../../types';
import { MAX_WORD_LINKS_PER_MEANING } from '../../../utils/normalizeWordLinks';

export class EditMeaningReqDTO {
  @ApiProperty()
  @IsNumber()
  id!: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  title?: EnMeaningT['title'];

  @ApiProperty()
  @IsOptional()
  @IsString()
  definition?: EnMeaningT['definition'];

  @ApiProperty()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examples?: EnMeaningT['examples'];

  // Replaces the whole synonym set when present; omit it to leave the links untouched
  @ApiProperty({ isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WORD_LINKS_PER_MEANING)
  @IsString({ each: true })
  synonyms?: EnMeaningT['synonyms'];

  // Same as synonyms: the whole antonym set is replaced when present (issue #266)
  @ApiProperty({ isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WORD_LINKS_PER_MEANING)
  @IsString({ each: true })
  antonyms?: EnMeaningT['antonyms'];

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  sort_order?: EnMeaningT['sort_order'];

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  is_obsolete?: EnMeaningT['is_obsolete'];

  @ApiProperty()
  @IsOptional()
  @IsEnum(WordLevelE)
  meaning_level?: EnMeaningT['meaning_level'];

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnAreaVariantsE)
  area_variant?: EnMeaningT['area_variant'];

  @ApiProperty()
  @IsOptional()
  @IsEnum(LanguageRegisterE)
  language_register?: EnMeaningT['language_register'];

  @ApiProperty({ enum: CategoryE, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CategoryE, { each: true })
  categories?: EnMeaningT['categories'];
}
