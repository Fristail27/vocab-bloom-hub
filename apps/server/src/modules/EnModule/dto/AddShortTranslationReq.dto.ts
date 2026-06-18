import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsArray } from 'class-validator';
import { AvailableTranslationLanguagesE, EnShortTranslationT } from '../../../../types';

export class AddShortTranslationReqDTO {
  @ApiProperty()
  @IsEnum(AvailableTranslationLanguagesE)
  language!: EnShortTranslationT['language'];

  @ApiProperty()
  @IsString()
  description!: EnShortTranslationT['description'];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  variant_of_words!: EnShortTranslationT['variants_of_words'];

  @ApiProperty()
  @IsNumber()
  word_id!: number;
}
