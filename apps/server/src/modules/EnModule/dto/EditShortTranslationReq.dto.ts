import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsArray, IsOptional } from 'class-validator';
import { AvailableTranslationLanguagesE, EnShortTranslationT } from '../../../../types';

export class EditShortTranslationReqDTO {
  @ApiProperty()
  @IsOptional()
  @IsEnum(AvailableTranslationLanguagesE)
  language?: EnShortTranslationT['language'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description?: EnShortTranslationT['description'] | undefined;

  @ApiProperty()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variant_of_words?: EnShortTranslationT['variants_of_words'] | undefined;

  @ApiProperty()
  @IsNumber()
  id!: number;
}
