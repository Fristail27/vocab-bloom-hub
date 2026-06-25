import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsBoolean, IsEnum, ValidateNested } from 'class-validator';
import { CategoryE, EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from '../../../../../../types';
import { MeaningTranslationDto } from '../../EnMeaningTranslation/dto/MeaningTranslation.dto';
import { Type } from 'class-transformer';

export class AddMeaningReqDTO {
  @ApiProperty()
  @IsNumber()
  word_id!: number;

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

  @ApiProperty()
  @IsNumber()
  sort_order!: EnMeaningT['sort_order'];

  @ApiProperty()
  @IsBoolean()
  is_obsolete!: EnMeaningT['is_obsolete'];

  @ApiProperty()
  @IsEnum(WordLevelE)
  meaning_level!: EnMeaningT['meaning_level'];

  @ApiProperty()
  @IsEnum(EnAreaVariantsE)
  area_variant!: EnMeaningT['area_variant'];

  @ApiProperty()
  @IsEnum(LanguageRegisterE)
  language_register!: EnMeaningT['language_register'];

  @ApiProperty({ enum: CategoryE, isArray: true })
  @IsArray()
  @IsEnum(CategoryE, { each: true })
  categories!: EnMeaningT['categories'];

  @ApiProperty({ type: [MeaningTranslationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeaningTranslationDto)
  translations!: MeaningTranslationDto[];
}
