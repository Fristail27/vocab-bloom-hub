import { PronunciationAudioDTO } from './PronunciationAudio.dto';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnAreaVariantsE } from '../../../../types';

export class PronunciationDTO {
  @ApiProperty({
    type: [PronunciationAudioDTO],
    required: false,
    description: 'Omit on an existing ID to preserve recordings; [] clears them.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PronunciationAudioDTO)
  audio?: PronunciationAudioDTO[];

  @ApiProperty({ required: false, description: 'Existing ID on edit; ignored on copy/import.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiProperty({ enum: ['ipa', 'enpr'] })
  @IsIn(['ipa', 'enpr'])
  type!: 'ipa' | 'enpr';

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Nonblank transcription, or null for a pronunciation with audio.',
  })
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @Matches(/\S/)
  text!: string | null;

  @ApiProperty({ enum: EnAreaVariantsE })
  @IsEnum(EnAreaVariantsE)
  area_variant!: EnAreaVariantsE;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  sort_order!: number;
}

export class WithPronunciationsDTO {
  @ApiProperty({
    type: [PronunciationDTO],
    required: false,
    description:
      'Own pronunciations. Omit to preserve; [] clears the list. Legacy transcription remains independent.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PronunciationDTO)
  pronunciations?: PronunciationDTO[];
}
