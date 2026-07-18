import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray } from 'class-validator';
import { AvailableTranslationLanguagesE, EnMeaningTranslationT } from '../../../../../../types';

export class MeaningTranslationDto {
  @ApiProperty()
  @IsEnum(AvailableTranslationLanguagesE)
  language!: EnMeaningTranslationT['language'];

  @ApiProperty()
  @IsString()
  title!: EnMeaningTranslationT['title'];

  @ApiProperty()
  @IsString()
  definition!: EnMeaningTranslationT['definition'];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  variants_of_words!: EnMeaningTranslationT['variants_of_words'];
}
