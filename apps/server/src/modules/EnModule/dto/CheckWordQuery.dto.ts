import { ApiProperty } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional } from 'class-validator';
import { EnPartOfSpeechE } from '../../../../types';

export class CheckWordQueryDTO {
  @ApiProperty({ enum: EnPartOfSpeechE })
  @IsEnum(EnPartOfSpeechE)
  partOfSpeech!: EnPartOfSpeechE;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBooleanString()
  forPhrasal?: string | undefined;
}
