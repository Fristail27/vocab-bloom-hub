import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CategoryE, EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from '../../../../types';

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
