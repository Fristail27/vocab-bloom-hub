import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsArray, IsOptional } from 'class-validator';
import { AvailableTranslationLanguagesE, EnMeaningTranslationT } from '../../../../../../types';

export class EditMeaningTranslationReqDTO {
  @ApiProperty()
  @IsNumber()
  id!: number;

  @ApiProperty()
  @IsOptional()
  @IsEnum(AvailableTranslationLanguagesE)
  language?: EnMeaningTranslationT['language'];

  @ApiProperty()
  @IsOptional()
  @IsString()
  title?: EnMeaningTranslationT['title'];

  @ApiProperty()
  @IsOptional()
  @IsString()
  definition?: EnMeaningTranslationT['definition'];

  @ApiProperty()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variant_of_words?: EnMeaningTranslationT['variants_of_words'];
}
