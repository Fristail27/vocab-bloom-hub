import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CategoryE, EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from '../../../../../../types';
import { MeaningTranslationDto } from '../../EnMeaningTranslation/dto/MeaningTranslation.dto';
import { Type } from 'class-transformer';
import { MAX_SYNONYMS_PER_MEANING } from '../../../utils/normalizeSynonyms';

export class AddMeaningReqDTO {
  @ApiProperty()
  @IsNumber()
  word_id!: number;

  @IsOptional()
  @IsNumber()
  id?: number | undefined;

  @ApiProperty()
  @IsString()
  title!: EnMeaningT['title'];

  @ApiProperty()
  @IsString()
  definition!: EnMeaningT['definition'];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  examples!: EnMeaningT['examples'];

  // Headwords of other dictionary entries; unknown words are rejected by the service
  @ApiProperty({ isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SYNONYMS_PER_MEANING)
  @IsString({ each: true })
  synonyms?: EnMeaningT['synonyms'] | undefined;

  @ApiProperty()
  @IsNumber()
  sort_order!: EnMeaningT['sort_order'];

  @ApiProperty()
  @IsBoolean()
  is_obsolete!: EnMeaningT['is_obsolete'];

  @ApiProperty()
  @IsOptional()
  @IsEnum(WordLevelE)
  meaning_level!: EnMeaningT['meaning_level'];

  @ApiProperty()
  @IsEnum(EnAreaVariantsE)
  area_variant!: EnMeaningT['area_variant'];

  @ApiProperty()
  @IsOptional()
  @IsEnum(LanguageRegisterE)
  language_register!: EnMeaningT['language_register'];

  @ApiProperty({ enum: CategoryE, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CategoryE, { each: true })
  categories!: EnMeaningT['categories'];

  @ApiProperty({ type: [MeaningTranslationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeaningTranslationDto)
  translations!: MeaningTranslationDto[];
}
