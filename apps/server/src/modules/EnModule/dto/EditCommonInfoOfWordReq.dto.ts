import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean, IsEnum } from 'class-validator';
import {
  CategoryE,
  EnAreaVariantsE,
  EnPhrasalObjectPatternE,
  EnVerbTransitivityE,
  EnWordT,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../types';

export class EditCommonInfoOfWordReqDTO {
  @ApiProperty()
  @IsOptional()
  @IsString()
  description?: EnWordT['description'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  is_obsolete?: EnWordT['is_obsolete'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  generated?: EnWordT['generated'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  generated_by_model?: EnWordT['generated_by_model'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  is_abbreviation?: EnWordT['is_abbreviation'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  transcription?: EnWordT['transcription'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(WordLevelE)
  word_level?: EnWordT['word_level'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnAreaVariantsE)
  area_variant?: EnWordT['area_variant'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(LanguageRegisterE)
  language_register?: EnWordT['language_register'] | undefined;

  @ApiProperty({ enum: CategoryE, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CategoryE, { each: true })
  categories?: EnWordT['categories'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___uncountable?: EnWordT['noun___uncountable'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___irregular_plural?: EnWordT['noun___irregular_plural'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___always_plural?: EnWordT['noun___always_plural'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  noun___is_proper?: EnWordT['noun___is_proper'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  verb___is_irregular?: EnWordT['verb___is_irregular'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  verb___is_phrasal?: EnWordT['verb___is_phrasal'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnVerbTransitivityE)
  verb___transitivity?: EnWordT['verb___transitivity'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnPhrasalObjectPatternE)
  verb___phrasal_object_pattern?: EnWordT['verb___phrasal_object_pattern'] | undefined;
}
