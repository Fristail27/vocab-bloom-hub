import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { EnAreaVariantsE } from '../../../../types';

export class EditWordFormReqDTO {
  @ApiProperty()
  @IsNumber()
  id!: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  word?: string | undefined;

  @ApiProperty()
  @IsOptional()
  @IsString()
  transcription?: string | undefined;

  @ApiProperty()
  @IsOptional()
  @IsEnum(EnAreaVariantsE)
  area_variant?: EnAreaVariantsE | undefined;
}
