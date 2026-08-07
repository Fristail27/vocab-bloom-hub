import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EnEntryTypesE } from '../../../../../../types';

export class SearchReqDTO {
  @ApiProperty()
  @IsString()
  search!: string;

  @IsOptional()
  @IsEnum(EnEntryTypesE)
  type?: EnEntryTypesE;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}
