import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber } from 'class-validator';
import { EnAreaVariantsE, EnWordFormsE } from '../../../../types';

export class AddWordFormReqDTO {
  @ApiProperty()
  @IsString()
  word!: string;

  @ApiProperty()
  @IsEnum(EnWordFormsE)
  form_of_word!: EnWordFormsE;

  @ApiProperty()
  @IsString()
  transcription!: string;

  @ApiProperty()
  @IsEnum(EnAreaVariantsE)
  area_variant!: EnAreaVariantsE;

  @ApiProperty()
  @IsNumber()
  base_word_id!: number;
}
