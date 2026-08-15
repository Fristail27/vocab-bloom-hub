import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsArray, IsNumber, IsOptional } from 'class-validator';
import { AvailableTranslationLanguagesE, EnMeaningTranslationT } from '../../../../../../types';

export class MeaningTranslationDto {
  // Client-side ids may leak through for already-persisted rows; the server ignores them
  @IsOptional()
  @IsNumber()
  id?: EnMeaningTranslationT['id'] | undefined;

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
