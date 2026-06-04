import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsArray } from 'class-validator';
import { AvailableTranslationLanguagesE, EnMeaningTranslationT } from '../../../../types';

export class AddMeaningTranslationReqDTO {
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

  @ApiProperty()
  @IsNumber()
  meaning_id!: number;
}
